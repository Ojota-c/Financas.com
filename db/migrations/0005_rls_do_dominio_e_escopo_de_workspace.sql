-- ═══════════════════════════════════════════════════════════════════════════
-- A RLS das sete tabelas de domínio, e a segunda variável de sessão que dá a
-- elas escopo de workspace.
--
-- Até aqui a policy respondia uma pergunta só: "esta pessoa é membro?". Isso
-- basta enquanto cada um tem um workspace. Com dois — o pessoal e o
-- compartilhado da fase 4 — `is_member()` libera as linhas dos DOIS de uma vez,
-- e o recorte do espaço aberto na tela passa a depender de um `where` manual em
-- cada query. Um esquecimento aí não vaza dado para estranho: mistura o
-- compartilhado dentro do saldo pessoal, que é erro de extrato, não aparece em
-- teste e ninguém percebe até a conta não bater.
--
-- Então a policy passa a responder duas perguntas: quem é (is_member) e onde
-- está (current_workspace_id). Ver src/lib/db/with-user.ts.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Qual workspace está aberto nesta transação ──────────────────────────────
-- Mesma construção de current_user_id(), mesma falha FECHADA: sem a variável
-- devolve NULL, `workspace_id = NULL` é NULL, e nenhuma linha passa.
create or replace function public.current_workspace_id()
returns uuid
language sql
stable
as $$ select nullif(current_setting('app.workspace_id', true), '')::uuid $$;

grant execute on function public.current_workspace_id() to aurum_app;

-- ── A cláusula que toda tabela de domínio repete ────────────────────────────
-- As duas condições são necessárias e nenhuma é redundante:
--   is_member()           → impede alcançar workspace alheio informando o id
--                           dele na variável de sessão.
--   current_workspace_id  → limita ao espaço realmente aberto na tela.
-- Sem a primeira, bastaria mentir na variável. Sem a segunda, o app vê tudo.

-- categories já tinha policy; agora ganha o escopo.
drop policy if exists categories_membro on categories;

create policy categories_do_workspace on categories
  for all to aurum_app
  using (workspace_id = public.current_workspace_id() and public.is_member(workspace_id))
  with check (workspace_id = public.current_workspace_id() and public.is_member(workspace_id));

alter table accounts           enable row level security;
alter table transactions       enable row level security;
alter table recurring_rules    enable row level security;
alter table budgets            enable row level security;
alter table goals              enable row level security;
alter table goal_contributions enable row level security;
alter table audit_log          enable row level security;

create policy accounts_do_workspace on accounts
  for all to aurum_app
  using (workspace_id = public.current_workspace_id() and public.is_member(workspace_id))
  with check (workspace_id = public.current_workspace_id() and public.is_member(workspace_id));

create policy transactions_do_workspace on transactions
  for all to aurum_app
  using (workspace_id = public.current_workspace_id() and public.is_member(workspace_id))
  with check (workspace_id = public.current_workspace_id() and public.is_member(workspace_id));

create policy recurring_rules_do_workspace on recurring_rules
  for all to aurum_app
  using (workspace_id = public.current_workspace_id() and public.is_member(workspace_id))
  with check (workspace_id = public.current_workspace_id() and public.is_member(workspace_id));

create policy budgets_do_workspace on budgets
  for all to aurum_app
  using (workspace_id = public.current_workspace_id() and public.is_member(workspace_id))
  with check (workspace_id = public.current_workspace_id() and public.is_member(workspace_id));

create policy goals_do_workspace on goals
  for all to aurum_app
  using (workspace_id = public.current_workspace_id() and public.is_member(workspace_id))
  with check (workspace_id = public.current_workspace_id() and public.is_member(workspace_id));

create policy goal_contributions_do_workspace on goal_contributions
  for all to aurum_app
  using (workspace_id = public.current_workspace_id() and public.is_member(workspace_id))
  with check (workspace_id = public.current_workspace_id() and public.is_member(workspace_id));

