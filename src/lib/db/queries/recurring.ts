import "server-only";

import { and, asc, eq, lte } from "drizzle-orm";

import { recurring_rules, transactions } from "@/lib/db/schema";
import { withUser } from "@/lib/db/with-user";
import { addDays, nextOccurrences, type RecurrenceRule } from "@/lib/finance";
import {
  recurringTemplateSchema,
  type RecurringTemplate,
} from "@/lib/validators/finance";

import type { ContextoDaSessao } from "./accounts";

export type Regra = {
  id: string;
  template: RecurringTemplate;
  frequency: string;
  interval: number;
  dayOfMonth: number | null;
  weekday: number | null;
  startDate: string;
  endDate: string | null;
  occurrencesLimit: number | null;
  nextOccurrence: string | null;
  autoPost: boolean;
  isActive: boolean;
};

const colunas = {
  id: recurring_rules.id,
  template: recurring_rules.template,
  frequency: recurring_rules.frequency,
  interval: recurring_rules.interval,
  dayOfMonth: recurring_rules.dayOfMonth,
  weekday: recurring_rules.weekday,
  startDate: recurring_rules.startDate,
  endDate: recurring_rules.endDate,
  occurrencesLimit: recurring_rules.occurrencesLimit,
  nextOccurrence: recurring_rules.nextOccurrence,
  autoPost: recurring_rules.autoPost,
  isActive: recurring_rules.isActive,
};

/** O jsonb sai do banco como `unknown` de fato — o cast é responsabilidade de
 * quem valida na borda (as actions validam com Zod antes de gravar). */
function comoRegra(linha: Omit<Regra, "template"> & { template: unknown }) {
  return { ...linha, template: linha.template as RecurringTemplate };
}

export async function listarRegras(
  { userId, workspaceId }: ContextoDaSessao,
  { somenteAtivas = false } = {},
): Promise<Regra[]> {
  return withUser(userId, workspaceId, async (tx) => {
    const linhas = await tx
      .select(colunas)
      .from(recurring_rules)
      .where(somenteAtivas ? eq(recurring_rules.isActive, true) : undefined)
      .orderBy(asc(recurring_rules.createdAt));

    return linhas.map(comoRegra);
  });
}

/** As regras com ocorrência devida até a data — o que o job precisa gerar. */
export async function regrasDevidasAte(
  { userId, workspaceId }: ContextoDaSessao,
  data: string,
): Promise<Regra[]> {
  return withUser(userId, workspaceId, async (tx) => {
    const linhas = await tx
      .select(colunas)
      .from(recurring_rules)
      .where(
        and(
          eq(recurring_rules.isActive, true),
          lte(recurring_rules.nextOccurrence, data),
        ),
      );

    return linhas.map(comoRegra);
  });
}

export type NovaRegra = {
  template: RecurringTemplate;
  frequency: string;
  interval: number;
  dayOfMonth?: number | null;
  weekday?: number | null;
  startDate: string;
  endDate?: string | null;
  occurrencesLimit?: number | null;
  /** A primeira ocorrência ainda não gerada — calculada pelo motor puro. */
  nextOccurrence: string;
  autoPost: boolean;
};

export async function criarRegra(
  { userId, workspaceId }: ContextoDaSessao,
  dados: NovaRegra,
): Promise<string> {
  return withUser(userId, workspaceId, async (tx) => {
    const [linha] = await tx
      .insert(recurring_rules)
      .values({ ...dados, workspaceId })
      .returning({ id: recurring_rules.id });

    return linha!.id;
  });
}

export async function atualizarRegra(
  { userId, workspaceId }: ContextoDaSessao,
  id: string,
  dados: Partial<NovaRegra> & { isActive?: boolean },
): Promise<void> {
  await withUser(userId, workspaceId, async (tx) => {
    await tx
      .update(recurring_rules)
      .set(dados)
      .where(eq(recurring_rules.id, id));
  });
}

