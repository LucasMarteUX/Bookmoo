-- O Raio-X deixa de ser exclusivo dos planos pagos: no Grátis e no Essencial sai 1 por mês e
-- consome créditos de IA como qualquer outra geração. Plus continua semanal e Pro sob demanda.
update public.plans set limits = limits || '{"insights":"monthly"}'::jsonb where id in ('free', 'essencial');

-- O tutor de leitura (a bolinha do leitor) é liberado para todos, gastando créditos.
-- Só os planos com "tutors":"all" escolhem entre Bia, Luck, Yuno e Yuri; os demais conversam com a Bia.
update public.plans set limits = limits || '{"tutor":true,"tutors":"bia"}'::jsonb where id in ('free', 'essencial');
update public.plans set limits = limits || '{"tutors":"all"}'::jsonb where id in ('plus', 'pro');
