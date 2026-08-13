import { randomUUID } from "node:crypto";

import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { dbApp, dbAuth } from "@/lib/db/client";
import { withUser } from "@/lib/db/with-user";

import {
  categoriaFolha,
  criarConta,
  criarPessoa,
  criarTransacao,
  limpar,
  recusadoPelaRls,
  type Pessoa,
} from "./_fixtures";

/**
 * O teste que o §4.3 exige: logar como A, tentar ler dados de B, esperar zero
 * linhas. Roda contra o Postgres do docker-compose, não contra nuvem nenhuma.
 *
 * Aqui se prova o isolamento entre PESSOAS. O recorte por workspace da mesma
 * pessoa é o assunto de escopo-workspace.test.ts.
 */

let ana: Pessoa;
let bruno: Pessoa;

beforeAll(async () => {
  ana = await criarPessoa("Ana");
  bruno = await criarPessoa("Bruno");

  // Cada uma com um extrato próprio, para haver o que tentar ler do outro.
  const contaAna = await criarConta(ana.workspaceId);
  const contaBruno = await criarConta(bruno.workspaceId);

  await criarTransacao(
    ana.workspaceId,
    contaAna,
    await categoriaFolha(ana.workspaceId),
    "Mercado da Ana",
  );
  await criarTransacao(
    bruno.workspaceId,
    contaBruno,
    await categoriaFolha(bruno.workspaceId),
    "Mercado do Bruno",
  );
});

afterAll(async () => {
  await limpar([ana.workspaceId, bruno.workspaceId], [ana.email, bruno.email]);
});

describe("pré-condições da suíte", () => {
  it("aurum_app não é superusuário nem tem BYPASSRLS", async () => {
    // Sem isto, TODOS os casos abaixo passariam mesmo com a RLS desligada.
    const r = await dbApp.execute(sql`
      select rolsuper, rolbypassrls from pg_roles where rolname = current_user
    `);

    expect(r.rows[0]).toMatchObject({ rolsuper: false, rolbypassrls: false });
  });

  it("os dois pools usam roles diferentes", async () => {
    const app = await dbApp.execute(sql`select current_user as quem`);
    const auth = await dbAuth.execute(sql`select current_user as quem`);

    expect(app.rows[0]!.quem).not.toBe(auth.rows[0]!.quem);
  });

  it("toda tabela de domínio tem RLS ligada", async () => {
    // A regra 2 não abre exceção, e uma tabela nova que esqueça o
    // `enable row level security` é invisível para os outros casos daqui.
    const r = await dbAuth.execute(sql`
      select relname from pg_class
      where relnamespace = 'public'::regnamespace
        and relkind = 'r'
        and not relrowsecurity
        and relname not in ('session', 'account', 'verification', '__drizzle_migrations')
    `);

    expect(r.rows.map((linha) => String(linha.relname))).toEqual([]);
  });

  it("o cadastro cria workspace pessoal e copia o catálogo", async () => {
    const r = await dbAuth.execute(sql`
      select w.type, (select count(*) from categories c where c.workspace_id = w.id) as categorias
      from workspaces w where w.id = ${ana.workspaceId}::uuid
    `);

    expect(r.rows[0]!.type).toBe("personal");
    expect(Number(r.rows[0]!.categorias)).toBe(65);
  });
});

describe("sem sujeito na sessão, o banco não entrega nada", () => {
  it.each([
    "workspaces",
    "categories",
    "workspace_members",
    "profiles",
    "accounts",
    "transactions",
    "recurring_rules",
    "budgets",
    "goals",
    "goal_contributions",
    "audit_log",
  ])("%s devolve zero linhas", async (tabela) => {
    const r = await dbApp.execute(
      sql`select count(*)::int as n from ${sql.identifier(tabela)}`,
    );

    expect(r.rows[0]!.n).toBe(0);
  });
});

describe("com sujeito, cada um enxerga só o que é seu", () => {
  it("Ana vê o próprio workspace e nenhum outro", async () => {
    const ids = await withUser(ana.userId, ana.workspaceId, async (tx) => {
      const r = await tx.execute(sql`select id from workspaces`);
      return r.rows.map((linha) => String(linha.id));
    });

    expect(ids).toEqual([ana.workspaceId]);
  });

  it("Ana lê as próprias 65 categorias e nenhuma do Bruno", async () => {
    const { minhas, doBruno } = await withUser(
      ana.userId,
      ana.workspaceId,
      async (tx) => {
        const todas = await tx.execute(
          sql`select count(*)::int as n from categories`,
        );
        const alheias = await tx.execute(sql`
          select count(*)::int as n from categories
          where workspace_id = ${bruno.workspaceId}::uuid
        `);

        return {
          minhas: todas.rows[0]!.n,
          doBruno: alheias.rows[0]!.n,
        };
      },
    );

    expect(minhas).toBe(65);
    expect(doBruno).toBe(0);
  });

  it("Ana lê o próprio extrato e não o do Bruno", async () => {
    const descricoes = await withUser(
      ana.userId,
      ana.workspaceId,
      async (tx) => {
        const r = await tx.execute(sql`select description from transactions`);
        return r.rows.map((linha) => String(linha.description));
      },
    );

    expect(descricoes).toEqual(["Mercado da Ana"]);
  });

  it("Ana não enxerga as contas do Bruno", async () => {
    const n = await withUser(ana.userId, ana.workspaceId, async (tx) => {
      const r = await tx.execute(sql`select count(*)::int as n from accounts`);
      return r.rows[0]!.n;
    });

    expect(n).toBe(1);
  });

  it("Ana não enxerga o perfil do Bruno enquanto não dividirem workspace", async () => {
    const emails = await withUser(ana.userId, ana.workspaceId, async (tx) => {
      const r = await tx.execute(sql`select email from profiles`);
      return r.rows.map((linha) => String(linha.email));
    });

    expect(emails).toEqual([ana.email]);
  });

  it("informar o workspace do Bruno na variável não abre nada", async () => {
    // A policy tem DUAS cláusulas justamente por isto: a variável de sessão
    // sozinha não é credencial, `is_member()` continua barrando.
    const n = await withUser(ana.userId, bruno.workspaceId, async (tx) => {
      const r = await tx.execute(
        sql`select count(*)::int as n from transactions`,
      );
      return r.rows[0]!.n;
    });

    expect(n).toBe(0);
  });
});

