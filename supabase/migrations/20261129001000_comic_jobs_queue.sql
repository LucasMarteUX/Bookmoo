-- Fila de geração de páginas ilustradas. Antes cada clique chamava a OpenAI na hora: com muita gente ao mesmo tempo, o
-- limite de imagens por minuto da conta virava 429 e o trabalho falhava. Agora o clique cria o trabalho como 'queued' e um
-- despachante só começa quantos couberem no limite de simultâneas (app_settings.comic_max_concurrent). Quem libera vaga
-- (fim de cada trabalho) puxa o próximo; o pg_cron confere a cada minuto, como rede de segurança.
-- A cobrança continua igual: o crédito só é reservado quando o desenho começa e só é confirmado com a arte guardada.

-- 1) Estados e colunas -----------------------------------------------------------------------------------------------
alter table public.comic_jobs drop constraint if exists comic_jobs_status_check;
alter table public.comic_jobs add constraint comic_jobs_status_check
  check (status in ('queued', 'running', 'rendered', 'done', 'failed'));
-- O que a pessoa pediu (texto da página, contexto, replan): o despachante refaz o pedido quando chegar a vez.
alter table public.comic_jobs add column if not exists request jsonb;
-- Quando o desenho começou de fato (a espera na fila não conta para o limite de tempo).
alter table public.comic_jobs add column if not exists started_at timestamptz;
-- Quantas vezes o trabalho já começou (nova tentativa depois de 429/5xx volta para a fila com espera crescente).
alter table public.comic_jobs add column if not exists attempts integer not null default 0;
-- Não começar antes disso (espera da nova tentativa).
alter table public.comic_jobs add column if not exists run_after timestamptz not null default now();

update public.comic_jobs set started_at = created_at, attempts = greatest(attempts, 1)
 where started_at is null and status <> 'queued';

-- Um trabalho ativo por página vale também para quem está na fila.
drop index if exists public.comic_jobs_one_active;
create unique index if not exists comic_jobs_one_active on public.comic_jobs (user_id, book_id, page)
  where status in ('queued', 'running');
create index if not exists comic_jobs_queue on public.comic_jobs (run_after, created_at) where status = 'queued';
create index if not exists comic_jobs_running on public.comic_jobs (user_id) where status = 'running';

-- 2) Configuração ----------------------------------------------------------------------------------------------------
-- comic_max_concurrent: quantas páginas desenham ao mesmo tempo. Cada página ocupa ~70 s; com N vagas a conta pede cerca
--   de N × 0,85 imagens por minuto. Ajuste ao limite de imagens por minuto (IPM) do nível da conta OpenAI, com folga
--   para edição de quadro e imagens de vocabulário, que usam a mesma conta.
-- comic_image_fallback: 'gemini' faz a página cair para o Gemini quando a OpenAI segue em 429/5xx; 'none' desliga.
insert into public.app_settings (key, value) values
  ('comic_max_concurrent', '4'),
  ('comic_image_fallback', '"none"')
on conflict (key) do nothing;

