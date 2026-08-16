# Aurum

App de finanças pessoais. Web responsivo + PWA instalável, com espaço pessoal privado e espaço compartilhado por convite.

> **Status:** fase 0 concluída — cadastro, autenticação, rotas protegidas, e cada
> conta nascendo com espaço pessoal e categorias próprias, isolados por RLS.
> Stack self-hosted em Docker desde 11/08/2026 (antes era Supabase).

---

## O que é

Controle de gastos, receitas, contas a pagar, orçamento por categoria e metas de reserva — com dashboard visual, projeções e insights financeiros. Feito para uso pessoal e para convidar amigos e familiares, cada um com seus dados totalmente isolados.

O diferencial não é registrar gasto (todo app faz isso), é responder as perguntas que importam:

- **Safe-to-spend** — quanto posso gastar por dia até o fim do mês, já descontadas contas e metas
- **Runway** — quantos meses eu sobrevivo sem receber nada
- **Score de saúde financeira** — 0 a 100, composto por taxa de poupança, reserva, dívida, aderência ao orçamento e consistência
- **Projeção de fim de mês** — mostrada no dia 12, quando ainda dá pra corrigir
- **Simulador "e se"** — o efeito real de cortar um gasto, projetado em 1, 5 e 10 anos

---

## Stack

Next.js 16 (App Router) · React 19 · TypeScript strict · Tailwind v4 · shadcn/ui · PostgreSQL 17 em Docker · Drizzle · Better Auth · Zod · TanStack Query · Recharts + D3 · Motion · Serwist (PWA)

O isolamento entre espaços é do banco, não do código: RLS ligada em toda tabela,
com o usuário da requisição informado por variável de sessão dentro da
transação. Uma suíte automatizada loga como A, tenta ler dados de B e exige zero
linhas — e roda no CI a cada push.

Onde a produção vai rodar ainda está em aberto: o mesmo `docker-compose.yml`
serve para um VPS, e a alternativa é Vercel + Postgres gerenciado.

---

## Arquitetura em uma frase

**Nada pertence a um usuário — tudo pertence a um workspace.** Cada pessoa ganha um workspace pessoal privado no cadastro, e pode criar workspaces compartilhados por convite. O isolamento é garantido pelo Postgres via Row Level Security, não por lógica de aplicação.

---

## Regras invioláveis

1. Dinheiro é `BIGINT` em centavos. Nunca float.
2. RLS habilitado em toda tabela. `service_role` nunca no cliente.
3. Toda tabela de domínio tem `workspace_id`.
4. Nenhuma cor hardcoded — tudo em variável CSS.
5. `src/lib/finance/` é função pura, 100% testada, data sempre por parâmetro.
6. TypeScript strict. `any` é erro de build.

---

## Documentação

| Arquivo | Conteúdo |
|---|---|
| [`CLAUDE.md`](./CLAUDE.md) | Memória do projeto — arquitetura, convenções, comandos, o que nunca fazer |
| [`PLANEJAMENTO-APP-FINANCAS.md`](./PLANEJAMENTO-APP-FINANCAS.md) | Documento mestre — stack justificada, modelo de dados, RLS, features, fórmulas financeiras, design system, roadmap, riscos |
| [`PROMPTS-CLAUDE-CODE.md`](./PROMPTS-CLAUDE-CODE.md) | Prompts prontos, um por fase, para executar o desenvolvimento |

---

## Roadmap

| Fase | Escopo | Status |
|---|---|---|
| 0 | Fundação, auth, deploy | ✅ |
| 1a | Schema + RLS + teste de isolamento | ⬜ |
| 1b | Lançamentos, contas, categorias, dashboard | ⬜ |
| 2 | Recorrentes, contas a pagar, fatura, orçamento | ⬜ |
| 3a | Motor financeiro puro | ⬜ |
| 3b | Metas, gráficos, insights, simulador | ⬜ |
| 4 | Workspace compartilhado e convites | ⬜ |
| 5 | PWA, push, onboarding, auditoria | ⬜ |

Cada fase termina em produção. Estimativa da V0: 4 a 5 semanas em ritmo de projeto paralelo.

---

## Começando

Pré-requisitos: **Node 22+**, pnpm e **Docker**. Nenhuma conta em serviço externo:
o banco e o servidor de e-mail sobem na sua máquina.

