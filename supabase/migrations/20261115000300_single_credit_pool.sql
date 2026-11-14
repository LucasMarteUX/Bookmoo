-- Um saldo só: créditos de IA cobrem imagem, texto e voz (conversa = 1 crédito por minuto).
-- Os minutos do plano viraram créditos extras (voz é barata: ~US$ 0,002/min).
update public.plans set monthly_credits = 60,   monthly_minutes = 0 where id = 'free';
update public.plans set monthly_credits = 230,  monthly_minutes = 0 where id = 'essencial';
update public.plans set monthly_credits = 550,  monthly_minutes = 0 where id = 'plus';
update public.plans set monthly_credits = 1100, monthly_minutes = 0 where id = 'pro';

-- Conversas abertas (tutor) cobram por minuto completo: guarda quanto já foi cobrado.
alter table public.conversation_sessions add column if not exists charged_credits integer not null default 0;

-- Períodos abertos recebem o novo valor do plano (sem tirar o que já foi usado).
update public.credit_periods p
   set credits_granted = greatest(p.credits_granted, pl.monthly_credits)
  from public.plans pl
 where pl.id = p.plan_id and p.closed_at is null and p.ends_at > now() and p.credits_granted > 0;
