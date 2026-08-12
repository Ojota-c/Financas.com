#!/bin/sh
# ─────────────────────────────────────────────────────────────────────────────
# Roda UMA ÚNICA VEZ, quando o volume de dados nasce vazio.
# Alterou este arquivo? `pnpm db:reset` — sem apagar o volume ele não roda de novo.
#
# Três roles, porque a RLS precisa de alguém contra quem valer.
#
#   aurum_owner  superusuário. Só cria as outras duas. O app nunca conecta com ele.
#
#   aurum_auth   dona de todas as tabelas. Roda as migrations e o Better Auth.
#                Ignora a RLS por ser dona — e precisa ignorar: durante o login
#                ainda não existe usuário para a policy avaliar.
#
#   aurum_app    não é dona de nada, então a RLS SE APLICA a ela. É a role de
#                toda query de domínio, sempre via withUser() (src/lib/db/with-user.ts).
#
# Sem essa separação a RLS seria decorativa: uma role só, dona das tabelas,
# passaria por cima de toda policy sem reclamar.
# ─────────────────────────────────────────────────────────────────────────────
set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
	create role aurum_auth login password '${AURUM_AUTH_PASSWORD}';
	create role aurum_app  login password '${AURUM_APP_PASSWORD}';

	-- gen_random_uuid() para os defaults de chave primária.
	create extension if not exists pgcrypto;

	-- O PG15+ já tira CREATE do schema public para PUBLIC. Explicitar não custa
	-- e deixa a intenção registrada.
	revoke create on schema public from public;

	grant connect on database "$POSTGRES_DB" to aurum_auth, aurum_app;
	grant usage   on schema public to aurum_auth, aurum_app;
	grant create  on schema public to aurum_auth;

	-- CREATE no banco (e não só no schema public) porque o drizzle-kit guarda o
	-- histórico de migrations num schema próprio chamado "drizzle", que ele cria
	-- sozinho na primeira execução. Sem isto o `pnpm db:migrate` falha calado.
	grant create on database "$POSTGRES_DB" to aurum_auth;

	-- aurum_app nunca cria nem altera estrutura: só lê e escreve linha, sob RLS.
	-- "default privileges FOR ROLE aurum_auth" vale para o que aurum_auth criar
	-- daqui pra frente, que é exatamente o que as migrations fazem.
	alter default privileges for role aurum_auth in schema public
	  grant select, insert, update, delete on tables to aurum_app;
	alter default privileges for role aurum_auth in schema public
	  grant usage, select on sequences to aurum_app;

	-- Explícito de propósito: bypassrls em aurum_app tornaria toda policy inócua
	-- e a suíte de isolamento passaria por acidente. tests/rls/ verifica isso.
	alter role aurum_app  nosuperuser nocreatedb nocreaterole nobypassrls;
	alter role aurum_auth nosuperuser nocreatedb nocreaterole nobypassrls;
EOSQL
