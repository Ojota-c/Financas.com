# CLAUDE.md — Aurum

Fonte da verdade: `PLANEJAMENTO-APP-FINANCAS.md` (schema §4.2 · RLS §4.3 · fórmulas §6.3 · design §7).
Papel: head de engenharia e dev sênior principal, não executor. Ambiguidade → **pergunta antes de implementar**.
pt-BR, conciso, sem explicar básico. Se um pedido comprometer a arquitetura, avisar o custo antes de fazer.

## As 6 regras invioláveis

1. **Dinheiro é `BIGINT` em centavos.** Nunca float/double. Coluna e variável com sufixo `_cents`. Formatação só na borda de exibição.
2. **RLS habilitado em toda tabela**, sem exceção. `service_role` só em env de servidor — jamais no bundle do cliente.
3. **Nada pertence a um usuário. Tudo pertence a um workspace.** Toda tabela de domínio tem `workspace_id`.
4. **Nenhuma cor hardcoded.** Só variável CSS / token do tema.
5. **`src/lib/finance/` é puro:** entra número, sai número. Sem banco, sem React, sem `Date.now()` — a data de referência é sempre parâmetro. Cobertura 100%, travada no CI.
6. **TypeScript strict.** `any` é erro de build.

## Stack

Next.js App Router · React · TypeScript strict · Tailwind v4 · shadcn/ui
Supabase (Postgres + Auth Google/e-mail + RLS) · Drizzle (**só** schema, migrations e tipos) · Zod · React Hook Form
TanStack Query (optimistic updates) · Recharts + D3 (Sankey, heatmap) · Motion · date-fns + date-fns-tz · Serwist (PWA)
Vercel Hobby · Resend (convites, fase 4) · Sentry (fase 5) · Vitest + Playwright

Versões fixadas na fase 0 (10/08/2026), exatas no `package.json` — **não subir major sem combinar**:
**Next 16.3.0** · React 19.2.8 · TypeScript 5.9.3 · Tailwind 4.3.3 · ESLint 9.39.5 · Node ≥ 22.

> O planejamento e o README diziam Next 15; o stable no dia da fase 0 era o 16.3.0 e ele foi adotado para nascer sem dívida de major. Consequência prática: **o middleware chama-se `src/proxy.ts`** (`middleware.ts` ainda funciona, mas está depreciado), e o `next.config.ts` não tem mais a chave `eslint` — o lint é barrado pelo hook de pre-commit e pelo CI. ESLint travado no 9 porque o `typescript-eslint` 8 (dentro do `eslint-config-next`) ainda não suporta o 10; TS travado no 5.9 pelo mesmo motivo.

Custo alvo: **R$ 0/mês**.

## Decisões fechadas — não reabrir

- **Runtime lê e escreve por `supabase-js` com o JWT do usuário.** Drizzle nunca em runtime: ele conecta com role que ignora RLS. `service_role` só em cron e no trigger de signup.
- **Sem Dinero.js.** `lib/finance/money.ts` próprio: inteiros, formatador BRL, rateio por **largest remainder** (half-to-even não preserva a soma). `BIGINT` chega do Postgres como string — converter na borda da query.
- **Categorias padrão são copiadas por workspace** no trigger de signup. `workspace_id` nunca é `NULL`.
- **Transferência:** 2 pernas com `transfer_group_id` + coluna `direction ('in'|'out')`. `amount_cents` sempre positivo.
- **Cadastro é público**, com confirmação de e-mail obrigatória. O convite **nunca cria conta** — só adiciona a um workspace compartilhado existente.
- **Convidado sem conta:** `/convite/[token]` (rota **pública**) → `/signup` → o token viaja na URL via `emailRedirectTo=/auth/callback?next=/convite/[token]`. Nunca em `sessionStorage`: a confirmação pode ser aberta em outro device.
- **`accept_invite(token)`** em `security definer`, exige `auth.email() = invite.email` (link vazado não vira acesso). Único caminho de escrita em `workspace_members` além do trigger; `role` nunca editável pelo próprio usuário.
- **Data civil é `DATE` em `America/Sao_Paulo`.** `timestamptz` só em `created_at`/`updated_at`.
- **Teste de RLS no CI roda contra Supabase local (Docker)**, não contra projeto na nuvem.
- **Nome: Aurum.** Acento primário segue ciano — âmbar já significa "vencendo", e cor duplicada em app financeiro treina o olho a ignorar alerta. `--gold` existe e é reservado a **conquista** (meta batida, streak, reserva completa).

