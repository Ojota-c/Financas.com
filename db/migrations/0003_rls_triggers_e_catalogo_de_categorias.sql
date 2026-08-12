-- ═══════════════════════════════════════════════════════════════════════════
-- O coração do isolamento, mais o que a fase 0 prometeu e não entregou:
-- workspace pessoal e categorias nascendo junto com a conta.
--
-- No Supabase a RLS se apoiava em auth.uid(), que vinha do JWT do request.
-- Com banco próprio o app conecta com uma role fixa, então o sujeito é
-- informado por variável de sessão, dentro de uma transação — ver
-- src/lib/db/with-user.ts.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Quem é o usuário desta transação ────────────────────────────────────────
-- Substitui auth.uid(). Falha FECHADA por construção: sem a variável, devolve
-- NULL, toda comparação vira NULL, e a policy não deixa passar linha nenhuma.
create or replace function public.current_user_id()
returns uuid
language sql
stable
as $$ select nullif(current_setting('app.user_id', true), '')::uuid $$;

-- ── A função da qual TODA policy deriva ─────────────────────────────────────
-- `security definer` é obrigatório e não é atalho: sem ele, a policy de
-- workspace_members consultaria workspace_members para decidir se pode ler
-- workspace_members — recursão infinita. Com ele, a consulta interna roda como
-- a dona da função e escapa do laço.
-- `set search_path` fecha a porta clássica de escalada por schema falsificado.
create or replace function public.is_member(ws uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from workspace_members
    where organization_id = ws and user_id = public.current_user_id()
  );
$$;

-- Duas pessoas se enxergam quando dividem algum workspace. Hoje ninguém
-- divide nada (workspace compartilhado é fase 4), mas a policy de profiles já
-- nasce certa em vez de precisar ser reescrita depois.
create or replace function public.compartilha_workspace(outro uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from workspace_members meu
    join workspace_members dele on dele.organization_id = meu.organization_id
    where meu.user_id = public.current_user_id() and dele.user_id = outro
  );
$$;

revoke execute on function public.is_member(uuid) from public;
revoke execute on function public.compartilha_workspace(uuid) from public;
grant execute on function public.is_member(uuid) to aurum_app;
grant execute on function public.compartilha_workspace(uuid) to aurum_app;
grant execute on function public.current_user_id() to aurum_app;

-- ── FK que faltou: a árvore de categorias ───────────────────────────────────
-- Auto-relacionamento não sai do schema Drizzle sem tipo circular.
alter table categories
  add constraint categories_parent_id_fk
  foreign key (parent_id) references categories(id) on delete cascade;

-- ── RLS ligada em toda tabela de domínio ────────────────────────────────────
alter table workspaces        enable row level security;
alter table workspace_members enable row level security;
alter table workspace_invites enable row level security;
alter table categories        enable row level security;
alter table profiles          enable row level security;
alter table category_templates enable row level security;

create policy workspaces_membro on workspaces
  for select to aurum_app using (public.is_member(id));

create policy workspace_members_membro on workspace_members
  for select to aurum_app using (public.is_member(organization_id));

create policy workspace_invites_membro on workspace_invites
  for select to aurum_app using (public.is_member(organization_id));

-- Categorias: o usuário renomeia, arquiva e cria as suas, então aqui a escrita
-- é liberada — desde que dentro de um workspace do qual ele é membro. O
-- `with check` é o que impede mover uma categoria para o workspace alheio.
create policy categories_membro on categories
  for all to aurum_app
  using (public.is_member(workspace_id))
  with check (public.is_member(workspace_id));

-- Perfil: o próprio, mais o de quem divide workspace (fase 4 precisa mostrar
-- quem lançou o quê). Só leitura — a escrita é do Better Auth, por dbAuth.
create policy profiles_proprio_ou_colega on profiles
  for select to aurum_app
  using (id = public.current_user_id() or public.compartilha_workspace(id));

-- category_templates fica com RLS ligada e SEM policy: aurum_app enxerga zero
-- linhas. Quem lê é o trigger abaixo, que roda como security definer.
revoke all on table category_templates from aurum_app;

