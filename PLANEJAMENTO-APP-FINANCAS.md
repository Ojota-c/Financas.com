# Aurum — Planejamento e Estruturação

> App de finanças pessoais. Web + PWA, multiusuário, com espaço pessoal privado e espaço compartilhado por convite.
> Documento mestre de planejamento. Versão 1 — 10/08/2026.
> *(Aurum = "ouro" em latim. Nome provisório, trocável.)*

> ### ⚠️ Leia antes: a infraestrutura mudou em 11/08/2026
>
> O **Supabase saiu**. No lugar: **PostgreSQL 17 em Docker** e **Better Auth**
> rodando dentro do próprio Next. A decisão foi tomada antes da fase 1 de
> propósito — o acoplamento era de ~250 linhas e 100% de autenticação, sem
> nenhuma query de dados escrita, então custou TypeScript em vez de custar o
> schema inteiro.
>
> **O produto, as fórmulas (§6.3), o design (§7) e o roadmap (§8) valem como
> estão.** O que ficou desatualizado é infraestrutura: a tabela de peças (§2), os
> riscos ligados ao free tier (§3), a estrutura de pastas (§9), parte das
> decisões (§10) e as referências (§11). §4.2 e §4.3 já foram atualizados e
> trazem nota própria.
>
> Para o estado atual da stack e das decisões, **`CLAUDE.md` é a fonte da
> verdade**.

---

## 1. Decisões já fechadas

| Tema | Decisão |
|---|---|
| Nível técnico | Avançado / dev — stack moderna, TypeScript, sem no-code |
| Plataforma | **PWA** — um código só, roda no PC e instala no celular |
| Orçamento | **R$ 0/mês** — free tier em tudo na V0 |
| Entrada de dados | **Manual rápido** (3 toques). Open Finance fica pra depois |
| Login | **Google (1 toque) + e-mail/senha** |
| Multiusuário | Espaço **pessoal privado** + espaço **compartilhado por convite** |
| Escopo V0 | Lançamentos+categorias, contas a pagar/recorrentes, orçamento por categoria, metas/reservas |
| Visual | Minimalista high-tech (estilo Linear/Vercel) **+** dark neon com painéis de vidro |

---

## 2. Stack definida

### Por que essa e não outra

O critério foi: free tier de verdade, um repositório só, TypeScript ponta a ponta, e **segurança de isolamento no banco e não no código** — porque quando são amigos e familiares na mesma base, um `where user_id = ?` esquecido em uma query vaza a vida financeira de alguém. Isso não pode depender de eu lembrar.

### As peças

| Camada | Escolha | Motivo |
|---|---|---|
| Framework | **Next.js 15 (App Router)** + React 19 | Server Components = menos JS no celular. Rotas de API no mesmo repo. Deploy nativo na Vercel |
| Linguagem | **TypeScript** (strict) | Dinheiro com tipo errado é bug caro |
| Estilo | **Tailwind CSS v4** + **shadcn/ui** | shadcn dá componentes acessíveis que eu **controlo o código** — dá pra deixar futurista sem lutar com a biblioteca |
| Banco | **Supabase (Postgres)** | Postgres de verdade + **Row Level Security**. Free: 500 MB DB, 1 GB storage, 5 GB egress |
| Auth | **Supabase Auth** | Google OAuth + e-mail/senha prontos. Free: **50.000 usuários ativos/mês** — folga absurda |
| Segurança dos dados | **RLS (Row Level Security)** | O isolamento vive no banco. Query errada retorna zero linhas, não os dados do vizinho |
| ORM / queries | **Drizzle ORM** (schema + migrations) + client Supabase para leitura com RLS | Drizzle gera tipos a partir do schema. Migrations versionadas no git |
| Validação | **Zod** | Um schema Zod valida o formulário e o servidor |
| Formulários | **React Hook Form** + resolver Zod | Rápido, sem re-render desnecessário |
| Estado servidor | **TanStack Query** | Cache, refetch, e **optimistic updates** — o lançamento aparece na tela antes do servidor responder. É isso que dá sensação de app nativo |
| Gráficos | **Recharts** (base) + **D3** pontual (Sankey, heatmap) | Recharts é declarativo e aceita gradiente/glow SVG. D3 só onde Recharts não chega |
| Animação | **Motion** (ex-Framer Motion) | Transições de número, entrada de cards, gestos no mobile |
| Datas | **date-fns** + `date-fns-tz` | Leve, tree-shakeable, locale pt-BR |
| Dinheiro | **Dinero.js** ou inteiros em centavos | **Nunca `float`.** Ver seção 6.1 |
| PWA | **Serwist** (sucessor do next-pwa) | Service worker, offline, instalável |
| Hospedagem | **Vercel** (Hobby) | Deploy no `git push`, HTTPS, CDN global, preview por branch |
| E-mail (convites) | **Resend** | Free: 3.000 e-mails/mês. O SMTP do Supabase é limitado demais pra produção |
| Erros | **Sentry** (free tier) | Você vai querer saber que quebrou antes do seu primo avisar |

