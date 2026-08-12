# Prompts para o Claude Code — Projeto Aurum

**Como usar:** cole **um bloco por vez**, na ordem. Espere terminar, teste, faça commit, e só então cole o próximo. Nunca cole dois de uma vez — é isso que economiza token e evita que o modelo se perca.

**Antes de começar:** salve o `PLANEJAMENTO-APP-FINANCAS.md` na raiz do projeto. Todos os prompts abaixo apontam pra ele em vez de repetir o conteúdo — é assim que você não gasta contexto à toa.

> **⚠️ Desatualizado a partir do PROMPT 1.** Em 11/08/2026 o Supabase saiu e
> entraram PostgreSQL 17 em Docker e Better Auth. O prompt da fase 0 abaixo é
> registro histórico — a fase 0 já está concluída e o que ele descreve (cliente
> Supabase nos 3 contextos, middleware do Supabase) não existe mais.
> Os prompts das fases seguintes precisam ser reescritos antes de usar:
> não há mais `service_role`, `auth.uid()` nem `supabase-js`, e toda query de
> domínio passa por `withUser()`. **Leia o `CLAUDE.md` antes de colar qualquer
> prompt daqui.**

---

## PROMPT 0 — Contexto permanente (rode uma vez só, no projeto vazio)

```
Você vai atuar neste projeto como HEAD DE ENGENHARIA DE SOFTWARE e DEV SÊNIOR
principal. Não como assistente que só executa pedido.

O que isso significa na prática:
- Você é o dono da arquitetura. Se eu pedir algo que compromete a estrutura,
  você me diz antes de fazer, explica o custo e propõe a alternativa correta.
- Estrutura de pastas, nomenclatura e separação de camadas são IMPECÁVEIS e
  consistentes do primeiro ao último arquivo. Nada de "depois a gente organiza".
- Zero código morto, zero arquivo órfão, zero `any` em TypeScript,
  zero `console.log` esquecido.
- Toda decisão não óbvia vira um comentário curto explicando O PORQUÊ,
  nunca o "o quê" (o código já diz o quê).
- Se algo estiver ambíguo, você PERGUNTA antes de implementar.
  Não invente requisito, não assuma. Prefira uma pergunta a um retrabalho.

Leia agora o arquivo PLANEJAMENTO-APP-FINANCAS.md na raiz. Ele é a fonte da
verdade do projeto: stack, modelo de dados, segurança, features, design system,
roadmap e estrutura de pastas. Você vai segui-lo.

Depois de ler, crie um CLAUDE.md na raiz contendo, de forma ENXUTA
(máximo 100 linhas, é lido a cada sessão):
- stack e versões
- comandos (dev, build, lint, test, migration)
- as 6 regras invioláveis do projeto
- convenções de nomenclatura e estrutura de pastas
- o que NUNCA fazer

As 6 regras invioláveis, que valem para tudo que você escrever daqui pra frente:
1. Dinheiro é sempre BIGINT em centavos. Nunca float, nunca double.
   Formatação só na borda de exibição.
2. RLS habilitado em TODA tabela, sem exceção. A chave service_role
   jamais toca o cliente.
3. Nada pertence a um usuário. Tudo pertence a um workspace.
   Toda tabela de domínio tem workspace_id.
4. Nenhuma cor hardcoded. Tudo via variável CSS / token do tema.
5. src/lib/finance/ é função pura: entra número, sai número.
   Sem banco, sem React, sem Date.now() — a data é sempre parâmetro.
   Cobertura de teste de 100% nessa pasta.
6. TypeScript strict. `any` é erro de build.

Não escreva código de feature ainda. Só leia, crie o CLAUDE.md, e me diga
se encontrou alguma inconsistência ou risco no planejamento que eu deveria
resolver antes de começar.
```

---

## PROMPT 1 — Fase 0: Fundação e deploy

```
FASE 0 do roadmap (PLANEJAMENTO-APP-FINANCAS.md, seção 8).
Objetivo: projeto no ar, com login funcionando, e uma tela vazia autenticada.

Escopo — só isto, nada além:
1. Next.js 15 (App Router) + React 19 + TypeScript strict + Tailwind v4
2. shadcn/ui inicializado com o tema dark da seção 7 do planejamento,
   todos os tokens como variáveis CSS
3. ESLint + Prettier + Husky + lint-staged (bloqueia commit com erro de lint/tipo)
4. Cliente Supabase nos 3 contextos: browser, server component e middleware
5. Auth: Google OAuth + e-mail/senha. Telas /login e /signup com o visual do
   design system, não com o padrão feio do shadcn
6. Middleware protegendo o grupo de rotas (app)
7. Estrutura de pastas EXATA da seção 9 do planejamento, com os diretórios
   já criados (mesmo vazios, com .gitkeep)
8. .env.example documentado

Não faça agora: schema do banco, tabelas, transações, dashboard.
Isso é a Fase 1.

Ao final: liste os passos manuais que EU preciso executar
(criar projeto Supabase, configurar OAuth no Google Cloud, variáveis na Vercel),
em ordem, com o caminho exato de cada tela.
```

---

