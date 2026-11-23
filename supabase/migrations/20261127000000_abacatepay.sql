-- AbacatePay: cliente da loja por conta (criado no primeiro checkout).
alter table public.user_accounts add column if not exists abacate_customer_id text;