### Custo real na V0: **R$ 0/mês**
Único gasto opcional: domínio próprio (~R$ 40/ano no Registro.br). Sem ele você usa `aurum.vercel.app`.

### Armadilhas conhecidas do free tier — anota aí

1. **Supabase pausa o projeto após 7 dias sem atividade.** Com você + amigos usando isso nunca acontece, mas durante o desenvolvimento pode. Solução: um cron job na Vercel batendo num endpoint 1x/dia.
2. **Free tier do Supabase não tem backup automático.** Não negociável: um GitHub Action rodando `pg_dump` semanal, salvando o arquivo cifrado. São 20 linhas de YAML e é a diferença entre um susto e uma tragédia.
3. **Funções serverless da Vercel: timeout de 10s no Hobby.** Nada no app deve chegar perto disso. Se um relatório demorar, o cálculo vai pro banco (view materializada) e não pra função.

---

## 3. O que é PWA, na prática

Você abre `aurum.app` no Chrome do celular → menu → "Adicionar à tela de início" → nasce um ícone igual a qualquer app. Abre em tela cheia, sem barra de navegador, com splash screen, funciona sem internet (mostra os últimos dados em cache), e pode mandar notificação push ("Conta de luz vence amanhã").

**O que você ganha:** um código para tudo, deploy em segundos, atualização instantânea sem aprovação de loja, zero custo de conta de desenvolvedor.

**O que você abre mão:** biometria nativa (dá pra fazer com WebAuthn/Passkeys, que é até melhor), widgets de tela inicial, e no iOS as notificações push exigem que o usuário tenha instalado o PWA na tela de início. Nada disso é bloqueante.

**Saída futura:** se um dia quiser loja, o mesmo código roda dentro de um wrapper (Capacitor) sem reescrita.

---

## 4. Modelo de dados

### 4.1 O conceito central: **Workspace**

Essa é a decisão de arquitetura mais importante do projeto, e é o que faz a sua ideia de convite funcionar sem gambiarra.

**Nada pertence a um usuário. Tudo pertence a um workspace.**

- Ao criar conta, você ganha automaticamente um **workspace pessoal** (`type = 'personal'`), do qual só você é membro. Ninguém entra nele. Nunca.
- Você pode criar um **workspace compartilhado** (`type = 'shared'`) — "Casa", "Nós dois", "Família" — e convidar pessoas por e-mail.
- No topo do app tem um **seletor de contexto**: `[ Pessoal ▾ ]` / `[ Casa ▾ ]`. Trocar ali troca tudo — dashboard, lançamentos, orçamento, metas.
- Sua parceira vê **tudo** de "Casa" e **nada** do seu pessoal. E vice-versa. Isolamento garantido pelo Postgres, não por um `if` no código.

Por que isso é melhor que "compartilhar transações soltas": permissão, orçamento, metas e relatórios ganham compartilhamento **de graça**, sem lógica nova. E acrescentar um terceiro workspace ("Empresa", "Viagem 2027") é só uma linha na tabela.

**Extra que vale muito:** um lançamento no workspace pessoal pode ter a flag `shared_visible`, permitindo o relatório consolidado *"minha vida financeira completa"* sem expor o detalhe pro grupo. Fase 4, mas o campo já nasce no schema.

### 4.2 Tabelas

> **Atualizado em 11/08/2026, na saída do Supabase.** As quatro primeiras tabelas
> já existem no banco e o que está implementado difere do texto original em
> quatro pontos — o schema real vale mais que este bloco:
>
> - **`profiles` É a tabela de usuário**, não mais um espelho de `auth.users`.
>   Sem GoTrue, não há duas tabelas para sincronizar: some uma tabela e o trigger
>   que as mantinha em dia. Colunas de identidade (`name`, `email`,
>   `email_verified`, `image`) são geridas pelo Better Auth.
> - **`workspace_members` tem `id` próprio** em vez de PK composta — exigência do
>   plugin `organization`. A unicidade de `(workspace_id, user_id)` virou
>   constraint, que dá a mesma garantia.
> - **`workspace_invites` não tem coluna `token`**: o próprio `id` (uuid) é o
>   token, e o Better Auth o trata como opaco.
> - **A FK entre membros/convites e workspace chama-se `organization_id`**, não
>   `workspace_id`, porque vem do plugin. É a única concessão de nomenclatura.
>
> Acrescentou-se **`category_templates`** — o catálogo do §4.4, versionado em
> migration. É a única tabela sem `workspace_id`, por não ser dado de usuário.

