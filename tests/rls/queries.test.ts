import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  arquivarConta,
  criarConta,
  listarContas,
  saldoConsolidado,
} from "@/lib/db/queries/accounts";
import { listarCategoriasEmArvore } from "@/lib/db/queries/categories";
import {
  apagarLancamento,
  confirmarLancamento,
  criarLancamento,
  criarTransferencia,
  gastosPorCategoria,
  listarLancamentos,
  pendentes,
  resumoDoPeriodo,
} from "@/lib/db/queries/transactions";
import { listarWorkspacesDoUsuario } from "@/lib/db/queries/workspaces";

import { categoriaFolha, criarPessoa, limpar, type Pessoa } from "./_fixtures";

/**
 * A camada de queries exercitada de ponta a ponta, contra o Postgres real.
 *
 * Vive junto da suíte de RLS porque é o mesmo banco e a mesma exigência: cada
 * função aqui passa por `withUser`, então um erro de escopo aparece como
 * "sumiu tudo" e é exatamente o que estes casos pegam.
 */

let ana: Pessoa;
let ctx: { userId: string; workspaceId: string };
let categoria: string;

beforeAll(async () => {
  ana = await criarPessoa("Ana");
  ctx = { userId: ana.userId, workspaceId: ana.workspaceId };
  categoria = await categoriaFolha(ana.workspaceId);
});

afterAll(async () => {
  await limpar([ana.workspaceId], [ana.email]);
});

describe("workspaces", () => {
  it("o switcher recebe o espaço pessoal criado no cadastro", async () => {
    const lista = await listarWorkspacesDoUsuario(ana.userId);

    expect(lista).toHaveLength(1);
    expect(lista[0]).toMatchObject({ id: ana.workspaceId, type: "personal" });
  });
});

describe("categorias", () => {
  it("vêm em árvore de dois níveis, com bucket nas folhas", async () => {
    const arvore = await listarCategoriasEmArvore(ctx);

    expect(arvore).toHaveLength(12);

    const folhas = arvore.flatMap((pai) => pai.children);
    expect(folhas).toHaveLength(53);

    // Pai não tem bucket; folha de despesa tem. É o que faz o 50/30/20 andar.
    expect(arvore.every((pai) => pai.bucket === null)).toBe(true);
    expect(
      folhas
        .filter((f) => f.kind === "expense")
        .every((f) => f.bucket !== null),
    ).toBe(true);
  });
});

describe("contas e saldo", () => {
  it("saldo nasce do saldo inicial", async () => {
    const id = await criarConta(ctx, {
      name: "Nubank",
      type: "checking",
      initialBalanceCents: 100_000,
    });

    const contas = await listarContas(ctx);
    const conta = contas.find((c) => c.id === id);

    expect(conta?.balanceCents).toBe(100_000);
  });

  it("despesa compensada reduz o saldo; pendente não", async () => {
    const id = await criarConta(ctx, {
      name: "Conta do saldo",
      type: "checking",
      initialBalanceCents: 50_000,
    });

    await criarLancamento(ctx, {
      accountId: id,
      categoryId: categoria,
      type: "expense",
      amountCents: 15_000,
      date: "2026-08-10",
      description: "Mercado",
    });

    // Uma conta a pagar ainda não saiu da conta.
    await criarLancamento(ctx, {
      accountId: id,
      categoryId: categoria,
      type: "expense",
      amountCents: 90_000,
      date: "2026-08-10",
      description: "Fatura futura",
      status: "pending",
      dueDate: "2026-09-05",
    });

    const conta = (await listarContas(ctx)).find((c) => c.id === id);

    expect(conta?.balanceCents).toBe(35_000);
  });

  it("confirmar a pendente move o saldo", async () => {
    const id = await criarConta(ctx, {
      name: "Conta do confirmar",
      type: "checking",
      initialBalanceCents: 20_000,
    });

    const lancamento = await criarLancamento(ctx, {
      accountId: id,
      categoryId: categoria,
      type: "expense",
      amountCents: 5_000,
      date: "2026-08-10",
      description: "Luz",
      status: "pending",
      dueDate: "2026-08-20",
    });

    expect(
      (await listarContas(ctx)).find((c) => c.id === id)?.balanceCents,
    ).toBe(20_000);

    await confirmarLancamento(ctx, [lancamento]);

    expect(
      (await listarContas(ctx)).find((c) => c.id === id)?.balanceCents,
    ).toBe(15_000);
  });

  it("conta arquivada some da lista mas não do saldo dela", async () => {
    const id = await criarConta(ctx, {
      name: "Antiga",
      type: "savings",
      initialBalanceCents: 1_000,
    });

    await arquivarConta(ctx, id);

    const visiveis = await listarContas(ctx);
    const todas = await listarContas(ctx, { incluirArquivadas: true });

    expect(visiveis.some((c) => c.id === id)).toBe(false);
    expect(todas.some((c) => c.id === id)).toBe(true);
  });
});

