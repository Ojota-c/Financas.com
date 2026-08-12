import { randomUUID } from "node:crypto";

import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { dbApp, dbAuth } from "@/lib/db/client";
import { withUser } from "@/lib/db/with-user";

/**
 * O teste que o §4.3 exige: logar como A, tentar ler dados de B, esperar zero
 * linhas. Roda contra o Postgres do docker-compose, não contra nuvem nenhuma.
 *
 * Escreve com `dbAuth` (dona das tabelas, ignora a RLS) e lê com `dbApp` (não é
 * dona, a RLS se aplica). Se um dia as duas apontarem para a mesma role, o
 * primeiro caso deste arquivo falha — é ele que prova que a suíte não está
 * passando por acidente.
 */

type Pessoa = { userId: string; workspaceId: string; email: string };

async function criarPessoa(nome: string): Promise<Pessoa> {
  const email = `${nome}-${randomUUID()}@teste.local`;

  const perfil = await dbAuth.execute(sql`
    insert into profiles (name, email, email_verified)
    values (${nome}, ${email}, true)
    returning id
  `);

  const userId = String(perfil.rows[0]!.id);

  // O workspace pessoal e as 65 categorias vêm dos triggers, não daqui.
  const workspace = await dbAuth.execute(sql`
    select organization_id from workspace_members where user_id = ${userId}::uuid
  `);

  return {
    userId,
    email,
    workspaceId: String(workspace.rows[0]!.organization_id),
  };
}

/**
 * O Drizzle embrulha o erro do Postgres num DrizzleQueryError cuja mensagem é
 * só "Failed query: ...". A recusa da policy fica no `cause`, então procurar na
 * mensagem de cima daria falso negativo — e um teste de isolamento que passa
 * por engano é pior do que não existir.
 */
async function recusadoPelaRls(promessa: Promise<unknown>): Promise<void> {
  let capturado: unknown;

  try {
    await promessa;
  } catch (erro) {
    capturado = erro;
  }

  expect(capturado, "a query deveria ter sido recusada").toBeDefined();

  const cadeia: string[] = [];
  let atual = capturado;
  while (atual instanceof Error) {
    cadeia.push(atual.message);
    atual = atual.cause;
  }

  expect(cadeia.join(" | ")).toMatch(/row-level security/i);
}

let ana: Pessoa;
let bruno: Pessoa;

beforeAll(async () => {
  ana = await criarPessoa("Ana");
  bruno = await criarPessoa("Bruno");
});

afterAll(async () => {
  await dbAuth.execute(
    sql`delete from profiles where email in (${ana.email}, ${bruno.email})`,
  );
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
  it.each(["workspaces", "categories", "workspace_members", "profiles"])(
    "%s devolve zero linhas",
    async (tabela) => {
      const r = await dbApp.execute(
        sql`select count(*)::int as n from ${sql.identifier(tabela)}`,
      );

      expect(r.rows[0]!.n).toBe(0);
    },
  );
});

describe("com sujeito, cada um enxerga só o que é seu", () => {
  it("Ana vê o próprio workspace e nenhum outro", async () => {
    const ids = await withUser(ana.userId, async (tx) => {
      const r = await tx.execute(sql`select id from workspaces`);
      return r.rows.map((linha) => String(linha.id));
    });

    expect(ids).toEqual([ana.workspaceId]);
  });

  it("Ana não lê as categorias do Bruno", async () => {
    const n = await withUser(ana.userId, async (tx) => {
      const r = await tx.execute(sql`
        select count(*)::int as n from categories
        where workspace_id = ${bruno.workspaceId}::uuid
      `);
      return r.rows[0]!.n;
    });

    expect(n).toBe(0);
  });

  it("Ana lê as próprias 65 categorias", async () => {
    const n = await withUser(ana.userId, async (tx) => {
      const r = await tx.execute(
        sql`select count(*)::int as n from categories`,
      );
      return r.rows[0]!.n;
    });

    expect(n).toBe(65);
  });

  it("Ana não enxerga o perfil do Bruno enquanto não dividirem workspace", async () => {
    const emails = await withUser(ana.userId, async (tx) => {
      const r = await tx.execute(sql`select email from profiles`);
      return r.rows.map((linha) => String(linha.email));
    });

    expect(emails).toEqual([ana.email]);
  });
});

describe("a escrita respeita a mesma fronteira", () => {
  it("Ana não consegue criar categoria no workspace do Bruno", async () => {
    await recusadoPelaRls(
      withUser(ana.userId, (tx) =>
        tx.execute(sql`
          insert into categories (workspace_id, name, kind)
          values (${bruno.workspaceId}::uuid, 'Invasão', 'expense')
        `),
      ),
    );
  });

  it("Ana consegue criar categoria no próprio workspace", async () => {
    const nome = `Minha ${randomUUID().slice(0, 8)}`;

    await withUser(ana.userId, (tx) =>
      tx.execute(sql`
        insert into categories (workspace_id, name, kind)
        values (${ana.workspaceId}::uuid, ${nome}, 'expense')
      `),
    );

    const n = await withUser(ana.userId, async (tx) => {
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
      withUser(ana.userId, (tx) =>
        tx.execute(sql`
          insert into workspace_members (organization_id, user_id, role)
          values (${bruno.workspaceId}::uuid, ${ana.userId}::uuid, 'owner')
        `),
      ),
    );
  });
});

describe("o sujeito não sobrevive à transação", () => {
  it("app.user_id volta a ficar vazio depois do withUser", async () => {
    await withUser(ana.userId, (tx) => tx.execute(sql`select 1 as ok`));

    // A mesma conexão volta ao pool. Se o set_config não fosse local, a próxima
    // requisição leria o banco como o usuário anterior.
    const r = await dbApp.execute(
      sql`select coalesce(current_setting('app.user_id', true), '') as uid`,
    );

    expect(r.rows[0]!.uid).toBe("");
  });
});