```
profiles              id, name, email, email_verified, image, locale, currency,
                      onboarding_done, created_at, updated_at

workspaces            id, name, slug, type ('personal'|'shared'), icon, color,
                      logo, metadata, created_at

workspace_members     id, organization_id → workspaces, user_id → profiles,
                      role, created_at            [unique (organization_id, user_id)]

workspace_invites     id, organization_id → workspaces, email, role, status
                      ('pending'|'accepted'|'revoked'|'expired'), inviter_id,
                      expires_at (7 dias), created_at

accounts              id, workspace_id, name, type ('checking'|'savings'|'cash'|
                      'credit_card'|'investment'|'other'), institution, color, icon,
                      initial_balance, credit_limit, closing_day, due_day,
                      is_archived, created_at

categories            id, workspace_id (NULL = padrão do sistema), name,
                      kind ('income'|'expense'), parent_id → categories,
                      bucket ('needs'|'wants'|'savings'),   ← alimenta o 50/30/20
                      color, icon, is_archived

transactions          id, workspace_id, account_id, category_id,
                      type ('income'|'expense'|'transfer'),
                      amount_cents BIGINT,                  ← centavos, sempre positivo
                      date DATE, competence_date DATE,      ← caixa vs competência
                      description, notes,
                      status ('pending'|'cleared'),         ← "a pagar" = pending
                      due_date DATE,
                      transfer_group_id,                    ← une as 2 pernas
                      recurring_rule_id, installment_no, installment_total,
                      shared_visible BOOL, tags TEXT[],
                      created_by, created_at, updated_at

recurring_rules       id, workspace_id, template (jsonb do lançamento),
                      frequency ('daily'|'weekly'|'monthly'|'yearly'), interval,
                      day_of_month, weekday, start_date, end_date, occurrences_limit,
                      next_occurrence, auto_post BOOL, is_active

budgets               id, workspace_id, category_id, period DATE (1º do mês),
                      limit_cents, rollover BOOL             [UNIQUE ws+cat+period]

goals                 id, workspace_id, name, target_cents, saved_cents,
                      target_date, account_id, priority, color, icon,
                      status ('active'|'reached'|'paused'|'archived')

goal_contributions    id, goal_id, amount_cents, date, transaction_id, created_by

audit_log             id, workspace_id, actor_id, entity, entity_id,
                      action ('create'|'update'|'delete'), diff jsonb, at
```

Índices que importam desde o dia 1:
`transactions (workspace_id, date DESC)` · `transactions (workspace_id, category_id, date)` · `transactions (workspace_id, status, due_date) WHERE status = 'pending'` · `workspace_members (user_id)`

### 4.3 Segurança — RLS

> **Atualizado em 11/08/2026.** O princípio não mudou: o isolamento é do banco,
> não do código. O **mecanismo** mudou, porque `auth.uid()` era do Supabase.
>
> Lá, cada requisição carregava o JWT do usuário e o Postgres sabia sozinho quem
> estava perguntando. Com banco próprio, o app conecta com uma role fixa — então
> o sujeito precisa ser informado, e há três roles em vez de uma:
>
> | Role | Usada por | RLS |
> |---|---|---|
> | `aurum_owner` | só o init do container | — |
> | `aurum_auth` | migrations e Better Auth | **ignora** (é dona das tabelas) |
> | `aurum_app` | toda query de domínio | **aplicada** |
>
> `aurum_auth` precisa ignorar a RLS: durante o login ainda não existe usuário
> para uma policy avaliar. Se as duas fossem a mesma role, toda policy abaixo
> seria decorativa.

Duas funções auxiliares, e todas as políticas derivam delas:

```sql
-- Ocupa o lugar de auth.uid(). Lê a variável que withUser() define na
-- transação. Falha FECHADA: sem ela, devolve NULL e nenhuma linha passa.
create or replace function public.current_user_id()
returns uuid language sql stable
as $$ select nullif(current_setting('app.user_id', true), '')::uuid $$;

create or replace function public.is_member(ws uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from workspace_members
    where organization_id = ws and user_id = public.current_user_id()
  );
$$;
```

Do lado da aplicação, o sujeito só entra por um caminho
(`src/lib/db/with-user.ts`):

```ts
dbApp.transaction(async (tx) => {
  // `true` = is_local: desfaz no fim da transação. Sem ele o valor sobrevive na
  // conexão e a próxima requisição a pegá-la do pool lê como o usuário anterior.
  await tx.execute(sql`select set_config('app.user_id', ${userId}, true)`);
  return run(tx);
});
```

E em **cada tabela com `workspace_id`**:

```sql
alter table transactions enable row level security;

create policy transactions_membro on transactions
  for all to aurum_app
  using (public.is_member(workspace_id))
  with check (public.is_member(workspace_id));
```

O `with check` não é detalhe: é ele que impede mover uma linha **para dentro** do
workspace alheio. Sem ele, `using` sozinho barra a leitura e libera a gravação.

**Regras inegociáveis:**

1. RLS **habilitado em todas** as tabelas, inclusive nas que não têm policy — sem policy, `aurum_app` enxerga zero linhas, que é o default certo.
2. `aurum_app` **nunca** pode ganhar `BYPASSRLS` nem virar dona de tabela. Se ganhar, toda política acima vira enfeite e a suíte de isolamento passa por acidente — por isso o primeiro caso de `tests/rls/` verifica exatamente isso.
3. `security definer` na `is_member` é obrigatório: sem ele, a política da `workspace_members` consulta ela mesma e entra em recursão infinita.
4. Um teste automatizado que loga como usuário A e tenta ler dados de B, esperando **zero linhas**. Esse teste roda em todo deploy.

### 4.4 Seed de categorias — aprovado em 10/08/2026

