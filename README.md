# Aurum

App de finanças pessoais. Web responsivo + PWA instalável, com espaço pessoal privado e espaço compartilhado por convite.

> **Status:** fase 0 concluída — autenticação e rotas protegidas no ar.

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

Next.js 16 (App Router) · React 19 · TypeScript strict · Tailwind v4 · shadcn/ui · Supabase (Postgres + Auth + RLS) · Drizzle · Zod · TanStack Query · Recharts + D3 · Motion · Serwist (PWA) · Vercel

Custo alvo de operação: **R$ 0/mês** no free tier.

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

Pré-requisitos: Node 20+, pnpm, conta na Vercel e no Supabase (projeto na região São Paulo).

```bash
pnpm install
cp .env.example .env.local     # preencher com as chaves do Supabase
pnpm dev
```

## Comandos

```bash
pnpm dev           # desenvolvimento
pnpm build         # build de produção
pnpm lint          # ESLint
pnpm typecheck     # tsc --noEmit
pnpm format        # Prettier
```

Os comandos de banco (`db:generate`, `db:migrate`, `db:seed`) chegam na fase 1,
com o schema. Os de teste (`test`, `test:rls`, `test:e2e`) chegam na fase 1 (RLS)
e na 3a (motor financeiro) — não existem scripts vazios no `package.json`.

---

Projeto pessoal. Não aceita contribuições externas por enquanto.