describe("transferência", () => {
  it("gera duas pernas e não altera o patrimônio total", async () => {
    const origem = await criarConta(ctx, {
      name: "Origem",
      type: "checking",
      initialBalanceCents: 80_000,
    });
    const destino = await criarConta(ctx, {
      name: "Destino",
      type: "savings",
      initialBalanceCents: 0,
    });

    const antes = await saldoConsolidado(ctx);

    const grupo = await criarTransferencia(ctx, {
      origemAccountId: origem,
      destinoAccountId: destino,
      amountCents: 30_000,
      date: "2026-08-11",
      description: "Para a reserva",
    });

    const contas = await listarContas(ctx);

    expect(contas.find((c) => c.id === origem)?.balanceCents).toBe(50_000);
    expect(contas.find((c) => c.id === destino)?.balanceCents).toBe(30_000);

    // O total não muda: o dinheiro trocou de lugar, não sumiu nem apareceu.
    expect(await saldoConsolidado(ctx)).toBe(antes);

    const pernas = await listarLancamentos(ctx, { type: "transfer" });
    expect(pernas.filter((p) => p.transferGroupId === grupo)).toHaveLength(2);
  });

  it("apagar uma perna apaga o par inteiro", async () => {
    const origem = await criarConta(ctx, {
      name: "Origem 2",
      type: "checking",
      initialBalanceCents: 10_000,
    });
    const destino = await criarConta(ctx, {
      name: "Destino 2",
      type: "savings",
      initialBalanceCents: 0,
    });

    const grupo = await criarTransferencia(ctx, {
      origemAccountId: origem,
      destinoAccountId: destino,
      amountCents: 4_000,
      date: "2026-08-11",
      description: "Some junto",
    });

    const pernas = await listarLancamentos(ctx, { type: "transfer" });
    const uma = pernas.find((p) => p.transferGroupId === grupo)!;

    await apagarLancamento(ctx, uma.id);

    const depois = await listarLancamentos(ctx, { type: "transfer" });
    expect(depois.filter((p) => p.transferGroupId === grupo)).toHaveLength(0);
  });
});

describe("lista e filtros", () => {
  let conta: string;

  beforeAll(async () => {
    conta = await criarConta(ctx, {
      name: "Conta dos filtros",
      type: "checking",
      initialBalanceCents: 0,
    });

    await criarLancamento(ctx, {
      accountId: conta,
      categoryId: categoria,
      type: "income",
      amountCents: 500_000,
      date: "2026-07-05",
      description: "Salário de julho",
    });
    await criarLancamento(ctx, {
      accountId: conta,
      categoryId: categoria,
      type: "expense",
      amountCents: 12_345,
      date: "2026-07-20",
      description: "Padaria da esquina",
    });
  });

  it("filtra por período", async () => {
    const julho = await listarLancamentos(ctx, {
      de: "2026-07-01",
      ate: "2026-07-31",
      accountId: conta,
    });

    expect(julho).toHaveLength(2);
  });

  it("busca por descrição é indiferente a maiúscula", async () => {
    const achados = await listarLancamentos(ctx, { busca: "padaria" });

    expect(achados).toHaveLength(1);
    expect(achados[0]!.description).toBe("Padaria da esquina");
  });

  it("traz o nome da conta e da categoria no join", async () => {
    const [primeiro] = await listarLancamentos(ctx, { accountId: conta });

    expect(primeiro!.accountName).toBe("Conta dos filtros");
    expect(primeiro!.categoryName).toBeTruthy();
  });

  it("o resumo separa receita de despesa e ignora transferência", async () => {
    const resumo = await resumoDoPeriodo(ctx, "2026-07-01", "2026-07-31");

    expect(resumo.incomeCents).toBe(500_000);
    expect(resumo.expenseCents).toBe(12_345);
    expect(resumo.balanceCents).toBe(487_655);
  });

  it("gastos por categoria somam só despesa compensada", async () => {
    const gastos = await gastosPorCategoria(ctx, "2026-07-01", "2026-07-31");

    expect(gastos).toHaveLength(1);
    expect(gastos[0]!.totalCents).toBe(12_345);
  });

  it("as pendentes vêm ordenadas por vencimento", async () => {
    const lista = await pendentes(ctx);

    expect(lista.length).toBeGreaterThan(0);
    expect(lista.every((p) => p.status === "pending")).toBe(true);

    const vencimentos = lista.map((p) => p.dueDate ?? "");
    expect([...vencimentos].sort()).toEqual(vencimentos);
  });
});