Copiado para dentro de cada workspace no momento da criação (o `workspace_id` nunca é `NULL`), então o usuário renomeia, arquiva e recategoriza à vontade sem afetar ninguém. O `bucket` de cada folha é o que faz o 50/30/20 funcionar sem o usuário configurar nada.

| Pai | Filhas | `bucket` |
|---|---|---|
| **Receitas** (`income`) | Salário · Freelance/PJ · Rendimentos · Reembolso · 13º e Férias · Outras receitas | — |
| **Moradia** | Aluguel/Financiamento · Condomínio · IPTU · Luz · Água · Gás · Internet · Manutenção | `needs` |
| **Alimentação** | Mercado | `needs` |
| | Padaria/Café · Delivery · Restaurante | `wants` |
| **Transporte** | Combustível · App/Táxi · Transporte público · Estacionamento · IPVA/Seguro · Manutenção | `needs` |
| **Saúde** | Plano de saúde · Farmácia · Consultas/Exames · Terapia | `needs` |
| | Academia | `wants` |
| **Educação** | Mensalidade · Cursos · Livros | `needs` |
| **Pessoal** | Roupas · Beleza/Barbearia · Presentes | `wants` |
| **Lazer** | Bares e festas · Viagens · Hobbies · Jogos | `wants` |
| **Assinaturas** | Celular | `needs` |
| | Streaming · Software · Outras | `wants` |
| **Financeiro** | Tarifas bancárias · Juros · Impostos · Seguros | `needs` |
| **Família** | Filhos · Pets · Ajuda familiar | `needs` |
| **Guardar** | Reserva de emergência · Aporte investimento · Aporte de meta | `savings` |

Categoria pai não recebe lançamento direto — ela existe para agrupar e para o donut do dashboard. O `bucket` mora na folha porque é onde a decisão de gasto acontece: mercado é necessidade, delivery é desejo, e os dois são "Alimentação".

---

## 5. Funcionalidades

### 5.1 O núcleo (V0)

**Lançamentos** — Receita, despesa e transferência. Formulário em bottom sheet no celular: teclado numérico abre direto, categoria sugerida pelo histórico da descrição, data padrão "hoje". Meta: **lançar em menos de 5 segundos**. Se demorar mais, ninguém usa depois da segunda semana — e um app de finanças abandonado não vale nada.

**Contas** — Corrente, poupança, dinheiro, cartão de crédito, investimento. Cartão de crédito é tratado à parte: tem dia de fechamento e vencimento, e a compra entra no mês de **competência** da fatura, não no dia da compra. É o erro nº 1 dos apps genéricos no Brasil.

**Categorias** — Árvore de 2 níveis (Alimentação → Mercado / Delivery / Restaurante). Cada uma marcada como `needs` / `wants` / `savings`, que é o que alimenta a regra 50/30/20 automaticamente. Vem com um conjunto padrão brasileiro pronto.

**Contas a pagar** — É `transaction` com `status = 'pending'` e `due_date`. Zero tabela nova. Tela dedicada com semáforo: vencido (vermelho pulsante), vence em ≤3 dias (âmbar), futuro (neutro). Marcar como pago é um swipe.

**Recorrentes** — Aluguel, Netflix, salário. Ou lança sozinho (`auto_post`) ou entra como pendente pra você confirmar. Parcelamento ("12x de R$ 250") gera as 12 ocorrências com `installment_no`.

**Orçamento por categoria** — Teto mensal por categoria, com barra de progresso. `rollover` opcional: sobrou R$ 80 em Lazer, os R$ 80 vão pro mês seguinte. Alerta em 80% e em 100%.

**Metas / Reservas ("Cofrinhos")** — Reserva de emergência, viagem, notebook. Barra de progresso, aporte mensal sugerido = `(alvo − guardado) ÷ meses restantes`, e a data projetada de conclusão no ritmo atual.

### 5.2 O que faz o app ser bom e não só mais um

Essas são as coisas que separam "planilha bonita" de "app que eu abro todo dia".

**⚡ Safe-to-Spend (o número herói do dashboard)**
Não é saldo. Saldo mente. É:
```
disponível = saldo − contas a pagar até o fim do mês − aportes de meta do mês
por dia    = disponível ÷ dias restantes no mês
```
Um número enorme no topo: **"R$ 87/dia até dia 31"**. Responde a única pergunta que a pessoa realmente tem — *posso gastar isso?*

**🛟 Runway / Meses de Sobrevivência**
`reserva líquida ÷ média de despesas essenciais (3 meses)`. Exibido como **"Você aguenta 4,2 meses sem receber nada"**. É a métrica de segurança mais honesta que existe, e quase nenhum app mostra.

**💯 Score de Saúde Financeira (0–100)**
Composto, com detalhamento aberto ao tocar:
- Taxa de poupança (peso 25) — `(receita − despesa) ÷ receita`
- Runway de emergência (25) — meses cobertos, satura em 6
- Comprometimento com dívida (20) — parcelas ÷ renda, ideal < 30%
- Aderência ao orçamento (15) — % de categorias dentro do teto
- Consistência (15) — meses seguidos no positivo

