import { randomUUID } from "node:crypto";

import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { withUser } from "@/lib/db/with-user";

import {
  categoriaFolha,
  criarConta,
  criarPessoa,
  criarTransacao,
  limpar,
  recusadoPor,
  type Pessoa,
} from "./_fixtures";

/**
 * As regras que o SCHEMA garante, e que por isso nenhuma camada acima precisa
 * lembrar de garantir.
 *
 * Rodam junto da suíte de RLS por dependerem do mesmo Postgres do
 * docker-compose — check constraint não existe em teste unitário.
 */

let ana: Pessoa;
let conta: string;
let categoria: string;

beforeAll(async () => {
  ana = await criarPessoa("Ana");
  conta = await criarConta(ana.workspaceId);
  categoria = await categoriaFolha(ana.workspaceId);
});

afterAll(async () => {
  await limpar([ana.workspaceId], [ana.email]);
});

function lancar(campos: {
  type?: string;
  amount?: number;
  categoria?: string | null;
  grupo?: string | null;
  direcao?: string | null;
  status?: string;
  vencimento?: string | null;
  parcela?: number | null;
  parcelas?: number | null;
}): Promise<unknown> {
  const {
    type = "expense",
    amount = 1000,
    categoria: cat = categoria,
    grupo = null,
    direcao = null,
    status = "cleared",
    vencimento = null,
    parcela = null,
    parcelas = null,
  } = campos;

  return withUser(ana.userId, ana.workspaceId, (tx) =>
    tx.execute(sql`
      insert into transactions
        (workspace_id, account_id, category_id, type, amount_cents, date,
         competence_date, description, transfer_group_id, direction, status,
         due_date, installment_no, installment_total)
      values
        (${ana.workspaceId}::uuid, ${conta}::uuid, ${cat}::uuid, ${type},
         ${amount}, '2026-08-12', '2026-08-12', 'teste',
         ${grupo}::uuid, ${direcao}, ${status}, ${vencimento}::date,
         ${parcela}, ${parcelas})
    `),
  );
}

describe("dinheiro", () => {
  it("valor é sempre positivo — o sinal vem do type", async () => {
    await recusadoPor(lancar({ amount: -1000 }), /transactions_amount_check/);
    await recusadoPor(lancar({ amount: 0 }), /transactions_amount_check/);
  });

  it("o BIGINT sobrevive a valores que estourariam um int4", async () => {
    // R$ 30 milhões em centavos passa de 2^31: a coluna precisa ser BIGINT.
    const id = await criarTransacao(
      ana.workspaceId,
      conta,
      categoria,
      "valor grande",
      3_000_000_000,
    );

    const lido = await withUser(ana.userId, ana.workspaceId, async (tx) => {
      const r = await tx.execute(
        sql`select amount_cents from transactions where id = ${id}::uuid`,
      );
      return r.rows[0]!.amount_cents;
    });

    // O driver devolve BIGINT como string — é o que `parseCents` recebe.
    expect(String(lido)).toBe("3000000000");
  });
});

describe("transferência", () => {
  it("exige grupo e direção", async () => {
    await recusadoPor(
      lancar({ type: "transfer", categoria: null }),
      /transactions_transfer_shape_check/,
    );
  });

  it("não aceita direção fora de in|out", async () => {
    await recusadoPor(
      lancar({
        type: "transfer",
        categoria: null,
        grupo: randomUUID(),
        direcao: "lateral",
      }),
      /transactions_transfer_shape_check/,
    );
  });

  it("não pode ter categoria — mover dinheiro entre contas próprias não é gasto", async () => {
    await recusadoPor(
      lancar({ type: "transfer", grupo: randomUUID(), direcao: "out" }),
      /transactions_category_shape_check/,
    );
  });

  it("aceita as duas pernas com o mesmo grupo", async () => {
    const grupo = randomUUID();

    await lancar({
      type: "transfer",
      categoria: null,
      grupo,
      direcao: "out",
    });
    await lancar({ type: "transfer", categoria: null, grupo, direcao: "in" });

    const pernas = await withUser(ana.userId, ana.workspaceId, async (tx) => {
      const r = await tx.execute(sql`
        select direction from transactions
        where transfer_group_id = ${grupo}::uuid order by direction
      `);
      return r.rows.map((linha) => String(linha.direction));
    });

    expect(pernas).toEqual(["in", "out"]);
  });

  it("despesa não pode carregar grupo de transferência", async () => {
    await recusadoPor(
      lancar({ grupo: randomUUID(), direcao: "out" }),
      /transactions_transfer_shape_check/,
    );
  });
});

describe("categoria e parcelamento", () => {
  it("receita e despesa exigem categoria", async () => {
    await recusadoPor(
      lancar({ categoria: null }),
      /transactions_category_shape_check/,
    );
  });

  it("parcela sem total, ou total sem parcela, é recusada", async () => {
    await recusadoPor(lancar({ parcela: 1 }), /transactions_installment_check/);
    await recusadoPor(
      lancar({ parcelas: 3 }),
      /transactions_installment_check/,
    );
  });

  it("parcela não pode passar do total", async () => {
    await recusadoPor(
      lancar({ parcela: 4, parcelas: 3 }),
      /transactions_installment_check/,
    );
  });

  it("aceita 2 de 3", async () => {
    await expect(lancar({ parcela: 2, parcelas: 3 })).resolves.toBeDefined();
  });
});

describe("a pagar", () => {
  it("pendente exige vencimento — é o que o semáforo ordena", async () => {
    await recusadoPor(
      lancar({ status: "pending" }),
      /transactions_due_date_check/,
    );
  });

  it("pendente com vencimento passa", async () => {
    await expect(
      lancar({ status: "pending", vencimento: "2026-09-10" }),
    ).resolves.toBeDefined();
  });
});

