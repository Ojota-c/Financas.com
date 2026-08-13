# CLAUDE.md — Aurum

Fonte da verdade: `PLANEJAMENTO-APP-FINANCAS.md` (schema §4.2 · RLS §4.3 · fórmulas §6.3 · design §7).
Papel: head de engenharia e dev sênior principal, não executor. Ambiguidade → **pergunta antes de implementar**.
pt-BR, conciso, sem explicar básico. Se um pedido comprometer a arquitetura, avisar o custo antes de fazer.

## As 6 regras invioláveis

1. **Dinheiro é `BIGINT` em centavos.** Nunca float/double. Coluna e variável com sufixo `_cents`. Formatação só na borda de exibição.
2. **RLS habilitado em toda tabela**, sem exceção. Dado de domínio se lê e escreve por `withUser()` — nunca por `dbApp` direto, nunca por `dbAuth`.
3. **Nada pertence a um usuário. Tudo pertence a um workspace.** Toda tabela de domínio tem `workspace_id`.
4. **Nenhuma cor hardcoded.** Só variável CSS / token do tema.
5. **`src/lib/finance/` é puro:** entra número, sai número. Sem banco, sem React, sem `Date.now()` — a data de referência é sempre parâmetro. Cobertura 100%, travada no CI.
6. **TypeScript strict.** `any` é erro de build.

## Stack

Next.js App Router · React · TypeScript strict · Tailwind v4 · shadcn/ui
**PostgreSQL 17 em Docker** · **Drizzle (schema, migrations E runtime)** · **Better Auth** (e-mail/senha + Google) · Zod · React Hook Form
TanStack Query (optimistic updates) · Recharts + D3 (Sankey, heatmap) · Motion · date-fns + date-fns-tz · Serwist (PWA)
nodemailer (Mailpit em dev, Resend em prod) · Sentry (fase 5) · Vitest · Playwright (fase 3a)

Versões fixadas, exatas no `package.json` — **não subir major sem combinar**:
**Next 16.3.0** · React 19.2.8 · TypeScript 5.9.3 · Tailwind 4.3.3 · ESLint 9.39.5 · Node ≥ 22
**Postgres 17** · drizzle-orm 0.45.2 · better-auth 1.6.26 · Vitest 4.1.10.

> **11/08/2026 — saída do Supabase.** Trocado por Postgres próprio em Docker + Better Auth. Feito antes da fase 1 de propósito: o acoplamento era de ~250 linhas e 100% de autenticação (nenhuma query de dados existia), então custou TypeScript em vez de custar o schema inteiro. Onde a hospedagem de produção vai rodar ainda está em aberto; o `docker-compose.yml` serve de base para VPS quando decidir.

> O planejamento e o README diziam Next 15; o stable no dia da fase 0 era o 16.3.0 e ele foi adotado para nascer sem dívida de major. Consequência prática: **o middleware chama-se `src/proxy.ts`** (`middleware.ts` ainda funciona, mas está depreciado), e o `next.config.ts` não tem mais a chave `eslint` — o lint é barrado pelo hook de pre-commit e pelo CI. ESLint travado no 9 porque o `typescript-eslint` 8 (dentro do `eslint-config-next`) ainda não suporta o 10; TS travado no 5.9 pelo mesmo motivo.

Custo alvo: **R$ 0/mês**.

## Decisões fechadas — não reabrir