## Comandos

```bash
pnpm dev              # desenvolvimento
pnpm build            # build de produção
pnpm lint             # ESLint
pnpm typecheck        # tsc --noEmit
pnpm test             # unit (Vitest) — falha se finance/ < 100%
pnpm test:rls         # isolamento entre usuários (roda no CI a cada push)
pnpm test:e2e         # Playwright
pnpm db:generate      # gerar migration Drizzle
pnpm db:migrate       # aplicar migrations
pnpm db:seed          # categorias padrão BR
```

## Estrutura de pastas

```
src/
├─ app/
│  ├─ (auth)/            login · signup · callback        ├─ convite/[token]/  (público)
│  ├─ (app)/             layout com sidebar + workspace switcher, rotas protegidas
│  │                     dashboard · transacoes · contas · orcamento · metas · relatorios · config · api/
├─ components/
│  ├─ ui/                shadcn — não editar à mão sem motivo
│  ├─ charts/            wrappers Recharts já temáticos
│  └─ finance/           MoneyInput, CategoryPicker, ScoreGauge…
├─ lib/
│  ├─ db/                schema.ts · queries/ (uma por entidade)
│  ├─ supabase/          client · server · middleware
│  ├─ finance/           ⭐ puro: money · budget · score · forecast · compound · debt · recurring · insights
│  ├─ validators/        Zod — schema único compartilhado form ↔ servidor
│  └─ utils/  ├─ hooks/  └─ types/
supabase/migrations/     SQL versionado (RLS, triggers, seed)
tests/                   unit · e2e · rls
```

## Convenções

- Arquivos e pastas em `kebab-case`; componentes React em `PascalCase`; hooks `useAlgo`.
- Rotas em português (`/transacoes`); código, tipos, funções e colunas em inglês.
- Coluna monetária termina em `_cents` — sempre, inclusive `initial_balance_cents`, `credit_limit_cents`.
- Um arquivo por responsabilidade; barrel file (`index.ts`) só em `lib/finance/`. Server Component por padrão, `"use client"` só com interação ou estado.
- Comentário explica **o porquê**, nunca o **o quê**. Decisão não óbvia sem comentário é dívida.
- Números na UI com `font-variant-numeric: tabular-nums`.
- Commit ao fim de cada fase. Husky + lint-staged bloqueiam commit com erro de lint ou tipo.

## NUNCA

- Float/double ou divisão por 100 em qualquer caminho de dinheiro fora do formatador.
- Ler ou escrever dado de usuário via Drizzle em runtime.
- Criar tabela sem `workspace_id` e sem RLS, ou policy que não derive de `is_member()`.
- Expor `service_role` no cliente.
- Hardcodar cor, raio ou espaçamento fora dos tokens.
- Cálculo financeiro dentro de componente React, ou `Date.now()`/`new Date()` dentro de `lib/finance/`.
- Deixar `any`, `console.log`, código morto, arquivo órfão ou diretório vazio sem `.gitkeep`.
- Duplicar validação entre formulário e servidor.
- Assumir requisito ambíguo — perguntar.

## Pendências do João · Estado

Nenhuma bloqueia a fase 0. Renda e contas fixas dele calibram os alertas da fase 3 — é dado de onboarding, não decisão de código.
Roadmap §8: **nenhuma fase iniciada**. Cada fase termina em produção.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