-- ── audit_log é append-only, e a policy é o que garante isso ────────────────
-- Duas policies em vez de `for all`: sem UPDATE e sem DELETE declarados,
-- ninguém edita nem apaga registro nenhum — nem o dono do workspace. Log que
-- se edita não serve para responder "esse valor mudou sozinho".
create policy audit_log_leitura on audit_log
  for select to aurum_app
  using (workspace_id = public.current_workspace_id() and public.is_member(workspace_id));

create policy audit_log_escrita on audit_log
  for insert to aurum_app
  with check (workspace_id = public.current_workspace_id() and public.is_member(workspace_id));

-- ── O que NÃO ganha escopo de workspace, e por quê ──────────────────────────
-- workspaces, workspace_members, workspace_invites e profiles continuam apenas
-- com is_member(): o switcher precisa listar TODOS os espaços da pessoa, e é
-- justamente antes de escolher um que não existe workspace ativo. Escopar essas
-- quatro deixaria o switcher sem nada para mostrar.
-- É o caso que withUserAcrossWorkspaces() atende.

-- ── updated_at deixa de depender de quem escreve a query ────────────────────
-- Confiar na aplicação para preencher significa que o primeiro UPDATE feito
-- pelo psql, por um script ou por uma query esquecida deixa a coluna mentindo.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger accounts_touch_updated_at
  before update on accounts
  for each row execute function public.touch_updated_at();

create trigger transactions_touch_updated_at
  before update on transactions
  for each row execute function public.touch_updated_at();

create trigger recurring_rules_touch_updated_at
  before update on recurring_rules
  for each row execute function public.touch_updated_at();

create trigger budgets_touch_updated_at
  before update on budgets
  for each row execute function public.touch_updated_at();

create trigger goals_touch_updated_at
  before update on goals
  for each row execute function public.touch_updated_at();

create trigger profiles_touch_updated_at
  before update on profiles
  for each row execute function public.touch_updated_at();

-- ── goals.saved_cents acompanha os aportes, na mesma transação ──────────────
-- O denormalizado só se justifica se for impossível divergir. Em trigger, o
-- aporte e o total do cofrinho commitam juntos ou não commitam.
create or replace function public.sincronizar_saved_cents()
returns trigger
language plpgsql
as $$
declare
  -- Num trigger de DELETE o registro `new` não está atribuído, e tocá-lo é
  -- erro de execução. O alvo é resolvido antes, uma vez.
  alvo uuid := case when tg_op = 'DELETE' then old.goal_id else new.goal_id end;
begin
  if tg_op = 'DELETE' then
    update goals set saved_cents = saved_cents - old.amount_cents
    where id = old.goal_id;

  elsif tg_op = 'UPDATE' then
    -- O aporte pode ter sido movido de um cofrinho para outro.
    if old.goal_id <> new.goal_id then
      update goals set saved_cents = saved_cents - old.amount_cents
      where id = old.goal_id;

      update goals set saved_cents = saved_cents + new.amount_cents
      where id = new.goal_id;
    else
      update goals set saved_cents = saved_cents - old.amount_cents + new.amount_cents
      where id = new.goal_id;
    end if;

  else
    update goals set saved_cents = saved_cents + new.amount_cents
    where id = new.goal_id;
  end if;

  -- O UPDATE acima passa pela RLS como qualquer outro. Se a policy o filtrar,
  -- o aporte entraria e o total ficaria para trás — divergência silenciosa, que
  -- é exatamente o que este trigger existe para impedir.
  --
  -- DELETE fica de fora da checagem: apagar o workspace apaga metas e aportes
  -- em cascata, e a meta pode já ter sumido quando o aporte dispara este
  -- trigger. Ali não há total para corrigir, então não há divergência possível.
  if not found and tg_op <> 'DELETE' then
    raise exception 'aporte sem cofrinho alcançável: goal_id %', alvo;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

create trigger goal_contributions_sincroniza_total
  after insert or update or delete on goal_contributions
  for each row execute function public.sincronizar_saved_cents();
