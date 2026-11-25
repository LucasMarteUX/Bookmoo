-- Geração de página ilustrada como trabalho do servidor. O clique cria um trabalho; o desenho segue em segundo plano
-- mesmo se a pessoa sair da tela, trocar de página ou fechar a aba. A cobrança só é confirmada quando a arte e o
-- storyboard estão guardados aqui (status 'rendered'); o app termina os balões e grava a página quando a pessoa volta.
-- Antes, a página só era gravada pela tela aberta: saindo dela, o crédito era cobrado e a imagem não aparecia.
create table if not exists public.comic_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  book_id uuid not null,
  page integer not null check (page >= 0),
  status text not null default 'running' check (status in ('running', 'rendered', 'done', 'failed')),
  -- Correção automática de estilo: aponta para o trabalho corrigido (não cobra de novo).
  fix_of uuid references public.comic_jobs (id) on delete set null,
  result jsonb,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  finished_at timestamptz
);

-- Um trabalho ativo por página: dois cliques, duas abas ou uma reconexão recuperam o mesmo.
create unique index if not exists comic_jobs_one_active on public.comic_jobs (user_id, book_id, page) where status = 'running';
-- Uma correção automática por trabalho.
create unique index if not exists comic_jobs_one_fix on public.comic_jobs (fix_of) where fix_of is not null;
create index if not exists comic_jobs_user_pending on public.comic_jobs (user_id, status, created_at desc);

alter table public.comic_jobs enable row level security;

drop policy if exists "comic_jobs_select_own" on public.comic_jobs;
create policy "comic_jobs_select_own" on public.comic_jobs
  for select to authenticated using (user_id = (select auth.uid()));

revoke all on public.comic_jobs from anon;
grant select on public.comic_jobs to authenticated;

/** O app avisa que gravou a página (ou desistiu de um trabalho com falha): só o dono, só a partir de rendered/failed. */
create or replace function public.comic_job_finish(p_job uuid)
returns void language sql security definer set search_path = public as $$
  update public.comic_jobs set status = 'done', updated_at = now(), finished_at = coalesce(finished_at, now())
   where id = p_job and user_id = auth.uid() and status in ('rendered', 'failed');
$$;
revoke all on function public.comic_job_finish(uuid) from public, anon;
grant execute on function public.comic_job_finish(uuid) to authenticated;

/**
 * Limpeza a cada 5 min: trabalho que ficou "running" por mais de 8 min morreu (a função tem limite de tempo) e vira
 * falha; reservas de crédito vencidas e ainda retidas são devolvidas (antes só eram devolvidas na próxima compra da
 * mesma pessoa, e uma cena podia ficar presa por dias).
 */
create or replace function public.sweep_stale_work()
returns void language plpgsql security definer set search_path = public as $$
declare r record;
begin
  update public.comic_jobs set status = 'failed', error = coalesce(error, 'timeout'), updated_at = now(), finished_at = now()
   where status = 'running' and created_at < now() - interval '8 minutes';
  for r in select id from public.credit_reservations where status = 'held' and expires_at < now() - interval '15 minutes' loop
    perform public.credits_release(r.id);
  end loop;
end;
$$;
revoke all on function public.sweep_stale_work() from public, anon, authenticated;

select cron.unschedule('sweep-stale-work') where exists (select 1 from cron.job where jobname = 'sweep-stale-work');
select cron.schedule('sweep-stale-work', '*/5 * * * *', $$ select public.sweep_stale_work(); $$);