create or replace function public.comic_max_concurrent()
returns integer language sql stable security definer set search_path = public as $$
  select greatest(1, coalesce((select (value #>> '{}')::integer from public.app_settings where key = 'comic_max_concurrent'), 4));
$$;
revoke all on function public.comic_max_concurrent() from public, anon, authenticated;

-- O painel do admin pode ajustar as duas chaves novas (mesma lista de antes + as da fila).
create or replace function public.admin_set_setting(p_key text, p_value jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_global_admin() then raise exception 'forbidden'; end if;
  if p_key not in ('usd_brl', 'ai_daily_budget_usd', 'gateway_fee_pct', 'tax_pct', 'past_due_grace_days',
                   'comic_max_concurrent', 'comic_image_fallback') then raise exception 'invalid_key'; end if;
  if p_key = 'comic_max_concurrent' and (jsonb_typeof(p_value) <> 'number' or (p_value #>> '{}')::numeric < 1) then
    raise exception 'invalid_value';
  end if;
  if p_key = 'comic_image_fallback' and (p_value #>> '{}') not in ('none', 'gemini') then raise exception 'invalid_value'; end if;
  insert into public.app_settings (key, value, updated_at) values (p_key, p_value, now())
  on conflict (key) do update set value = excluded.value, updated_at = now();
end;
$$;
revoke all on function public.admin_set_setting(text, jsonb) from public, anon;
grant execute on function public.admin_set_setting(text, jsonb) to authenticated;

-- 3) Despachante -----------------------------------------------------------------------------------------------------
/**
 * Pega o próximo da fila se houver vaga e marca como 'running'. Um de cada vez (trava curta): duas invocações ao mesmo
 * tempo nunca passam do limite. Ordem: correções automáticas primeiro (a pessoa já está esperando a página), depois quem
 * tem menos páginas desenhando agora (uma pessoa com 20 páginas na fila não segura as outras), depois a ordem de chegada.
 * Só a função (service role) chama.
 */
create or replace function public.comic_job_claim()
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_running integer;
  v_id uuid;
begin
  perform pg_advisory_xact_lock(hashtext('comic_job_claim'));
  select count(*) into v_running from public.comic_jobs where status = 'running';
  if v_running >= public.comic_max_concurrent() then return null; end if;
  select q.id into v_id from public.comic_jobs q
   where q.status = 'queued' and q.run_after <= now()
   order by (q.fix_of is null),
            (select count(*) from public.comic_jobs r where r.user_id = q.user_id and r.status = 'running'),
            q.created_at
   limit 1
   for update skip locked;
  if v_id is null then return null; end if;
  update public.comic_jobs set status = 'running', started_at = now(), updated_at = now(), attempts = attempts + 1
   where id = v_id;
  return v_id;
end;
$$;
revoke all on function public.comic_job_claim() from public, anon, authenticated;

/**
 * Posição e estimativa para o app: quantos estão na frente, vagas, tempo típico de desenho (mediana dos últimos 50
 * trabalhos entregues) e a espera estimada. Só o dono do trabalho lê.
 */
create or replace function public.comic_job_queue_info(p_job uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  j public.comic_jobs;
  v_limit integer := public.comic_max_concurrent();
  v_running integer;
  v_ahead integer := 0;
  v_avg numeric;
  v_rounds integer;
  v_wait numeric := 0;
begin
  select * into j from public.comic_jobs where id = p_job and user_id = auth.uid();
  if not found then return null; end if;
  select count(*) into v_running from public.comic_jobs where status = 'running';
  select coalesce(percentile_cont(0.5) within group (order by secs), 75) into v_avg from (
    select extract(epoch from finished_at - started_at) as secs from public.comic_jobs
     where started_at is not null and finished_at is not null and error is null and status in ('rendered', 'done')
     order by finished_at desc limit 50
  ) s;
  if j.status = 'queued' then
    select count(*) into v_ahead from public.comic_jobs q
     where q.status = 'queued' and q.id <> j.id
       and ((q.fix_of is not null) > (j.fix_of is not null)
            or ((q.fix_of is not null) = (j.fix_of is not null) and q.created_at < j.created_at));
    -- Rodadas inteiras de desenho antes desta começar; a primeira já está pela metade, em média.
    v_rounds := floor((v_ahead + v_running)::numeric / v_limit);
    v_wait := greatest(extract(epoch from j.run_after - now()), case when v_rounds > 0 then (v_rounds - 0.5) * v_avg else 0 end);
  end if;
  return jsonb_build_object(
    'status', j.status,
    'position', case when j.status = 'queued' then v_ahead + 1 else 0 end,
    'running', v_running,
    'limit', v_limit,
    'avg_seconds', round(v_avg),
    'wait_seconds', round(v_wait),
    'elapsed_seconds', case when j.status = 'running' and j.started_at is not null then round(extract(epoch from now() - j.started_at)) else 0 end
  );
end;
$$;
revoke all on function public.comic_job_queue_info(uuid) from public, anon;
grant execute on function public.comic_job_queue_info(uuid) to authenticated;

-- 4) Limpeza e relógio -----------------------------------------------------------------------------------------------
/**
 * Limpeza a cada 5 min: desenho que passou de 8 min desde que COMEÇOU morreu (a função tem limite de tempo); quem ficou
 * 30 min na fila sem começar falha com 'queue_timeout' (nada foi reservado, nada a devolver); reservas vencidas voltam.
 */
create or replace function public.sweep_stale_work()
returns void language plpgsql security definer set search_path = public as $$
declare r record;
begin
  update public.comic_jobs set status = 'failed', error = coalesce(error, 'timeout'), updated_at = now(), finished_at = now()
   where status = 'running' and coalesce(started_at, created_at) < now() - interval '8 minutes';
  update public.comic_jobs set status = 'failed', error = 'queue_timeout', updated_at = now(), finished_at = now()
   where status = 'queued' and created_at < now() - interval '30 minutes';
  for r in select id from public.credit_reservations where status = 'held' and expires_at < now() - interval '15 minutes' loop
    perform public.credits_release(r.id);
  end loop;
end;
$$;
revoke all on function public.sweep_stale_work() from public, anon, authenticated;

/**
 * Rede de segurança do despachante: se há fila pronta e vaga livre, acorda a função (ex.: o aviso do fim de um trabalho
 * se perdeu, ou a espera de uma nova tentativa venceu). A chamada não leva dados: a função só pega o que já está na fila.
 */
create extension if not exists pg_net;
create or replace function public.comic_jobs_tick()
returns void language plpgsql security definer set search_path = public as $$
declare v_free integer;
begin
  v_free := public.comic_max_concurrent() - (select count(*) from public.comic_jobs where status = 'running');
  if v_free <= 0 or not exists (select 1 from public.comic_jobs where status = 'queued' and run_after <= now()) then return; end if;
  -- Uma chamada por vaga livre (no máximo 4 por minuto); cada uma pega um trabalho e acorda a próxima se ainda houver.
  for i in 1 .. least(v_free, 4) loop
    perform net.http_post(
      url := 'https://ywnmeacpvmcuhzhshpwz.supabase.co/functions/v1/comic-generate',
      headers := '{"Content-Type": "application/json", "apikey": "sb_publishable_8_SDFkolp0qhUc5yDNdM3A_n59uIlKp"}'::jsonb,
      body := '{"action": "dispatch"}'::jsonb
    );
  end loop;
end;
$$;
revoke all on function public.comic_jobs_tick() from public, anon, authenticated;

select cron.unschedule('comic-jobs-tick') where exists (select 1 from cron.job where jobname = 'comic-jobs-tick');
select cron.schedule('comic-jobs-tick', '* * * * *', $$ select public.comic_jobs_tick(); $$);

-- 5) WebP ------------------------------------------------------------------------------------------------------------
-- As páginas novas são WebP. Se o bucket tiver lista de tipos permitidos, inclui o WebP nela.
update storage.buckets set allowed_mime_types = array_append(allowed_mime_types, 'image/webp')
 where id = 'comic-pages' and allowed_mime_types is not null and not ('image/webp' = any (allowed_mime_types));