-- ── O catálogo do §4.4 ──────────────────────────────────────────────────────
insert into category_templates (slug, parent_slug, name, kind, bucket, sort_order) values
  ('receitas',        null, 'Receitas',     'income',  null, 10),
  ('moradia',         null, 'Moradia',      'expense', null, 20),
  ('alimentacao',     null, 'Alimentação',  'expense', null, 30),
  ('transporte',      null, 'Transporte',   'expense', null, 40),
  ('saude',           null, 'Saúde',        'expense', null, 50),
  ('educacao',        null, 'Educação',     'expense', null, 60),
  ('pessoal',         null, 'Pessoal',      'expense', null, 70),
  ('lazer',           null, 'Lazer',        'expense', null, 80),
  ('assinaturas',     null, 'Assinaturas',  'expense', null, 90),
  ('financeiro',      null, 'Financeiro',   'expense', null, 100),
  ('familia',         null, 'Família',      'expense', null, 110),
  ('guardar',         null, 'Guardar',      'expense', null, 120),

  ('receitas-salario',      'receitas', 'Salário',        'income', null, 10),
  ('receitas-freelance',    'receitas', 'Freelance/PJ',   'income', null, 20),
  ('receitas-rendimentos',  'receitas', 'Rendimentos',    'income', null, 30),
  ('receitas-reembolso',    'receitas', 'Reembolso',      'income', null, 40),
  ('receitas-13-ferias',    'receitas', '13º e Férias',   'income', null, 50),
  ('receitas-outras',       'receitas', 'Outras receitas','income', null, 60),

  ('moradia-aluguel',      'moradia', 'Aluguel/Financiamento', 'expense', 'needs', 10),
  ('moradia-condominio',   'moradia', 'Condomínio',            'expense', 'needs', 20),
  ('moradia-iptu',         'moradia', 'IPTU',                  'expense', 'needs', 30),
  ('moradia-luz',          'moradia', 'Luz',                   'expense', 'needs', 40),
  ('moradia-agua',         'moradia', 'Água',                  'expense', 'needs', 50),
  ('moradia-gas',          'moradia', 'Gás',                   'expense', 'needs', 60),
  ('moradia-internet',     'moradia', 'Internet',              'expense', 'needs', 70),
  ('moradia-manutencao',   'moradia', 'Manutenção',            'expense', 'needs', 80),

  ('alimentacao-mercado',     'alimentacao', 'Mercado',       'expense', 'needs', 10),
  ('alimentacao-padaria',     'alimentacao', 'Padaria/Café',  'expense', 'wants', 20),
  ('alimentacao-delivery',    'alimentacao', 'Delivery',      'expense', 'wants', 30),
  ('alimentacao-restaurante', 'alimentacao', 'Restaurante',   'expense', 'wants', 40),

  ('transporte-combustivel',    'transporte', 'Combustível',         'expense', 'needs', 10),
  ('transporte-app-taxi',       'transporte', 'App/Táxi',            'expense', 'needs', 20),
  ('transporte-publico',        'transporte', 'Transporte público',  'expense', 'needs', 30),
  ('transporte-estacionamento', 'transporte', 'Estacionamento',      'expense', 'needs', 40),
  ('transporte-ipva-seguro',    'transporte', 'IPVA/Seguro',         'expense', 'needs', 50),
  ('transporte-manutencao',     'transporte', 'Manutenção',          'expense', 'needs', 60),

  ('saude-plano',     'saude', 'Plano de saúde',    'expense', 'needs', 10),
  ('saude-farmacia',  'saude', 'Farmácia',          'expense', 'needs', 20),
  ('saude-consultas', 'saude', 'Consultas/Exames',  'expense', 'needs', 30),
  ('saude-terapia',   'saude', 'Terapia',           'expense', 'needs', 40),
  ('saude-academia',  'saude', 'Academia',          'expense', 'wants', 50),

  ('educacao-mensalidade', 'educacao', 'Mensalidade', 'expense', 'needs', 10),
  ('educacao-cursos',      'educacao', 'Cursos',      'expense', 'needs', 20),
  ('educacao-livros',      'educacao', 'Livros',      'expense', 'needs', 30),

  ('pessoal-roupas',    'pessoal', 'Roupas',            'expense', 'wants', 10),
  ('pessoal-beleza',    'pessoal', 'Beleza/Barbearia',  'expense', 'wants', 20),
  ('pessoal-presentes', 'pessoal', 'Presentes',         'expense', 'wants', 30),

  ('lazer-bares',   'lazer', 'Bares e festas', 'expense', 'wants', 10),
  ('lazer-viagens', 'lazer', 'Viagens',        'expense', 'wants', 20),
  ('lazer-hobbies', 'lazer', 'Hobbies',        'expense', 'wants', 30),
  ('lazer-jogos',   'lazer', 'Jogos',          'expense', 'wants', 40),

  ('assinaturas-celular',   'assinaturas', 'Celular',   'expense', 'needs', 10),
  ('assinaturas-streaming', 'assinaturas', 'Streaming', 'expense', 'wants', 20),
  ('assinaturas-software',  'assinaturas', 'Software',  'expense', 'wants', 30),
  ('assinaturas-outras',    'assinaturas', 'Outras',    'expense', 'wants', 40),

  ('financeiro-tarifas',  'financeiro', 'Tarifas bancárias', 'expense', 'needs', 10),
  ('financeiro-juros',    'financeiro', 'Juros',             'expense', 'needs', 20),
  ('financeiro-impostos', 'financeiro', 'Impostos',          'expense', 'needs', 30),
  ('financeiro-seguros',  'financeiro', 'Seguros',           'expense', 'needs', 40),

  ('familia-filhos', 'familia', 'Filhos',         'expense', 'needs', 10),
  ('familia-pets',   'familia', 'Pets',           'expense', 'needs', 20),
  ('familia-ajuda',  'familia', 'Ajuda familiar', 'expense', 'needs', 30),

  ('guardar-reserva',      'guardar', 'Reserva de emergência', 'expense', 'savings', 10),
  ('guardar-investimento', 'guardar', 'Aporte investimento',   'expense', 'savings', 20),
  ('guardar-meta',         'guardar', 'Aporte de meta',        'expense', 'savings', 30)