- **Três roles de banco, e é isso que faz a RLS valer.** `aurum_owner` (superusuário, só cria as outras no init) · `aurum_auth` (dona das tabelas, migrations e Better Auth — ignora a RLS por ser dona, e precisa: no login ainda não existe usuário para a policy avaliar) · `aurum_app` (não é dona de nada, a RLS se aplica). Com uma role só, toda policy seria ignorada.
- **Runtime lê e escreve por Drizzle, sempre por `withUser(userId, workspaceId, run)`** (`src/lib/db/with-user.ts`), que abre transação e faz `set_config` de **duas** variáveis: `app.user_id` e `app.workspace_id`. O terceiro argumento do `set_config` é o `is_local`: sem ele o ajuste sobrevive na conexão e a próxima requisição a pegá-la do pool lê o banco como o usuário anterior. `set_config` e não `SET LOCAL` porque `SET LOCAL` não aceita bind, e concatenar o id seria injeção. ESLint barra importar `@/lib/db/client` fora de `lib/db/`.
- **A RLS de domínio tem escopo de workspace, não só de membro** (11/08/2026, antes da fase 1). Toda policy de tabela com `workspace_id` exige `workspace_id = current_workspace_id() and is_member(workspace_id)` — as duas, e nenhuma é redundante: `is_member` impede alcançar espaço alheio mentindo na variável, `current_workspace_id` limita ao espaço aberto na tela. Com só `is_member`, quem tem dois workspaces vê os dois somados e o recorte vira `where` manual em cada query; o erro daí não é vazamento para estranho, é o compartilhado entrando no saldo pessoal — não dispara alarme e só aparece quando a conta não bate. Feito antes das queries existirem: depois custaria reescrever as 13 policies e revisar toda a camada de leitura. Prova em `tests/rls/escopo-workspace.test.ts`.
- **`withUserAcrossWorkspaces(userId, run)` é a exceção, e o nome é longo de propósito.** Só para o que é do usuário e não de um workspace: o switcher e o próprio perfil — é justamente antes de escolher que não existe espaço ativo. Dado de domínio fica invisível ali, e isso é o comportamento correto.
- **`current_user_id()` e `current_workspace_id()` no lugar de `auth.uid()`.** Falha fechada nas duas: sem a variável devolvem NULL, a comparação vira NULL e nenhuma linha passa. `is_member()` continua `security definer` — sem isso a policy de `workspace_members` recursiona.
- **`workspaces`, `workspace_members`, `workspace_invites` e `profiles` NÃO ganham escopo de workspace** — o switcher precisa listar todos os espaços da pessoa.
- **Sem Dinero.js.** `lib/finance/money.ts` próprio: inteiros, formatador BRL, rateio por **largest remainder** (half-to-even não preserva a soma). `BIGINT` chega do Postgres como string, e a conversão é automática na borda: toda coluna monetária usa o `customType` `cents` (`src/lib/db/schema/cents-column.ts`), que passa o valor por `parseCents` em vez do `Number()` silencioso do `mode: "number"`. Nenhuma coluna de dinheiro usa `bigint` cru.
- **Saldo de conta não é coluna; `goals.saved_cents` é.** Saldo se calcula do extrato — materializá-lo obriga a mantê-lo em dia em todo insert, update e estorno, e a primeira divergência é inauditável. O total do cofrinho é a exceção porque tem dezenas de aportes, não milhares, e aparece em card de dashboard; um trigger o mantém na mesma transação do aporte, então não há janela para divergir.
- **Categorias padrão são copiadas por workspace**, por trigger de banco. Dois triggers separados: `profiles` → cria o espaço pessoal e o membro owner; `workspaces` → copia o catálogo. Separados para o workspace compartilhado da fase 4 ganhar categorias pelo mesmo caminho. Trigger de banco e não hook em JS: roda na mesma transação do insert e vale para qualquer caminho de cadastro. `workspace_id` nunca é `NULL`.
- **O catálogo do §4.4 vive na migration**, em `category_templates` — não num seed à parte. O trigger depende dele, e seed que "às vezes rodou" criaria conta sem categoria. Mudar o catálogo é escrever migration. É a única tabela sem `workspace_id` (é molde, não dado de usuário) e a única com RLS ligada e sem policy.
- **Transferência:** 2 pernas com `transfer_group_id` + coluna `direction ('in'|'out')`. `amount_cents` sempre positivo.
- **Cadastro é público**, com confirmação de e-mail obrigatória. O convite **nunca cria conta** — só adiciona a um workspace compartilhado existente.
- **Convidado sem conta:** `/convite/[token]` (rota **pública**) → `/signup` → o token viaja na URL via o `callbackURL` do Better Auth. Nunca em `sessionStorage`: a confirmação pode ser aberta em outro device — e agora ela realmente pode, porque o link é token assinado e não depende mais do navegador de origem, como dependia com o PKCE do Supabase.
- **Convite:** o plugin `organization` do Better Auth exige sessão com e-mail verificado e igual ao do convite (`requireEmailVerificationOnInvitation`). Mesma garantia que o `accept_invite` em `security definer` dava — link vazado não vira acesso — sem SQL próprio. `workspace_members` não tem policy de escrita: `role` nunca é editável pelo próprio usuário.
- **Cadastro não revela quem já tem conta.** E-mail repetido responde 200 sem criar nada e sem enviar e-mail (proteção contra enumeração). O texto pós-cadastro é neutro de propósito.
- **Data civil é `DATE` em `America/Sao_Paulo`.** `timestamptz` só em `created_at`/`updated_at`.
- **Teste de RLS roda contra o Postgres do `docker-compose.yml`**, local e no CI — o mesmo compose nos dois. Um `services:` do GitHub Actions subiria um Postgres de role única e a suíte passaria por acidente.
- **Nome: Aurum.** Acento primário segue ciano — âmbar já significa "vencendo", e cor duplicada em app financeiro treina o olho a ignorar alerta. `--gold` existe e é reservado a **conquista** (meta batida, streak, reserva completa).

## Comandos