describe("a escrita respeita a mesma fronteira", () => {
  it("Ana não consegue criar categoria no workspace do Bruno", async () => {
    await recusadoPelaRls(
      withUser(ana.userId, bruno.workspaceId, (tx) =>
        tx.execute(sql`
          insert into categories (workspace_id, name, kind)
          values (${bruno.workspaceId}::uuid, 'Invasão', 'expense')
        `),
      ),
    );
  });

  it("Ana não consegue lançar no extrato do Bruno", async () => {
    const contaBruno = await dbAuth.execute(sql`
      select id from accounts where workspace_id = ${bruno.workspaceId}::uuid limit 1
    `);
    const contaId = String(contaBruno.rows[0]!.id);
    const categoriaId = await categoriaFolha(bruno.workspaceId);

    await recusadoPelaRls(
      withUser(ana.userId, bruno.workspaceId, (tx) =>
        tx.execute(sql`
          insert into transactions
            (workspace_id, account_id, category_id, type, amount_cents, date, competence_date, description)
          values
            (${bruno.workspaceId}::uuid, ${contaId}::uuid, ${categoriaId}::uuid, 'expense',
             999, '2026-08-12', '2026-08-12', 'Invasão')
        `),
      ),
    );
  });

  it("Ana consegue criar categoria no próprio workspace", async () => {
    const nome = `Minha ${randomUUID().slice(0, 8)}`;

    await withUser(ana.userId, ana.workspaceId, (tx) =>
      tx.execute(sql`
        insert into categories (workspace_id, name, kind)
        values (${ana.workspaceId}::uuid, ${nome}, 'expense')
      `),
    );

    const n = await withUser(ana.userId, ana.workspaceId, async (tx) => {
      const r = await tx.execute(
        sql`select count(*)::int as n from categories where name = ${nome}`,
      );
      return r.rows[0]!.n;
    });

    expect(n).toBe(1);
  });

  it("Ana não consegue mudar o próprio papel para owner de outro workspace", async () => {
    // workspace_members não tem policy de escrita: papel só muda pelo caminho
    // do Better Auth, nunca pelo próprio usuário.
    await recusadoPelaRls(
      withUser(ana.userId, ana.workspaceId, (tx) =>
        tx.execute(sql`
          insert into workspace_members (organization_id, user_id, role)
          values (${bruno.workspaceId}::uuid, ${ana.userId}::uuid, 'owner')
        `),
      ),
    );
  });

  it("o log de auditoria não se edita nem se apaga", async () => {
    await withUser(ana.userId, ana.workspaceId, (tx) =>
      tx.execute(sql`
        insert into audit_log (workspace_id, actor_id, entity, entity_id, action)
        values (${ana.workspaceId}::uuid, ${ana.userId}::uuid, 'accounts',
                ${randomUUID()}::uuid, 'create')
      `),
    );

    // Sem policy de UPDATE e de DELETE, as duas afetam zero linhas em vez de
    // estourar — e é o suficiente: o registro continua lá.
    const sobrou = await withUser(ana.userId, ana.workspaceId, async (tx) => {
      await tx.execute(sql`update audit_log set action = 'delete'`);
      await tx.execute(sql`delete from audit_log`);

      const r = await tx.execute(sql`
          select count(*)::int as n from audit_log where action = 'create'
        `);
      return r.rows[0]!.n;
    });

    expect(sobrou).toBe(1);
  });
});

describe("o sujeito não sobrevive à transação", () => {
  it("as duas variáveis voltam a ficar vazias depois do withUser", async () => {
    await withUser(ana.userId, ana.workspaceId, (tx) =>
      tx.execute(sql`select 1 as ok`),
    );

    // A mesma conexão volta ao pool. Se o set_config não fosse local, a próxima
    // requisição leria o banco como o usuário anterior.
    const r = await dbApp.execute(sql`
      select coalesce(current_setting('app.user_id', true), '')      as uid,
             coalesce(current_setting('app.workspace_id', true), '') as wid
    `);

    expect(r.rows[0]).toMatchObject({ uid: "", wid: "" });
  });
});