on conflict (slug) do nothing;

-- ── Todo workspace nasce com o catálogo dentro ──────────────────────────────
-- No workspace, e não no cadastro, para que o compartilhado da fase 4 ganhe
-- categorias pelo mesmo caminho, sem código novo.
create or replace function public.copiar_categorias_padrao()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Pais primeiro: as folhas precisam do id deles.
  insert into categories (workspace_id, name, kind, bucket, sort_order, template_slug)
  select new.id, t.name, t.kind, t.bucket, t.sort_order, t.slug
  from category_templates t
  where t.parent_slug is null;

  insert into categories (workspace_id, name, kind, parent_id, bucket, sort_order, template_slug)
  select new.id, t.name, t.kind, pai.id, t.bucket, t.sort_order, t.slug
  from category_templates t
  join categories pai
    on pai.workspace_id = new.id and pai.template_slug = t.parent_slug
  where t.parent_slug is not null;

  return new;
end;
$$;

create trigger workspaces_copia_categorias
after insert on workspaces
for each row execute function public.copiar_categorias_padrao();

-- ── Toda conta nasce com um espaço pessoal ──────────────────────────────────
-- Trigger de banco, e não hook em JS: roda na MESMA transação do insert do
-- perfil, então ou a conta nasce completa ou não nasce. Vale para cadastro por
-- e-mail, por Google e para qualquer caminho futuro, sem depender de o processo
-- Node estar vivo. O slug sai do id do usuário porque precisa ser único.
create or replace function public.criar_workspace_pessoal()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  ws_id uuid;
begin
  insert into workspaces (name, slug, type)
  values ('Espaço pessoal', 'pessoal-' || replace(new.id::text, '-', ''), 'personal')
  returning id into ws_id;

  insert into workspace_members (organization_id, user_id, role)
  values (ws_id, new.id, 'owner');

  return new;
end;
$$;

create trigger profiles_cria_workspace_pessoal
after insert on profiles
for each row execute function public.criar_workspace_pessoal();

-- ── Só 'personal' | 'shared' ────────────────────────────────────────────────
alter table workspaces
  add constraint workspaces_type_check check (type in ('personal', 'shared'));