## PROMPT 2 — Fase 1a: Schema, RLS e o teste de isolamento

```
FASE 1, parte A. A parte mais crítica do projeto inteiro — se isso sair errado,
os dados financeiros de uma pessoa vazam pra outra.

1. Schema Drizzle completo conforme a seção 4.2 do planejamento.
   Todas as tabelas, todos os campos, todos os índices da seção 4.2.
   Enums do Postgres para os campos de domínio fechado.

2. Migration SQL com:
   - função is_member(uuid) exatamente como na seção 4.3
     (security definer + set search_path — sem isso entra em recursão infinita)
   - RLS habilitado em TODAS as tabelas
   - políticas de select/insert/update/delete em cada tabela com workspace_id
   - trigger on auth.users insert que cria o profile E o workspace pessoal
     E a linha em workspace_members com role 'owner'
   - seed de categorias padrão brasileiras, cada uma com bucket
     needs/wants/savings preenchido

3. Camada de queries tipada em src/lib/db/queries/, uma por entidade.

4. TESTE DE ISOLAMENTO (obrigatório, não é opcional):
   cria usuário A e usuário B, cada um com dados. Loga como A e tenta ler,
   editar e deletar tudo de B — transactions, budgets, goals, accounts,
   categories, workspace_members. Espera ZERO linhas e erro de permissão
   em toda tentativa. Esse teste roda no CI a cada push.

Antes de escrever qualquer coisa, me mostre o schema proposto em texto
e espere eu aprovar. Não gere migration sem meu OK — migration errada
depois de ter dado é dor de cabeça.
```

---

## PROMPT 3 — Fase 1b: Lançamentos e dashboard

```
FASE 1, parte B. O núcleo utilizável.

1. CRUD de contas (accounts), incluindo cartão de crédito com
   dia de fechamento e vencimento
2. CRUD de categorias em árvore de 2 níveis
3. CRUD de transações:
   - receita, despesa e transferência (transferência gera 2 pernas
     unidas por transfer_group_id)
   - componente MoneyInput que trabalha em centavos internamente
     e nunca deixa float entrar
   - validação Zod compartilhada entre formulário e servidor
   - optimistic update com TanStack Query
   - meta de UX: lançar em MENOS DE 5 SEGUNDOS no celular.
     Bottom sheet, teclado numérico direto, categoria sugerida pelo histórico
     da descrição, data padrão hoje. Se ficar mais lento que isso, refaça.
4. Lista de transações com filtro por período, conta, categoria e busca
5. Dashboard v1: saldo consolidado, receita e despesa do mês,
   últimos lançamentos
6. Seletor de workspace no header (por ora só o pessoal aparece)

Layout responsivo de verdade desde já, conforme seção 7:
bottom tab bar + FAB no mobile, sidebar + grid no desktop.

Ao terminar, rode o teste de isolamento de novo e me confirme que passou.
```

---

## PROMPT 4 — Fase 2: Contas a pagar, recorrentes e orçamento

```
FASE 2 do roadmap.

1. Recorrências: tabela recurring_rules + job que gera as ocorrências.
   Suporta auto_post (lança sozinho) ou pendente pra confirmação.
2. Parcelamento: "12x de R$ 250" gera 12 transações com
   installment_no / installment_total.
3. Contas a pagar: são transactions com status='pending' e due_date.
   NÃO crie tabela nova. Tela dedicada com semáforo —
   vencido / vence em ≤3 dias / futuro. Marcar como pago via swipe no mobile.
4. Faturas de cartão de crédito. ATENÇÃO, é o ponto que mais apps erram
   no Brasil: a compra entra no mês de COMPETÊNCIA da fatura
   (campo competence_date), não na data da compra. Compra depois do
   fechamento cai na fatura seguinte. Implemente e escreva teste
   pra virada de fatura.
5. Orçamento por categoria: teto mensal, barra de progresso,
   rollover opcional, alerta em 80% e 100%.

Toda a lógica de data de fatura, recorrência e orçamento vai em
src/lib/finance/ como função pura, com teste unitário.
Nenhum cálculo dentro de componente React.
```

---

## PROMPT 5 — Fase 3a: Motor financeiro (só cálculo, sem UI)

```
FASE 3, parte A. Nenhuma linha de UI neste prompt — só o motor.

Implemente src/lib/finance/ com as fórmulas da seção 6.3 do planejamento:

money.ts     — aritmética em centavos, formatação BRL, bankers rounding
budget.ts    — 50/30/20 via bucket, aderência ao orçamento, rollover
score.ts     — Score de Saúde Financeira 0–100 com os 5 componentes
               e pesos da seção 5.2, retornando o detalhamento
forecast.ts  — safe-to-spend diário, projeção de fim de mês, runway
compound.ts  — juros compostos, aporte de série, regra de 72,
               número da independência financeira, custo de oportunidade
debt.ts      — avalanche vs bola de neve, com cronograma de quitação
               e comparativo de juros economizados
insights.ts  — gastos formiga, curva ABC/Pareto, radar de assinaturas
               (detecção de recorrência e variação de preço),
               inflação pessoal, custo em horas de trabalho

Regras: função pura, sem import de React, sem acesso a banco,
sem Date.now() — a data de referência é sempre parâmetro.
100% de cobertura de teste, incluindo casos de borda:
divisão por zero, mês com 28/29/31 dias, renda zero, valor negativo,
período sem nenhuma transação.

Me mostre a assinatura de todas as funções antes de implementar.
```