describe("conta", () => {
  it("campos de cartão só existem em cartão de crédito", async () => {
    await recusadoPor(
      withUser(ana.userId, ana.workspaceId, (tx) =>
        tx.execute(sql`
          insert into accounts (workspace_id, name, type, closing_day)
          values (${ana.workspaceId}::uuid, 'Corrente com fatura', 'checking', 10)
        `),
      ),
      /accounts_credit_card_fields_check/,
    );
  });

  it("cartão de crédito aceita fechamento e vencimento", async () => {
    await expect(
      withUser(ana.userId, ana.workspaceId, (tx) =>
        tx.execute(sql`
          insert into accounts (workspace_id, name, type, closing_day, due_day, credit_limit_cents)
          values (${ana.workspaceId}::uuid, 'Cartão', 'credit_card', 28, 5, 500000)
        `),
      ),
    ).resolves.toBeDefined();
  });

  it("conta com lançamento não se apaga — arquiva-se", async () => {
    await recusadoPor(
      withUser(ana.userId, ana.workspaceId, (tx) =>
        tx.execute(sql`delete from accounts where id = ${conta}::uuid`),
      ),
      /transactions_account_id_accounts_id_fk|violates foreign key/i,
    );
  });
});

describe("orçamento", () => {
  it("o período é sempre o dia 1", async () => {
    await recusadoPor(
      withUser(ana.userId, ana.workspaceId, (tx) =>
        tx.execute(sql`
          insert into budgets (workspace_id, category_id, period, limit_cents)
          values (${ana.workspaceId}::uuid, ${categoria}::uuid, '2026-09-15', 50000)
        `),
      ),
      /budgets_period_is_first_day_check/,
    );
  });

  it("não há dois orçamentos para a mesma categoria no mesmo mês", async () => {
    await withUser(ana.userId, ana.workspaceId, (tx) =>
      tx.execute(sql`
        insert into budgets (workspace_id, category_id, period, limit_cents)
        values (${ana.workspaceId}::uuid, ${categoria}::uuid, '2026-09-01', 50000)
      `),
    );

    await recusadoPor(
      withUser(ana.userId, ana.workspaceId, (tx) =>
        tx.execute(sql`
          insert into budgets (workspace_id, category_id, period, limit_cents)
          values (${ana.workspaceId}::uuid, ${categoria}::uuid, '2026-09-01', 90000)
        `),
      ),
      /budgets_workspace_category_period_key/,
    );
  });
});

describe("meta e aportes", () => {
  it("saved_cents acompanha os aportes na mesma transação", async () => {
    const total = await withUser(ana.userId, ana.workspaceId, async (tx) => {
      const meta = await tx.execute(sql`
          insert into goals (workspace_id, name, target_cents)
          values (${ana.workspaceId}::uuid, 'Reserva', 1000000)
          returning id
        `);
      const metaId = String(meta.rows[0]!.id);

      await tx.execute(sql`
          insert into goal_contributions (workspace_id, goal_id, amount_cents, date)
          values (${ana.workspaceId}::uuid, ${metaId}::uuid, 30000, '2026-08-01')
        `);
      await tx.execute(sql`
          insert into goal_contributions (workspace_id, goal_id, amount_cents, date)
          values (${ana.workspaceId}::uuid, ${metaId}::uuid, 20000, '2026-08-10')
        `);
      // Resgate: o histórico registra a saída em vez de apagar o aporte.
      await tx.execute(sql`
          insert into goal_contributions (workspace_id, goal_id, amount_cents, date)
          values (${ana.workspaceId}::uuid, ${metaId}::uuid, -5000, '2026-08-11')
        `);

      const r = await tx.execute(
        sql`select saved_cents from goals where id = ${metaId}::uuid`,
      );
      return String(r.rows[0]!.saved_cents);
    });

    expect(total).toBe("45000");
  });

  it("apagar o aporte devolve o total", async () => {
    const total = await withUser(ana.userId, ana.workspaceId, async (tx) => {
      const meta = await tx.execute(sql`
          insert into goals (workspace_id, name, target_cents)
          values (${ana.workspaceId}::uuid, 'Viagem', 500000)
          returning id
        `);
      const metaId = String(meta.rows[0]!.id);

      const aporte = await tx.execute(sql`
          insert into goal_contributions (workspace_id, goal_id, amount_cents, date)
          values (${ana.workspaceId}::uuid, ${metaId}::uuid, 12345, '2026-08-01')
          returning id
        `);

      await tx.execute(
        sql`delete from goal_contributions where id = ${String(aporte.rows[0]!.id)}::uuid`,
      );

      const r = await tx.execute(
        sql`select saved_cents from goals where id = ${metaId}::uuid`,
      );
      return String(r.rows[0]!.saved_cents);
    });

    expect(total).toBe("0");
  });

  it("não se resgata mais do que a meta tem", async () => {
    await recusadoPor(
      withUser(ana.userId, ana.workspaceId, async (tx) => {
        const meta = await tx.execute(sql`
          insert into goals (workspace_id, name, target_cents)
          values (${ana.workspaceId}::uuid, 'Estouro', 500000)
          returning id
        `);

        return tx.execute(sql`
          insert into goal_contributions (workspace_id, goal_id, amount_cents, date)
          values (${ana.workspaceId}::uuid, ${String(meta.rows[0]!.id)}::uuid, -100, '2026-08-01')
        `);
      }),
      /goals_saved_check/,
    );
  });
});