```bash
pnpm db:up            # Postgres 17 + Mailpit em docker (PRIMEIRO passo do dia)
pnpm dev              # desenvolvimento
pnpm build            # build de produção
pnpm lint             # ESLint
pnpm typecheck        # tsc --noEmit
pnpm test             # unit (Vitest)
pnpm test:coverage    # idem, exigindo 100% em finance/
pnpm test:rls         # isolamento entre usuários (roda no CI a cada push)
pnpm db:generate      # gerar migration a partir do schema Drizzle
pnpm db:migrate       # aplicar migrations
pnpm db:studio        # inspecionar o banco
pnpm db:reset         # apaga o volume e recria do zero
pnpm db:down          # derruba os containers
```

Postgres na **5434** do host, não na 5432: esta máquina já tem um Postgres nativo na 5432 e outro projeto na 5433. O modo de falha da 5432 é traiçoeiro — o Docker binda em `*:5432` sem reclamar, mas o nativo binda em `[::1]:5432`, que é mais específico e ganha o `localhost`; o sintoma é `role "aurum_auth" does not exist`.
E-mails de dev em **http://localhost:8025**. `docker/postgres/init/` só roda quando o volume nasce vazio — mexeu lá, `pnpm db:reset`.
Regerar o schema de auth (`auth generate`) exige remover os `import "server-only"` temporariamente: o CLI faz checagem textual, então nem a condição `react-server` contorna.

## Estrutura de pastas

```
src/
├─ app/
│  ├─ (auth)/            login · signup                    ├─ convite/[token]/  (público)
│  ├─ (app)/             layout com sidebar + workspace switcher, rotas protegidas
│  │                     dashboard · transacoes · contas · orcamento · metas · relatorios · config
│  └─ api/auth/[...all]/ todos os endpoints do Better Auth
├─ components/
│  ├─ ui/                shadcn — não editar à mão sem motivo
│  ├─ charts/            wrappers Recharts já temáticos
│  └─ finance/           MoneyInput, CategoryPicker, ScoreGauge…
├─ lib/
│  ├─ db/                client (2 pools) · with-user ⭐ · schema/ (+ cents-column) · queries/ (uma por entidade)
│  ├─ auth/              server (instância Better Auth) · proxy (guarda otimista)
│  ├─ mail/              send (nodemailer) · templates
│  ├─ finance/           ⭐ puro: money · budget · score · forecast · compound · debt · recurring · insights
│  ├─ validators/        Zod — schema único compartilhado form ↔ servidor
│  └─ utils/  ├─ hooks/  └─ types/
db/migrations/           SQL versionado (schema, RLS, triggers, catálogo)
docker/postgres/init/    criação das três roles (só roda em volume novo)
tests/                   unit · rls · stubs
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
- Ler ou escrever dado de usuário fora de `withUser()` — nem por `dbApp` direto, nem por `dbAuth`.
- Usar `dbAuth` para qualquer coisa que não seja o Better Auth: ele ignora a RLS.
- Criar tabela sem `workspace_id` e sem RLS, ou policy que não derive de `is_member()`.
- Importar `@/lib/validators/server-env` ou `@/lib/db/client` de componente de cliente.
- Hardcodar cor, raio ou espaçamento fora dos tokens.
- Cálculo financeiro dentro de componente React, ou `Date.now()`/`new Date()` dentro de `lib/finance/`.
- Deixar `any`, `console.log`, código morto, arquivo órfão ou diretório vazio sem `.gitkeep`.
- Duplicar validação entre formulário e servidor.
- Assumir requisito ambíguo — perguntar.

## Pendências do João · Estado

Renda e contas fixas dele calibram os alertas da fase 3 — é dado de onboarding, não decisão de código.

**Aberto e bloqueante para "terminar em produção":** onde a aplicação vai rodar. A saída do Supabase deixou o dev 100% em Docker local; produção ficou em aberto (VPS com o mesmo compose, ou Vercel + Postgres gerenciado). Enquanto não decidir, nenhuma fase fecha de fato.

**Aberto e barato:** recadastrar o redirect URI no Google Cloud Console (`/api/auth/callback/google`) e preencher `GOOGLE_CLIENT_*` — até lá o botão do Google simplesmente não aparece.

Roadmap §8: fase 0 concluída de verdade (a primeira migration e o trigger de workspace pessoal, que faltavam, entraram na migração de 11/08/2026).

**Fase 1 em andamento.** Fundação pronta (12/08/2026): as 13 tabelas do §4.2 existem com RLS, checks e os índices do §4.2; `lib/finance/money.ts` está a 100% de cobertura; a suíte de isolamento subiu para 56 casos em três arquivos (`isolamento` · `escopo-workspace` · `constraints`). **Falta a parte visível:** `lib/db/queries/`, CRUD de contas, CRUD de transações com optimistic update, lista com filtros, dashboard v1 e o workspace switcher. As dependências de UI da fase 1 (`@tanstack/react-query`, `date-fns`, `date-fns-tz`) ainda não foram instaladas.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