---

## PROMPT 6 — Fase 3b: Metas e visualização

```
FASE 3, parte B. Agora a UI em cima do motor da parte A.

1. Metas / cofrinhos: CRUD, barra de progresso, aporte mensal sugerido,
   data projetada de conclusão no ritmo atual, e sinking funds
   (dividir despesa anual conhecida em aportes mensais)
2. Dashboard v2, com o número herói Safe-to-Spend em destaque,
   Score de Saúde em gauge circular animado, e Runway em meses
3. Gráficos, todos em src/components/charts/ com wrapper temático:
   - donut de gastos por categoria
   - barras de receita vs despesa mês a mês
   - linha de evolução do saldo
   - heatmap anual estilo GitHub
   - Sankey de fluxo de renda (D3)
4. Painéis de insight: gastos formiga, curva ABC, radar de assinaturas
5. Simulador "e se" com sliders ao vivo e projeção em 1, 5 e 10 anos

Visual conforme seção 7: gradiente vertical nos preenchimentos, glow sutil
só na série ativa, grade quase invisível, tooltip em vidro,
tabular-nums em todo número, count-up ao mudar de valor.
Neon com PARCIMÔNIA — se tudo brilha, nada brilha.

Respeite prefers-reduced-motion e garanta contraste 4.5:1.
```

---

## PROMPT 7 — Fase 4: Workspace compartilhado

```
FASE 4 do roadmap. A parte que a arquitetura de workspace já preparou —
se a Fase 1 foi bem feita, aqui quase não há lógica nova.

1. Criar workspace compartilhado (nome, ícone, cor)
2. Convite por e-mail via Resend: token uuid, expira em 7 dias,
   status pending/accepted/revoked/expired
3. Página /convite/[token]: aceitar ou recusar, funcionando tanto pra
   quem já tem conta quanto pra quem precisa criar
4. Papéis e permissões: owner / admin / member / viewer,
   aplicados nas policies de RLS, não só na UI
5. Avatar de "quem lançou" em cada transação do workspace compartilhado
6. Flag shared_visible: lançamento pessoal pode entrar no consolidado
   sem expor o detalhe pro grupo
7. Audit log das alterações
8. Seletor de workspace no header, agora com múltiplas opções e
   troca de contexto instantânea

Reforce o teste de isolamento: agora precisa cobrir também
"membro de um workspace compartilhado NÃO vê o workspace pessoal
dos outros membros". Esse é o caso mais importante do app inteiro.
```

---

## PROMPT 8 — Fase 5: PWA e produção

```
FASE 5. Acabamento pra convidar gente de verdade.

1. PWA com Serwist: manifest, ícones em todos os tamanhos,
   splash screen, estratégia de cache offline (stale-while-revalidate
   nos dados, cache-first nos assets)
2. Push notification de vencimento de conta
3. Onboarding guiado: escolher método de orçamento (50/30/20, base zero,
   envelopes, pagar-se primeiro), cadastrar contas iniciais,
   definir renda mensal
4. Command palette (Cmd/Ctrl+K) com navegação, busca e criação rápida
   por linguagem natural: "50 mercado" cria a despesa
5. Modo privacidade: um toque borra todos os valores da tela
6. Exportar CSV e PDF
7. Sentry configurado
8. GitHub Action de backup semanal: pg_dump cifrado
9. Cron diário na Vercel batendo num healthcheck
   (impede o Supabase de pausar por inatividade)
10. Lighthouse ≥ 90 em performance, acessibilidade, best practices e SEO

Ao final, faça uma AUDITORIA COMPLETA como head de engenharia e me entregue
um relatório honesto:
- código morto, duplicação, inconsistência de nomenclatura
- qualquer `any` que tenha escapado
- queries sem índice ou com risco de N+1
- pontos onde float pode ter entrado em cálculo de dinheiro
- tabela sem RLS ou policy frouxa
- o que você faria diferente se recomeçasse hoje

Seja duro. Prefiro ouvir agora do que descobrir com o app cheio de gente.
```

---

## Dicas pra gastar menos token

- **Uma fase por sessão.** Terminou a fase, `/clear`, começa a próxima limpa. Contexto longo é o que mais custa.
- **O `CLAUDE.md` é lido toda sessão** — deixe-o curto e afiado. Se passar de 100 linhas, você está pagando por ele em cada mensagem.
- **Aponte pro arquivo, não cole o conteúdo.** "conforme a seção 4.2 do planejamento" custa 8 tokens; colar o schema custa 800.
- **Peça o plano antes do código** nas fases 2 e 5 (schema e migration). Corrigir um plano é barato, corrigir 20 arquivos não.
- **Commit no fim de cada prompt.** Se algo der errado, `git reset` é grátis; pedir pro modelo desfazer, não.
- Use `/compact` quando a sessão esticar, em vez de deixar o contexto crescer sozinho.