/** Converte a linha do banco na regra que o motor puro entende. */
function comoRegraDoMotor(regra: Regra): RecurrenceRule {
  return {
    frequency: regra.frequency as RecurrenceRule["frequency"],
    interval: regra.interval,
    dayOfMonth: regra.dayOfMonth ?? undefined,
    weekday: regra.weekday ?? undefined,
    startDate: regra.startDate,
    endDate: regra.endDate ?? undefined,
    occurrencesLimit: regra.occurrencesLimit ?? undefined,
  };
}

/**
 * Gera os lançamentos devidos até `hoje` — o "job" da fase 2, rodado a cada
 * abertura do app.
 *
 * Cada regra é uma transação própria que começa RECLAMANDO a fila: o update de
 * `next_occurrence` é condicionado ao valor lido, então duas abas abertas ao
 * mesmo tempo não geram o aluguel duas vezes — a segunda encontra zero linhas
 * e desiste. Só depois da reclamação os lançamentos entram, na mesma transação.
 *
 * Devolve quantos lançamentos nasceram, para a UI avisar.
 */
export async function materializarRegras(
  { userId, workspaceId }: ContextoDaSessao,
  hoje: string,
): Promise<number> {
  const devidas = await regrasDevidasAte({ userId, workspaceId }, hoje);

  let geradas = 0;

  for (const regra of devidas) {
    if (!regra.nextOccurrence) continue;

    // O jsonb é entrada não confiável até prova em contrário: se o template
    // corrompeu, a regra é pulada em vez de gerar lançamento malformado.
    const template = recurringTemplateSchema.safeParse(regra.template);
    if (!template.success) continue;

    const regraDoMotor = comoRegraDoMotor(regra);

    // 120 ocorrências ≥ nextOccurrence cobrem qualquer atraso realista
    // (4 meses de regra diária); o filtro por `hoje` corta o futuro.
    const datas = nextOccurrences(
      regraDoMotor,
      regra.nextOccurrence,
      120,
    ).filter((data) => data <= hoje);

    if (datas.length === 0) continue;

    const [proxima] = nextOccurrences(regraDoMotor, addDays(hoje, 1), 1);

    geradas += await withUser(userId, workspaceId, async (tx) => {
      const reclamada = await tx
        .update(recurring_rules)
        .set({
          nextOccurrence: proxima ?? null,
          // Regra que esgotou (fim ou limite alcançado) se desliga sozinha.
          isActive: proxima !== undefined,
        })
        .where(
          and(
            eq(recurring_rules.id, regra.id),
            eq(recurring_rules.nextOccurrence, regra.nextOccurrence!),
          ),
        )
        .returning({ id: recurring_rules.id });

      if (reclamada.length === 0) return 0;

      await tx.insert(transactions).values(
        datas.map((data) => ({
          workspaceId,
          createdBy: userId,
          accountId: template.data.accountId,
          categoryId: template.data.categoryId,
          type: template.data.type,
          amountCents: template.data.amountCents,
          date: data,
          competenceDate: data,
          description: template.data.description,
          notes: template.data.notes ?? null,
          // Conservador por padrão (ver o schema): sem autoPost nada entra no
          // extrato sozinho — vira conta a pagar para o usuário confirmar.
          status: regra.autoPost ? ("cleared" as const) : ("pending" as const),
          dueDate: regra.autoPost ? null : data,
          recurringRuleId: regra.id,
        })),
      );

      return datas.length;
    });
  }

  return geradas;
}

export async function apagarRegra(
  { userId, workspaceId }: ContextoDaSessao,
  id: string,
): Promise<void> {
  await withUser(userId, workspaceId, async (tx) => {
    // As ocorrências já geradas ficam: apagar a regra encerra o futuro, não
    // reescreve o passado — o extrato é registro, não projeção.
    await tx.delete(recurring_rules).where(eq(recurring_rules.id, id));
  });
}