```bash
pnpm install
cp .env.example .env.local     # gere o BETTER_AUTH_SECRET e troque SENHA
pnpm db:up                     # Postgres 17 + Mailpit
pnpm db:migrate                # cria o schema e carrega as categorias
pnpm dev
```

Crie uma conta em `/signup`. O e-mail de confirmação **não sai da máquina** —
ele aparece em **http://localhost:8025** (Mailpit). Clique no link de lá.

O login com Google só aparece depois de preencher `GOOGLE_CLIENT_ID` e
`GOOGLE_CLIENT_SECRET`; o redirect URI a cadastrar é
`http://localhost:3000/api/auth/callback/google`.

> O Postgres escuta na **5434**, não na 5432 — é comum a 5432 já estar tomada
> por um Postgres nativo, e o Docker não reclama disso: ele binda em `*:5432`
> enquanto o nativo binda em `[::1]:5432`, que ganha o `localhost`. O sintoma
> seria `role "aurum_auth" does not exist`.

## Comandos

```bash
pnpm dev           # desenvolvimento
pnpm build         # build de produção
pnpm lint          # ESLint
pnpm typecheck     # tsc --noEmit
pnpm format        # Prettier
pnpm test          # unit (Vitest)
pnpm test:rls      # isolamento entre usuários, contra o Postgres do compose
pnpm db:up         # sobe os containers      · db:down  derruba
pnpm db:migrate    # aplica migrations       · db:generate  gera a partir do schema
pnpm db:studio     # inspeciona o banco      · db:reset  apaga o volume e recria
```

Não existem scripts vazios no `package.json`: `test:e2e` (Playwright) chega na
fase 3a. As categorias padrão não têm `db:seed` — o catálogo vive na migration,
porque o trigger de cadastro depende dele.

## Deploy — Netlify + Neon

A Netlify roda o app (o `netlify.toml` já configura tudo); o banco fica num
Postgres gerenciado — o roteiro abaixo usa o [Neon](https://neon.tech) (free
tier, região AWS São Paulo). Ordem dos passos:

**1. Banco (uma vez).** Crie o projeto no Neon e rode o script que cria as
duas roles da RLS, conectado com a role padrão do projeto (a URL "owner" do
painel):

```bash
psql "postgres://OWNER@ep-xxx.sa-east-1.aws.neon.tech/neondb?sslmode=require" \
  -v auth_password='GERE_UMA_SENHA' \
  -v app_password='GERE_OUTRA_SENHA' \
  -f db/production/setup-roles.sql
```

**2. Migrations.** Com a URL da role `aurum_auth` (host **sem** o pooler, o
sufixo `-pooler` do Neon, porque migration precisa de conexão direta):

```bash
DATABASE_URL="postgres://aurum_auth:SENHA@ep-xxx.sa-east-1.aws.neon.tech/neondb?sslmode=require" \
  pnpm db:migrate
```

**3. Site na Netlify.** "Add new site → Import from Git" apontando para este
repositório. O build é detectado pelo `netlify.toml`. Variáveis de ambiente
(Site settings → Environment variables) — as URLs de runtime usam o host
**com** `-pooler`, que aguenta o paralelismo de funções serverless:

| Variável | Valor |
|---|---|
| `DATABASE_URL` | `postgres://aurum_auth:SENHA@ep-xxx-pooler...` |
| `DATABASE_URL_APP` | `postgres://aurum_app:SENHA@ep-xxx-pooler...` |
| `BETTER_AUTH_SECRET` | `openssl rand -base64 32` — um novo, não o de dev |
| `NEXT_PUBLIC_SITE_URL` | `https://SEU-SITE.netlify.app` (sem barra no fim) |
| `SMTP_URL` | SMTP real — Resend: `smtps://resend:API_KEY@smtp.resend.com:465` |
| `MAIL_FROM` | `Aurum <onboarding@resend.dev>` (ou seu domínio verificado) |

**4. Depois do primeiro deploy:** o endereço final entra em
`NEXT_PUBLIC_SITE_URL` (e um redeploy), e com HTTPS no ar o app vira PWA
instalável — no celular, "Adicionar à tela de início".

O Google OAuth continua opcional: preencha `GOOGLE_CLIENT_ID`/`SECRET` e
cadastre `https://SEU-SITE.netlify.app/api/auth/callback/google` no Google
Cloud Console quando quiser o botão.

---

Projeto pessoal. Não aceita contribuições externas por enquanto.