Gauge circular animado com anel neon. Sobe e desce mês a mês — vira jogo, e jogo vicia no bom sentido.

**📈 Previsão de fim de mês**
Regressão simples sobre o ritmo de gasto do mês + recorrentes conhecidos → *"Projeção: fecha o mês em R$ 340 negativo"*. Aparece **no dia 12**, quando ainda dá pra corrigir. Alertar no dia 30 é inútil.

**🐜 Gastos formiga**
Agrupa transações abaixo de R$ 30 e mostra o total: *"Você gastou R$ 412 em 38 comprinhas esse mês — 14% da sua renda"*. O impacto é sempre maior do que a pessoa imagina.

**🔁 Radar de assinaturas**
Detecta cobranças recorrentes de mesmo valor e sinaliza: aumentos de preço, assinaturas sem uso há 3 meses, e o **custo anualizado** (R$ 39,90/mês → *"R$ 478/ano"*). Ver o número anual é o que faz cancelar.

**⏱️ Custo em horas de trabalho**
Você cadastra seu salário. Ao lançar R$ 300, aparece: *"≈ 8,5 horas do seu trabalho"*. Reenquadramento cognitivo brutalmente eficaz.

**🔮 Simulador "E se..."**
Sliders ao vivo: *"e se eu cortar 20% do delivery?"* → mostra o efeito em 1, 5 e 10 anos com juros compostos. Transforma R$ 200/mês em R$ 33.000 na tela. Nada convence mais.

**🌊 Sankey de renda**
Diagrama de fluxo: salário entra à esquerda, se ramifica em Contas / Vida / Guardado, depois em subcategorias. É o gráfico mais impressionante que existe pra finanças pessoais e quase ninguém implementa.

**🔥 Heatmap anual de gastos**
Grade estilo GitHub, 365 quadradinhos, intensidade = gasto do dia. Padrões saltam aos olhos — a sexta-feira sempre acesa, a semana do pagamento.

**🎯 Streaks e conquistas**
"12 dias dentro do orçamento", "3 meses seguidos poupando", "reserva de emergência completa". Discreto, sem infantilizar. Mas funciona.

**📊 Curva ABC / Pareto**
*"3 categorias concentram 71% dos seus gastos"*. Foca o esforço onde tem retorno, em vez de espremer o cafezinho.

**📉 Sua inflação pessoal**
Compara sua cesta de gastos ano contra ano. *"Seus custos subiram 9,2% — o IPCA subiu 4,1%"*. Ninguém oferece isso e é altamente revelador.

**⌘K Command palette**
`Cmd/Ctrl + K` → "50 mercado" cria a despesa. Navegação, criação e busca em um atalho. Detalhe pequeno que faz o app parecer caro.

**Ainda:** metas com aporte automático · comparativo mês vs mês *no mesmo dia* (dia 12 vs dia 12, não mês fechado contra mês em curso) · notificação push de vencimento · exportação CSV/PDF · tratamento de 13º e férias como receita extraordinária (padrão: 100% pra metas) · modo privacidade (borra os valores num toque, pra usar no ônibus).

---

## 6. Fundamentos financeiros do app

### 6.1 A regra técnica que não se quebra

**Dinheiro é `BIGINT` em centavos. Nunca `float`, nunca `double`.**

```js
0.1 + 0.2 === 0.30000000000000004   // ponto flutuante, em qualquer linguagem
```

Em um app de finanças isso vira saldo errado por centavos que se acumulam. Guarda `12550` e formata como `R$ 125,50` na borda da tela. No Postgres, `BIGINT`. Nos cálculos, `Dinero.js`. Arredondamento só na exibição, e sempre *bankers rounding* em rateios.

### 6.2 Métodos de orçamento (o usuário escolhe um no onboarding)

**50/30/20** — 50% necessidades, 30% desejos, 20% poupança/dívidas. O mais fácil de começar e o que o app usa por padrão via o campo `bucket` das categorias. Ressalva honesta: as porcentagens quebram com renda baixa ou aluguel caro em capital — o app deve permitir ajustar os pesos, não impor.

**70/20/10** — 70% vida, 20% investir, 10% dívida/doação. Alternativa mais realista pra quem tem custo fixo alto.

**Orçamento base zero** — toda a renda recebe destino até sobrar exatamente R$ 0. Máximo controle, mais trabalhoso. É o que o app oferece pra quem quer agressividade em quitar dívida.

**Envelopes / Sinking funds** — dinheiro separado por categoria; envelope vazio = parou de gastar. No digital, vira as "caixinhas" — e é excelente pra despesa que não é mensal mas é certa: IPVA, seguro, Natal, presente. Dividir R$ 1.800 de IPVA em 12 aportes de R$ 150 elimina o susto de janeiro. **Feature subestimada e transformadora.**

**Pagar-se primeiro** — no dia do salário, o valor da meta sai automático antes de qualquer coisa. Não é método de orçamento, é automação — e é a que mais funciona na prática.

### 6.3 Fórmulas embutidas no motor de cálculo

