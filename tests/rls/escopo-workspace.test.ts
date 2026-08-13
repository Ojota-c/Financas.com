import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { withUser, withUserAcrossWorkspaces } from "@/lib/db/with-user";

import {
  categoriaFolha,
  criarConta,
  criarPessoa,
  criarTransacao,
  criarWorkspaceCompartilhado,
  limpar,
  recusadoPelaRls,
  type Pessoa,
} from "./_fixtures";

/**
 * O caso que o isolamento entre pessoas NÃO cobre: a mesma pessoa, com dois
 * workspaces.
 *
 * `is_member()` sozinho libera as linhas dos dois de uma vez. O erro que isso
 * produz não é vazamento para estranho — é o saldo do espaço compartilhado
 * entrando na conta do pessoal. Não dispara alarme, não aparece em log, e só é
 * notado quando o número não bate com a realidade.
 *
 * Estes casos existem para que `app.workspace_id` não possa ser removida sem
 * que algo fique vermelho.
 */

let ana: Pessoa;
let casa: string;

beforeAll(async () => {
  ana = await criarPessoa("Ana");
  casa = await criarWorkspaceCompartilhado(ana.userId, "Casa");

  const contaPessoal = await criarConta(ana.workspaceId, "Nubank");
  const contaCasa = await criarConta(casa, "Conta conjunta");

  await criarTransacao(
    ana.workspaceId,
    contaPessoal,
    await categoriaFolha(ana.workspaceId),
    "Almoço meu",
    5000,
  );
  await criarTransacao(
    casa,
    contaCasa,
    await categoriaFolha(casa),
    "Mercado da casa",
    30000,
  );
});

afterAll(async () => {
  await limpar([ana.workspaceId, casa], [ana.email]);
});

describe("a mesma pessoa, dois workspaces", () => {
  it("no espaço pessoal ela vê só o extrato pessoal", async () => {
    const linhas = await withUser(ana.userId, ana.workspaceId, async (tx) => {
      const r = await tx.execute(
        sql`select description, amount_cents from transactions`,
      );
      return r.rows;
    });

    expect(linhas).toHaveLength(1);
    expect(linhas[0]!.description).toBe("Almoço meu");
  });

  it("no espaço da casa ela vê só o extrato da casa", async () => {
    const linhas = await withUser(ana.userId, casa, async (tx) => {
      const r = await tx.execute(sql`select description from transactions`);
      return r.rows.map((linha) => String(linha.description));
    });

    expect(linhas).toEqual(["Mercado da casa"]);
  });

  it("a soma do espaço aberto não mistura o outro — o bug que o escopo existe para impedir", async () => {
    const total = await withUser(ana.userId, ana.workspaceId, async (tx) => {
      // Repare: NENHUM `where workspace_id`. É o banco que recorta.
      const r = await tx.execute(
        sql`select coalesce(sum(amount_cents), 0)::bigint as total from transactions`,
      );
      return Number(r.rows[0]!.total);
    });

    // 5000, e não 35000.
    expect(total).toBe(5000);
  });

  it("as contas também respeitam o espaço aberto", async () => {
    const pessoais = await withUser(ana.userId, ana.workspaceId, async (tx) => {
      const r = await tx.execute(sql`select name from accounts`);
      return r.rows.map((linha) => String(linha.name));
    });

    const daCasa = await withUser(ana.userId, casa, async (tx) => {
      const r = await tx.execute(sql`select name from accounts`);
      return r.rows.map((linha) => String(linha.name));
    });

    expect(pessoais).toEqual(["Nubank"]);
    expect(daCasa).toEqual(["Conta conjunta"]);
  });

  it("escrever no espaço aberto informando o workspace do outro é recusado", async () => {
    const contaCasa = await withUser(ana.userId, casa, async (tx) => {
      const r = await tx.execute(sql`select id from accounts limit 1`);
      return String(r.rows[0]!.id);
    });

    // Ana É membro dos dois — `is_member()` deixaria passar. Quem barra aqui é
    // o `with check` do escopo.
    await recusadoPelaRls(
      withUser(ana.userId, ana.workspaceId, (tx) =>
        tx.execute(sql`
          insert into accounts (workspace_id, name, type)
          values (${casa}::uuid, 'Contrabando', 'checking')
        `),
      ),
    );

    expect(contaCasa).toBeTruthy();
  });

  it("mover uma linha de um espaço para o outro é recusado", async () => {
    await recusadoPelaRls(
      withUser(ana.userId, ana.workspaceId, (tx) =>
        tx.execute(
          sql`update accounts set workspace_id = ${casa}::uuid where name = 'Nubank'`,
        ),
      ),
    );
  });
});

describe("withUserAcrossWorkspaces — a exceção, e o que ela custa", () => {
  it("enxerga todos os workspaces da pessoa, que é para o que serve", async () => {
    const ids = await withUserAcrossWorkspaces(ana.userId, async (tx) => {
      const r = await tx.execute(sql`select id from workspaces order by type`);
      return r.rows.map((linha) => String(linha.id));
    });

    expect(ids).toHaveLength(2);
    expect(ids).toContain(ana.workspaceId);
    expect(ids).toContain(casa);
  });

  it("não enxerga dado de domínio nenhum, porque não há espaço aberto", async () => {
    const contagens = await withUserAcrossWorkspaces(ana.userId, async (tx) => {
      const contas = await tx.execute(
        sql`select count(*)::int as n from accounts`,
      );
      const lancamentos = await tx.execute(
        sql`select count(*)::int as n from transactions`,
      );
      const categorias = await tx.execute(
        sql`select count(*)::int as n from categories`,
      );

      return [contas.rows[0]!.n, lancamentos.rows[0]!.n, categorias.rows[0]!.n];
    });

    expect(contagens).toEqual([0, 0, 0]);
  });
});
