import { z } from "zod";

import { parseMoneyInput } from "@/lib/finance";

/**
 * Schema único, compartilhado entre o formulário e a Server Action — nunca dois.
 *
 * Não importa `server-only`: o React Hook Form valida no cliente com o MESMO
 * objeto que a action revalida no servidor. Duplicar a regra é como as duas
 * pontas divergem sem ninguém perceber.
 */

/**
 * O campo de dinheiro sai sempre em centavos inteiros, venha de onde vier.
 *
 * Aceita as duas entradas de propósito. O `MoneyInput` já trabalha em centavos
 * e manda `number`; texto colado, query string e formulário sem JS chegam como
 * `string` no formato brasileiro. Os dois convergem aqui, na borda, e o
 * servidor revalida o que o cliente mandou em vez de confiar nele.
 */
function campoDeDinheiro(opcoes: { positivo?: boolean } = {}) {
  const { positivo = true } = opcoes;

  return z.union([z.number(), z.string()]).transform((bruto, ctx) => {
    const cents =
      typeof bruto === "number"
        ? Number.isSafeInteger(bruto)
          ? bruto
          : null
        : parseMoneyInput(bruto);

    if (cents === null) {
      ctx.addIssue({ code: "custom", message: "Valor inválido." });
      return z.NEVER;
    }

    if (positivo && cents <= 0) {
      ctx.addIssue({
        code: "custom",
        message: "O valor precisa ser maior que zero.",
      });
      return z.NEVER;
    }

    return cents;
  });
}

/** `YYYY-MM-DD` — data civil, como a coluna DATE do banco. */
const campoDeData = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida.");

export const TIPOS_DE_CONTA = [
  "checking",
  "savings",
  "cash",
  "credit_card",
  "investment",
  "other",
] as const;

export const ROTULO_DO_TIPO_DE_CONTA: Record<
  (typeof TIPOS_DE_CONTA)[number],
  string
> = {
  checking: "Conta corrente",
  savings: "Poupança",
  cash: "Dinheiro",
  credit_card: "Cartão de crédito",
  investment: "Investimento",
  other: "Outra",
};

export const accountSchema = z
  .object({
    name: z.string().trim().min(1, "Dê um nome à conta.").max(60),
    type: z.enum(TIPOS_DE_CONTA),
    institution: z.string().trim().max(60).optional().or(z.literal("")),
    color: z.string().trim().optional().or(z.literal("")),
    // Saldo inicial pode ser negativo: cheque especial e cartão começam no
    // vermelho, e forçar zero obrigaria a pessoa a mentir para o app.
    initialBalance: campoDeDinheiro({ positivo: false }),
    creditLimit: campoDeDinheiro({ positivo: false }).optional(),
    closingDay: z.coerce.number().int().min(1).max(31).optional(),
    dueDay: z.coerce.number().int().min(1).max(31).optional(),
  })
  .superRefine((valores, ctx) => {
    // Espelha `accounts_credit_card_fields_check` do banco. A constraint é a
    // garantia real; isto existe para o erro chegar como mensagem de campo em
    // vez de erro 500 vindo do Postgres.
    if (valores.type === "credit_card") return;

    for (const campo of ["creditLimit", "closingDay", "dueDay"] as const) {
      if (valores[campo] !== undefined) {
        ctx.addIssue({
          code: "custom",
          path: [campo],
          message: "Só cartão de crédito usa este campo.",
        });
      }
    }
  });

export type AccountInput = z.input<typeof accountSchema>;
export type AccountValues = z.output<typeof accountSchema>;

/**
 * Parcelamento no formulário de lançamento: "12x de R$ 250". O valor digitado é
 * o DA PARCELA, como a pessoa lê na etiqueta da loja — pedir o total e dividir
 * obrigaria a fazer conta de cabeça na fila do caixa.
 */
const campoDeParcelas = z.coerce
  .number()
  .int("Parcelas precisa ser um número inteiro.")
  .min(1)
  .max(48, "No máximo 48 parcelas.")
  .default(1);

export const transactionSchema = z
  .object({
    type: z.enum(["income", "expense"]),
    accountId: z.uuid("Escolha uma conta."),
    categoryId: z.uuid("Escolha uma categoria."),
    amount: campoDeDinheiro(),
    installments: campoDeParcelas,
    date: campoDeData,
    description: z.string().trim().min(1, "Descreva o lançamento.").max(120),
    notes: z.string().trim().max(500).optional().or(z.literal("")),
    status: z.enum(["cleared", "pending"]).default("cleared"),
    dueDate: campoDeData.optional().or(z.literal("")),
  })
  .superRefine((valores, ctx) => {
    // Espelha `transactions_due_date_check`: pendente é o que o semáforo
    // ordena por vencimento, e sem data ele não teria por onde ordenar.
    if (valores.status === "pending" && !valores.dueDate) {
      ctx.addIssue({
        code: "custom",
        path: ["dueDate"],
        message: "Conta a pagar precisa de vencimento.",
      });
    }
  });

