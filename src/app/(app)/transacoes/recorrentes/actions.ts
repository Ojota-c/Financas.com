"use server";

import { revalidatePath } from "next/cache";

import { requireSessionContext } from "@/lib/auth/session";
import {
  apagarRegra,
  atualizarRegra,
  criarRegra,
  materializarRegras,
} from "@/lib/db/queries/recurring";
import { nextOccurrences } from "@/lib/finance";
import { hoje } from "@/lib/utils/dates";
import { recurringSchema, type RecurringInput } from "@/lib/validators/finance";

export type ActionResult = { ok: true } | { error: string };

function primeiroErro(issues: { message: string }[]): string {
  return issues[0]?.message ?? "Dados inválidos.";
}

function revalidarRecorrencias() {
  revalidatePath("/transacoes/recorrentes");
  revalidatePath("/transacoes");
  revalidatePath("/transacoes/pendentes");
  revalidatePath("/dashboard");
}

export async function criarRegraAction(
  valores: RecurringInput,
): Promise<ActionResult> {
  const contexto = await requireSessionContext();

  const parsed = recurringSchema.safeParse(valores);
  if (!parsed.success) return { error: primeiroErro(parsed.error.issues) };

  const dados = parsed.data;

  const [primeira] = nextOccurrences(
    {
      frequency: dados.frequency,
      interval: dados.interval,
      dayOfMonth: dados.frequency === "monthly" ? dados.dayOfMonth : undefined,
      weekday: dados.frequency === "weekly" ? dados.weekday : undefined,
      startDate: dados.startDate,
      endDate: dados.endDate || undefined,
      occurrencesLimit: dados.occurrencesLimit,
    },
    dados.startDate,
    1,
  );

  if (!primeira) {
    return { error: "A regra não gera nenhuma ocorrência — revise as datas." };
  }

  await criarRegra(contexto, {
    template: {
      type: dados.type,
      accountId: dados.accountId,
      categoryId: dados.categoryId,
      amountCents: dados.amount,
      description: dados.description,
    },
    frequency: dados.frequency,
    interval: dados.interval,
    dayOfMonth:
      dados.frequency === "monthly" ? (dados.dayOfMonth ?? null) : null,
    weekday: dados.frequency === "weekly" ? (dados.weekday ?? null) : null,
    startDate: dados.startDate,
    endDate: dados.endDate || null,
    occurrencesLimit: dados.occurrencesLimit ?? null,
    nextOccurrence: primeira,
    autoPost: dados.autoPost,
  });

  // Regra com início no passado já entra devendo — gerar na hora evita o
  // estado esquisito de "criei o aluguel e nada apareceu".
  await materializarRegras(contexto, hoje());

  revalidarRecorrencias();

  return { ok: true };
}

export async function alternarRegraAction(
  id: string,
  ativa: boolean,
): Promise<ActionResult> {
  const contexto = await requireSessionContext();

  await atualizarRegra(contexto, id, { isActive: ativa });

  revalidarRecorrencias();

  return { ok: true };
}

export async function apagarRegraAction(id: string): Promise<ActionResult> {
  const contexto = await requireSessionContext();

  await apagarRegra(contexto, id);

  revalidarRecorrencias();

  return { ok: true };
}

/**
 * O "job" de geração, disparado pelo cliente ao abrir o app. Server Action e
 * não efeito de render: gerar lançamento é escrita, e escrita em render
 * quebraria com cache/prerender do Next.
 */
export async function materializarAction(): Promise<{ geradas: number }> {
  const contexto = await requireSessionContext();

  const geradas = await materializarRegras(contexto, hoje());

  if (geradas > 0) revalidarRecorrencias();

  return { geradas };
}
