-- Boas-vindas enviadas uma vez por conta. As contas que já existem não recebem (já estão usando o app).
alter table public.user_accounts add column if not exists welcome_sent_at timestamptz;
update public.user_accounts set welcome_sent_at = now() where welcome_sent_at is null;