```
Taxa de poupança            = (receita − despesa) / receita
Reserva de emergência       = despesa essencial mensal × N
                              N = 3–6 (CLT estável) | 6–12 (autônomo/PJ/renda variável)
Runway (meses)              = reserva líquida / despesa essencial mensal
Comprometimento de renda    = parcelas de dívida / renda líquida     (alerta > 30%)
Patrimônio líquido          = ativos − passivos
Safe-to-spend diário        = (saldo − pendentes − metas) / dias restantes

Juros compostos (futuro)    = PV × (1 + i)^n
Aporte mensal (série)       = FV × i / ((1 + i)^n − 1)
Regra de 72                 = 72 / i%   → anos pra dobrar o capital
Independência financeira    = despesa anual × 25          (regra dos 4%)
Custo de oportunidade       = valor × (1 + i)^n − valor
Custo real anual            = mensalidade × 12
Custo em horas              = valor / (salário líquido / horas trabalhadas no mês)

Taxa efetiva (juros ao mês) = (1 + i_anual)^(1/12) − 1
Preço à vista vs parcelado  = compara VP do parcelamento com o preço à vista
Inflação pessoal            = (cesta de gastos ano atual / ano anterior) − 1
```

**Estratégias de quitação de dívida** — o app calcula as duas e mostra lado a lado:
- **Avalanche** — ataca a maior taxa de juros primeiro. **Matematicamente ótimo**, economiza mais.
- **Bola de neve** — ataca a menor dívida primeiro. Pior na matemática, **melhor na psicologia** — a primeira dívida quitada gera o impulso que faz a pessoa continuar.

Mostrar: *"Avalanche economiza R$ 840 · Bola de neve quita a 1ª dívida em 2 meses em vez de 9."* E deixar a pessoa escolher. O método que ela mantém vence o método ótimo que ela abandona.

**Hierarquia de prioridade sugerida no onboarding:**
1. R$ 1.000 de reserva inicial (para de recorrer ao cartão em emergência pequena)
2. Quitar dívida cara — cartão rotativo e cheque especial passam de 300% a.a. no Brasil. Nenhum investimento acessível compete com isso. **Quitar é o melhor investimento disponível.**
3. Completar 3–6 meses de reserva em liquidez diária
4. Investir para objetivos de médio e longo prazo

---

## 7. Design system

**Direção:** base minimalista high-tech (Linear/Vercel) — muito respiro, tipografia forte, hierarquia clara — com **acentos neon e painéis de vidro** nos momentos de destaque. O truque é dosagem: se tudo brilha, nada brilha. Neon só no que importa (número herói, score, linha ativa do gráfico); o resto é calmo.

### Tokens

```css
/* superfícies */
--bg:            #08090D;   /* fundo */
--surface-1:     #101218;   /* card */
--surface-2:     #171A22;   /* card elevado */
--border:        rgba(255,255,255,.07);
--border-strong: rgba(255,255,255,.14);

/* vidro (só em hero, modal e bottom sheet) */
--glass:      rgba(255,255,255,.045);
--glass-blur: blur(20px) saturate(160%);

/* acentos */
--accent:      #22D3EE;   /* ciano — primário */
--accent-2:    #A78BFA;   /* violeta — secundário/gradiente */
--positive:    #34D399;   /* receita, dentro do orçamento */
--negative:    #FB7185;   /* despesa, estouro */
--warning:     #FBBF24;   /* vence em breve */

/* texto */
--text:      #F2F4F8;
--text-mid:  #9BA3B4;
--text-dim:  #5C6475;

--glow: 0 0 24px rgba(34,211,238,.28);
--r:    16px;   /* raio padrão */
```

**Tipografia** — `Geist` ou `Inter` na interface. Números **sempre** com `font-variant-numeric: tabular-nums` (senão as colunas dançam ao atualizar). Valores grandes em `Geist Mono`, peso 600, `letter-spacing: -0.02em`.

**Motion** — 150–250ms, `cubic-bezier(.32,.72,0,1)`. Números contam animados ao mudar (count-up). Gráfico desenha de baixo pra cima ao entrar. Nunca animar duas coisas grandes ao mesmo tempo. `prefers-reduced-motion` respeitado.

**Gráficos** — preenchimento em gradiente vertical do acento até transparente. Linha ativa com `filter: drop-shadow` sutil = o glow. Grade quase invisível (`rgba(255,255,255,.04)`). Tooltip em vidro. Eixo Y sem casas decimais e abreviado (`4,2k`).

**Layout responsivo**
- **Mobile (< 768px):** bottom tab bar de 5 itens, com FAB central "+" em gradiente ciano→violeta. Bottom sheets em vez de modais. Listas com swipe (esquerda = editar, direita = marcar pago). Alvos de toque ≥ 44px. Área segura do notch respeitada.
- **Desktop (≥ 1024px):** sidebar recolhível, grid de 12 colunas, tabela densa com atalhos de teclado, command palette.
- **Tablet:** grid de 2 colunas, sidebar em ícones.

**Modo claro:** fase 5. Nasce dark, mas todos os tokens já são variáveis CSS — trocar depois é trivial se feito desde o início. **Não hardcode nenhuma cor.**

