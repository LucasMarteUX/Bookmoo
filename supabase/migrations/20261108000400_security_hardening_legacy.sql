-- Funções antigas SECURITY DEFINER: ninguém sem login executa; triggers não precisam de EXECUTE de clientes.
revoke execute on function public.add_study_time(integer) from anon, public;
revoke execute on function public.get_total_study_time() from anon, public;
revoke execute on function public.rls_auto_enable() from anon, authenticated, public;
revoke execute on function public.set_books_updated_at() from anon, authenticated, public;
revoke execute on function public.set_reader_settings_updated_at() from anon, authenticated, public;
grant execute on function public.add_study_time(integer) to authenticated;
grant execute on function public.get_total_study_time() to authenticated;

-- Tabelas de dados do usuário não precisam ser visíveis sem login (RLS já protegia as linhas).
revoke all on public.books, public.reader_settings, public.study_days, public.vocabulary from anon;
