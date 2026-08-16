-- ─────────────────────────────────────────────────────────────────────────────
-- Equivalente de docker/postgres/init/00-roles.sh para um Postgres GERENCIADO
-- (Neon, RDS, etc.), onde não existe o init de container. Roda UMA vez, antes
-- da primeira migration, conectado como a role dona do banco (no Neon, a role
-- padrão do projeto).
--
--   psql "$URL_DO_DONO" \
--     -v auth_password='SENHA_FORTE_1' \
--     -v app_password='SENHA_FORTE_2' \
--     -f db/production/setup-roles.sql
--
-- Três roles, porque a RLS precisa de alguém contra quem valer:
--   aurum_auth  dona das tabelas — migrations e Better Auth. Ignora a RLS por
--               ser dona, e precisa: no login ainda não há usuário na sessão.
--   aurum_app   não é dona de nada, a RLS SE APLICA. Toda query de domínio,
--               sempre via withUser().
-- O "aurum_owner" local não tem equivalente aqui: o gerenciado já tem o dono
-- dele, que só executa este arquivo.
-- ─────────────────────────────────────────────────────────────────────────────

create role aurum_auth login password :'auth_password';
create role aurum_app  login password :'app_password';

-- Num gerenciado o dono não é superusuário: para falar POR aurum_auth no
-- "alter default privileges" abaixo, precisa antes ser membro dela.
grant aurum_auth to current_user;

-- gen_random_uuid() dos defaults de chave primária.
create extension if not exists pgcrypto;

revoke create on schema public from public;

-- :"DBNAME" é variável embutida do psql: o nome do banco conectado.
grant connect on database :"DBNAME" to aurum_auth, aurum_app;
grant usage  on schema public to aurum_auth, aurum_app;
grant create on schema public to aurum_auth;

-- O drizzle-kit guarda o histórico num schema próprio "drizzle" que ele cria
-- na primeira execução — por isso CREATE no banco, não só no schema public.
grant create on database :"DBNAME" to aurum_auth;

-- aurum_app só lê e escreve linha, sob RLS, no que aurum_auth criar.
alter default privileges for role aurum_auth in schema public
  grant select, insert, update, delete on tables to aurum_app;
alter default privileges for role aurum_auth in schema public
  grant usage, select on sequences to aurum_app;

-- Sem o "alter role ... nobypassrls" do init local: gerenciado como o Neon
-- recusa a menção a SUPERUSER vinda de não superusuário — e não faz falta,
-- CREATE ROLE já nasce sem superuser/bypassrls. A consulta abaixo é a prova
-- impressa no terminal: as quatro colunas devem vir todas 'f'.
select rolname, rolsuper, rolbypassrls, rolcreatedb, rolcreaterole
  from pg_roles where rolname in ('aurum_auth', 'aurum_app');