**Acessibilidade:** contraste mínimo 4.5:1 no texto (neon sobre preto falha fácil — testar), nunca comunicar informação só por cor (positivo/negativo levam sinal e ícone, não só verde/vermelho), navegação completa por teclado, foco visível.

---

## 8. Roadmap

Cada fase termina **em produção**. Nada de "integra tudo no final".

### Fase 0 — Fundação (2–3 dias)
Repo + Next.js 15 + TS strict + Tailwind v4 + shadcn · Projeto Supabase · Drizzle + primeira migration · Auth (Google + e-mail/senha) · Trigger que cria `profile` + workspace pessoal no signup · Rotas protegidas por middleware · **Deploy na Vercel** · ESLint + Prettier + Husky.
> **Entregável:** dá pra criar conta, logar e ver uma tela vazia. **No ar.**

### Fase 1 — Núcleo (1 semana)
Schema completo + RLS em tudo · Seed de categorias BR · CRUD de contas · CRUD de transações com optimistic update · Lista com filtros e busca · Dashboard v1 (saldo, receita/despesa do mês, últimos lançamentos) · Seletor de workspace no header · **Teste de isolamento entre usuários**.
> **Entregável:** já substitui a planilha.

### Fase 2 — Compromissos (4–5 dias)
Recorrentes + geração de ocorrências · Contas a pagar com semáforo · Marcar como pago (swipe) · Parcelamento · Faturas de cartão (fechamento/vencimento, competência) · Orçamento por categoria com rollover e alertas.
> **Entregável:** o app avisa antes de você esquecer.

### Fase 3 — Inteligência e visual (1 semana)
Metas/cofrinhos + aporte sugerido · Motor de cálculo (seção 6.3) · Score de saúde · Safe-to-spend · Runway · Gráficos: donut de categorias, barras mês a mês, linha de evolução, heatmap anual, Sankey · Gastos formiga · Radar de assinaturas · Simulador "e se" · Polimento visual completo.
> **Entregável:** o app fica bonito e começa a ensinar.

### Fase 4 — Compartilhado (4–5 dias)
Criar workspace compartilhado · Convite por e-mail (Resend) com token e expiração · Aceitar convite · Papéis e permissões · "Quem lançou" nas transações · `shared_visible` e visão consolidada · Audit log.
> **Entregável:** sua parceira e sua família entram.

### Fase 5 — Acabamento (3–4 dias)
PWA (Serwist): manifest, ícones, offline, splash · Push de vencimento · Onboarding guiado com escolha de método de orçamento · Command palette · Modo privacidade · Exportar CSV/PDF · Sentry · Backup automático semanal · Domínio próprio · Lighthouse ≥ 90 · Meta tags e OG image.
> **Entregável:** pronto pra convidar quem você quiser.

### Depois (v1.1+)
Importação de CSV/OFX · Open Finance (Pluggy/Belvo — pago, exige CNPJ) · Foto de comprovante com IA · Investimentos e patrimônio líquido · Multimoeda · Modo claro · Widget nativo.

**Estimativa total da V0: ~4 a 5 semanas** em ritmo de projeto paralelo.

---

## 9. Estrutura de pastas

```
aurum/
├─ src/
│  ├─ app/
│  │  ├─ (auth)/login · signup · callback
│  │  ├─ (app)/
│  │  │  ├─ layout.tsx            ← sidebar + workspace switcher
│  │  │  ├─ dashboard/
│  │  │  ├─ transacoes/
│  │  │  ├─ contas/
│  │  │  ├─ orcamento/
│  │  │  ├─ metas/
│  │  │  ├─ relatorios/
│  │  │  └─ config/
│  │  ├─ convite/[token]/
│  │  └─ api/
│  ├─ components/
│  │  ├─ ui/                      ← shadcn
│  │  ├─ charts/                  ← wrappers Recharts com o tema
│  │  └─ finance/                 ← MoneyInput, CategoryPicker, ScoreGauge...
│  ├─ lib/
│  │  ├─ db/ (schema.ts, migrations/, queries/)
│  │  ├─ supabase/ (client, server, middleware)
│  │  ├─ finance/                 ← ⭐ motor de cálculo, PURO e testado
│  │  │  ├─ money.ts · budget.ts · score.ts · forecast.ts
│  │  │  ├─ compound.ts · debt.ts · recurring.ts
│  │  ├─ validators/              ← Zod
│  │  └─ utils/
│  ├─ hooks/
│  └─ types/
├─ supabase/migrations/
├─ tests/  (unit: finance/ · e2e: Playwright · rls: isolamento)
└─ public/ (manifest.json, ícones)
```

**Regra de ouro:** `lib/finance/` é **função pura** — entra número, sai número. Sem banco, sem React, sem data do sistema (a data é sempre um parâmetro). É o que garante que dá pra testar 100% dessa pasta, e é exatamente onde um bug custa dinheiro de verdade.

---

## 10. Checklist antes de abrir o VS Code

