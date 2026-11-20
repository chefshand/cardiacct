-- Least-privilege login role for the web app (only the cardiacct schema).
-- The password is set separately: alter role cardiacct_app password '...';
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'cardiacct_app') then
    create role cardiacct_app login noinherit nocreatedb nocreaterole nobypassrls;
  end if;
end $$;
alter role cardiacct_app set search_path = cardiacct;
alter role cardiacct_app set statement_timeout = '60s';
grant usage on schema cardiacct to cardiacct_app;
grant select, insert, update, delete on all tables in schema cardiacct to cardiacct_app;
alter default privileges in schema cardiacct grant select, insert, update, delete on tables to cardiacct_app;
do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'cardiacct' loop
    execute format('drop policy if exists app_all on cardiacct.%I', t);
    execute format('create policy app_all on cardiacct.%I for all to cardiacct_app using (true) with check (true)', t);
  end loop;
end $$;