export type TransactionInput = z.input<typeof transactionSchema>;
export type TransactionValues = z.output<typeof transactionSchema>;

export const budgetSchema = z.object({
  categoryId: z.uuid("Escolha a categoria."),
  period: campoDeData.refine(
    (data) => data.endsWith("-01"),
    "O período é sempre o dia 1º do mês.",
  ),
  limit: campoDeDinheiro(),
  rollover: z.boolean().default(false),
});

export type BudgetInput = z.input<typeof budgetSchema>;
export type BudgetValues = z.output<typeof budgetSchema>;

export const FREQUENCIAS = ["daily", "weekly", "monthly", "yearly"] as const;

export const ROTULO_DA_FREQUENCIA: Record<
  (typeof FREQUENCIAS)[number],
  string
> = {
  daily: "Diária",
  weekly: "Semanal",
  monthly: "Mensal",
  yearly: "Anual",
};

/**
 * O molde do lançamento que a regra gera — é o `template` jsonb da tabela.
 * Validado nas DUAS bordas: ao salvar a regra e ao materializar a ocorrência,
 * porque jsonb aceita qualquer coisa e o banco não vai reclamar por nós.
 */
export const recurringTemplateSchema = z.object({
  type: z.enum(["income", "expense"]),
  accountId: z.uuid(),
  categoryId: z.uuid(),
  amountCents: z.number().int().positive(),
  description: z.string().trim().min(1).max(120),
  notes: z.string().trim().max(500).nullish(),
});

export type RecurringTemplate = z.output<typeof recurringTemplateSchema>;

export const recurringSchema = z
  .object({
    type: z.enum(["income", "expense"]),
    accountId: z.uuid("Escolha uma conta."),
    categoryId: z.uuid("Escolha uma categoria."),
    amount: campoDeDinheiro(),
    description: z.string().trim().min(1, "Descreva a recorrência.").max(120),
    frequency: z.enum(FREQUENCIAS),
    interval: z.coerce.number().int().min(1).max(60).default(1),
    dayOfMonth: z.coerce.number().int().min(1).max(31).optional(),
    weekday: z.coerce.number().int().min(0).max(6).optional(),
    startDate: campoDeData,
    endDate: campoDeData.optional().or(z.literal("")),
    occurrencesLimit: z.coerce.number().int().min(1).max(999).optional(),
    autoPost: z.boolean().default(false),
  })
  .superRefine((valores, ctx) => {
    if (
      valores.endDate &&
      valores.endDate !== "" &&
      valores.endDate < valores.startDate
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["endDate"],
        message: "O fim precisa ser depois do início.",
      });
    }
  });

export type RecurringInput = z.input<typeof recurringSchema>;
export type RecurringValues = z.output<typeof recurringSchema>;

export const goalSchema = z.object({
  name: z.string().trim().min(1, "Dê um nome à meta.").max(60),
  target: campoDeDinheiro(),
  targetDate: campoDeData.optional().or(z.literal("")),
  accountId: z.uuid().optional().or(z.literal("")),
  color: z.string().trim().optional().or(z.literal("")),
});

export type GoalInput = z.input<typeof goalSchema>;
export type GoalValues = z.output<typeof goalSchema>;

export const contributionSchema = z.object({
  goalId: z.uuid(),
  // Negativo permitido: resgatar da reserva é evento normal (ver o schema de
  // goal_contributions) — só zero não faz sentido.
  amount: campoDeDinheiro({ positivo: false }).refine(
    (cents) => cents !== 0,
    "O aporte não pode ser zero.",
  ),
  date: campoDeData,
});

export type ContributionInput = z.input<typeof contributionSchema>;
export type ContributionValues = z.output<typeof contributionSchema>;

export const transferSchema = z
  .object({
    origemAccountId: z.uuid("Escolha a conta de origem."),
    destinoAccountId: z.uuid("Escolha a conta de destino."),
    amount: campoDeDinheiro(),
    date: campoDeData,
    description: z.string().trim().min(1, "Descreva a transferência.").max(120),
  })
  .superRefine((valores, ctx) => {
    if (valores.origemAccountId === valores.destinoAccountId) {
      ctx.addIssue({
        code: "custom",
        path: ["destinoAccountId"],
        message: "Escolha uma conta diferente da origem.",
      });
    }
  });

export type TransferInput = z.input<typeof transferSchema>;
export type TransferValues = z.output<typeof transferSchema>;