**Contas a criar** (todas gratuitas)
- [ ] GitHub — repositório privado `aurum`
- [ ] Vercel — conectada ao GitHub
- [ ] Supabase — projeto na região **South America (São Paulo)**, guardar a senha do banco
- [ ] Google Cloud Console — OAuth Client ID (origins + redirect do Supabase)
- [ ] Resend — só na Fase 4
- [ ] Sentry — só na Fase 5

**Decisões pendentes suas** — resolvidas em 10/08/2026
- [x] **Nome:** Aurum. Acento primário segue ciano `#22D3EE` — âmbar já é `--warning` ("vencendo"), e cor repetida com dois significados num app financeiro treina o olho a ignorar o alerta. `--gold` fica reservado a conquista (meta batida, streak, reserva completa)
- [x] **Cadastro aberto**, com confirmação de e-mail obrigatória. O convite não cria conta — ele só adiciona alguém a um workspace compartilhado que já existe
- [x] **Categorias:** seed da seção 4.4, ajustável pela UI depois
- [ ] Sua renda e principais contas fixas — não bloqueia nada, é dado de onboarding. Serve pra calibrar os alertas da Fase 3 na sua realidade

**Decisões técnicas já fechadas — não reabrir**
- [x] Dinheiro em centavos, `BIGINT`, nunca float — sem Dinero.js, `lib/finance/money.ts` próprio, rateio por largest remainder
- [x] RLS habilitado em toda tabela, sem exceção
- [x] Tudo pertence a workspace, nada pertence a usuário direto
- [x] Toda cor via variável CSS, zero hardcode
- [x] `lib/finance/` puro e 100% testado
- [x] Deploy em produção desde a Fase 0
- [x] ~~Drizzle só em schema/migrations/tipos — runtime por `supabase-js`~~ → **revisto em 11/08/2026:** Drizzle É o driver de runtime, sempre por `withUser()`, que informa o usuário da requisição ao Postgres. A RLS é aplicada por privilégio de role, não por JWT
- [x] Transferência com `direction ('in'|'out')`; ~~convite via RPC `accept_invite`~~ → o plugin `organization` do Better Auth já exige e-mail verificado igual ao do convite; data civil em `DATE`/`America/Sao_Paulo`

---

## 11. Riscos e como neutralizar

| Risco | Neutralização |
|---|---|
| Vazar dados entre usuários | RLS + teste automatizado de isolamento em todo deploy. É o risco nº 1 |
| Erro de arredondamento em dinheiro | Centavos inteiros + Dinero.js + testes unitários no motor |
| Supabase pausar por inatividade | Cron diário na Vercel batendo num healthcheck |
| Perder o banco (sem backup no free) | `pg_dump` semanal via GitHub Action, arquivo cifrado |
| Abandonar o app depois de 2 semanas | Lançamento em < 5s + push de vencimento + streaks. **Este é o risco mais provável de todos** |
| Escopo inflar e nada ficar pronto | Cada fase vai pra produção. Ideia nova vai pro backlog, não pra fase atual |
| Free tier estourar com muitos convidados | Cadastro por convite + monitorar egress. 500 MB comportam ~500 mil transações |
| Cartão de crédito modelado errado | Competência vs caixa resolvido já na Fase 2, antes de acumular dado |

---

## 12. Próximo passo

Fechar as 4 decisões pendentes da seção 10 e partir pra Fase 0. A partir dali é código.

---

### Fontes

- [Supabase Free Tier Limits 2026 — IT Path Solutions](https://www.itpathsolutions.com/supabase-free-tier-limits)
- [Supabase Pricing 2026 — Makerkit](https://makerkit.dev/blog/saas/supabase-pricing)
- [Supabase + Next.js App Router Starter — Vercel](https://vercel.com/templates/next.js/supabase)
- [Vercel + Supabase: What Works and What Breaks in 2026](https://kuberns.medium.com/vercel-supabase-what-works-and-what-breaks-in-2026-c489708cbebb)
- [Best Budgeting Methods — Ramsey Solutions](https://www.ramseysolutions.com/budgeting/budgeting-methods)
- [Zero-Based, 50/30/20 and Envelope Methods — U.S. News](https://money.usnews.com/money/personal-finance/saving-and-budgeting/articles/how-to-create-a-budget-that-works-for-you)
- [Budgeting Methods Compared 2026 — SenticMoney](https://senticmoney.com/blog/budgeting-methods-compared)
- [Best Budgeting Apps of 2026 — Forbes Advisor](https://www.forbes.com/advisor/banking/best-budgeting-apps/)
- [Best Budget Apps for 2026 — NerdWallet](https://www.nerdwallet.com/finance/learn/best-budget-apps)
- [Net Worth Tracking Apps 2026 — Quicken](https://www.quicken.com/blog/best-budgeting-software-and-apps-for-net-worth-tracking-in-2026/)
- [Open Finance 2026: novidades — Pluggy](https://www.pluggy.ai/blog/open-finance-2026-novidades)
- [Pix via Open Finance API — Belvo](https://developers.belvo.com/pt-br/products/payments_brazil/payments-brazil-pix-via-open-finance-api-guide)
