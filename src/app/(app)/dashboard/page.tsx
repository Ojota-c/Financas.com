import type { Metadata } from "next";
import Link from "next/link";

import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarClock,
  LifeBuoy,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";

import { BarrasMensais } from "@/components/charts/barras-mensais";
import { DonutCategorias } from "@/components/charts/donut-categorias";
import { LinhaSaldo, type PontoDeSaldo } from "@/components/charts/linha-saldo";
import { ScoreGauge } from "@/components/finance/score-gauge";
import { Button } from "@/components/ui/button";
import { requireSessionContext } from "@/lib/auth/session";
import { listarContas, saldoConsolidadoAte } from "@/lib/db/queries/accounts";
import { listarOrcamentoDoMes } from "@/lib/db/queries/budgets";
import { listarMetas } from "@/lib/db/queries/goals";
import { listarRegras } from "@/lib/db/queries/recurring";
import {
  gastoPorBucket,
  gastosPorCategoria,
  listarLancamentos,
  movimentoDiario,
  parcelasDoPeriodo,
  pendentes,
  resumoDoPeriodo,
  resumoPorMes,
  somaPendentesAte,
  type ResumoMensal,
} from "@/lib/db/queries/transactions";
import {
  addDays,
  addMonthsClamped,
  budgetAdherence,
  formatCents,
  healthScore,
  nextOccurrences,
  projectMonthEndExpense,
  runwayMonths,
  safeToSpend,
  suggestedMonthlyContribution,
  sumCents,
  type RecurrenceRule,
} from "@/lib/finance";
import { cn } from "@/lib/utils/cn";
import {
  dataCurta,
  hoje,
  primeiroDiaDoMes,
  rotuloDoMes,
  ultimoDiaDoMes,
} from "@/lib/utils/dates";
import { classificarVencimento } from "@/lib/utils/vencimento";
import { recurringTemplateSchema } from "@/lib/validators/finance";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const contexto = await requireSessionContext();

  const dataDeHoje = hoje();
  const de = primeiroDiaDoMes(dataDeHoje);
  const ate = ultimoDiaDoMes(dataDeHoje);

  const inicioDaJanela3m = primeiroDiaDoMes(addMonthsClamped(dataDeHoje, -2));
  const inicioDaJanela12m = primeiroDiaDoMes(addMonthsClamped(dataDeHoje, -11));
  const inicioDosSaldos = addDays(dataDeHoje, -89);

  const [
    contas,
    resumo,
    ultimos,
    proximas,
    pendentesDoMesCents,
    metas,
    orcamento,
    buckets3m,
    parcelasDoMesCents,
    meses,
    regras,
    fatiasDoMes,
    movimento,
    saldoAnterior,
  ] = await Promise.all([
    listarContas(contexto),
    resumoDoPeriodo(contexto, de, ate),
    listarLancamentos(contexto, { limite: 6 }),
    pendentes(contexto, 5),
    somaPendentesAte(contexto, ate),
    listarMetas(contexto),
    listarOrcamentoDoMes(contexto, de),
    gastoPorBucket(contexto, inicioDaJanela3m, ate),
    parcelasDoPeriodo(contexto, de, ate),
    resumoPorMes(contexto, inicioDaJanela12m, ate),
    listarRegras(contexto, { somenteAtivas: true }),
    gastosPorCategoria(contexto, de, ate),
    movimentoDiario(contexto, inicioDosSaldos, dataDeHoje),
    saldoConsolidadoAte(contexto, addDays(inicioDosSaldos, -1)),
  ]);

  if (contas.length === 0) {
    return (
      <div className="mx-auto grid max-w-6xl gap-6">
        <Cabecalho />
        <section className="glass grid place-items-center gap-3 rounded-xl px-6 py-16 text-center">
          <Wallet className="text-brand size-6" aria-hidden />
          <p className="text-base font-medium">Comece pela sua conta</p>
          <p className="text-text-mid max-w-sm text-sm">
            O dashboard vive do extrato. Cadastre a conta onde você recebe e os
            números aparecem aqui.
          </p>
          <Button asChild className="mt-2">
            <Link href="/contas">Cadastrar conta</Link>
          </Button>
        </section>
      </div>
    );
  }

  const saldo = sumCents(contas.map((conta) => conta.balanceCents));

  // ── Todo cálculo abaixo é do motor puro; a página só liga as pontas. ──

  const metasAtivas = metas.filter((meta) => meta.status === "active");
  const aportesDoMesCents = sumCents(
    metasAtivas.map(
      (meta) =>
        suggestedMonthlyContribution({
          targetCents: meta.targetCents,
          savedCents: meta.savedCents,
          targetDate: meta.targetDate ?? undefined,
          referenceDate: dataDeHoje,
        }) ?? 0,
    ),
  );

  const sts = safeToSpend({
    balanceCents: saldo,
    pendingCents: pendentesDoMesCents,
    goalContributionsCents: aportesDoMesCents,
    referenceDate: dataDeHoje,
  });

  const reservaCents = sumCents(metas.map((meta) => meta.savedCents));
  const essencialMensalCents = Math.round((buckets3m.needs ?? 0) / 3);

  const runway = runwayMonths(reservaCents, essencialMensalCents);

  const score = healthScore({
    incomeCents: resumo.incomeCents,
    expenseCents: resumo.expenseCents,
    reserveCents: reservaCents,
    essentialMonthlyCents: essencialMensalCents,
    debtMonthlyCents: parcelasDoMesCents,
    budgetAdherenceFraction: budgetAdherence(
      orcamento
        .filter((linha) => linha.limitCents !== null)
        .map((linha) => ({
          spentCents: linha.spentCents,
          limitCents: linha.limitCents!,
        })),
    ),
    positiveMonthsStreak: mesesSeguidosNoPositivo(meses, de.slice(0, 7)),
  });

  const recorrentesRestantesCents = sumCents(
    regras.map((regra) => {
      const template = recurringTemplateSchema.safeParse(regra.template);
      if (!template.success || template.data.type !== "expense") return 0;

      const ocorrencias = nextOccurrences(
        comoRegraDoMotor(regra),
        addDays(dataDeHoje, 1),
        31,
      ).filter((data) => data <= ate);

      return template.data.amountCents * ocorrencias.length;
    }),
  );

  const projecaoCents = projectMonthEndExpense({
    spentCents: resumo.expenseCents,
    remainingRecurringCents: recorrentesRestantesCents,
    referenceDate: dataDeHoje,
  });

  const sobraProjetadaCents = resumo.incomeCents - projecaoCents;

  const pontosDeSaldo: PontoDeSaldo[] = [];
  let acumulado = saldoAnterior;
  for (const dia of movimento) {
    acumulado += dia.netCents;
    pontosDeSaldo.push({ date: dia.date, saldoCents: acumulado });
  }

  const ultimosSeisMeses = meses.slice(-6);

  return (
    <div className="mx-auto grid max-w-6xl gap-5">
      <Cabecalho />

      {/* ── O número herói: Safe-to-Spend (§5.2). O ÚNICO vidro com aurora. ── */}
      <section className="glass aurora relative overflow-hidden rounded-xl px-6 py-7">
        <p className="text-text-mid text-xs tracking-wide uppercase">
          Dá para gastar
        </p>
        <p className="money mt-1 text-5xl tracking-[-0.02em] sm:text-6xl">
          <span
            className={cn(
              sts.perDayCents < 0
                ? "text-negative"
                : "brand-gradient bg-clip-text text-transparent",
            )}
          >
            {formatCents(sts.perDayCents)}
          </span>
          <span className="text-text-mid ml-2 text-lg font-normal">/dia</span>
        </p>
        <p className="text-text-mid mt-2 text-sm">
          {formatCents(sts.availableCents)} disponíveis pelos próximos{" "}
          {sts.daysRemaining} dias — já descontadas as contas a pagar e os
          aportes de meta do mês.
        </p>

        <p
          className={cn(
            "mt-3 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs",
            sobraProjetadaCents < 0
              ? "border-negative/40 text-negative"
              : "border-positive/40 text-positive",
          )}
        >
          {sobraProjetadaCents < 0 ? (
            <TrendingDown className="size-3.5" aria-hidden />
          ) : (
            <TrendingUp className="size-3.5" aria-hidden />
          )}
          Projeção do mês:{" "}
          {sobraProjetadaCents < 0
            ? `fecha ${formatCents(sobraProjetadaCents)} no vermelho`
            : `sobra ${formatCents(sobraProjetadaCents)}`}
        </p>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <section className="bg-surface-1/60 border-line row-span-2 grid place-items-center gap-2 rounded-xl border px-5 py-5 text-center">
          <p className="text-text-mid text-xs tracking-wide uppercase">
            Saúde financeira
          </p>
          <ScoreGauge score={score.total} />
          <DetalheDoScore score={score} />
        </section>

        <Cartao rotulo="Saldo total" valorCents={saldo} icone="saldo" />
        <Cartao
          rotulo="Receita do mês"
          valorCents={resumo.incomeCents}
          icone="entrada"
        />
        <Cartao
          rotulo="Despesa do mês"
          valorCents={resumo.expenseCents}
          icone="saida"
        />

        <section className="bg-surface-1/60 border-line rounded-xl border px-5 py-4 sm:col-span-2 lg:col-span-3">
          <div className="flex items-center gap-2">
            <LifeBuoy className="text-brand size-4" aria-hidden />
            <p className="text-text-mid text-xs tracking-wide uppercase">
              Runway
            </p>
          </div>
          <p className="mt-1 text-2xl font-semibold tabular-nums">
            {runway === null ? (
              <span className="text-text-mid text-base font-normal">
                Sem dados de gasto essencial ainda — categorize seus gastos e o
                número aparece.
              </span>
            ) : (
              <>
                Você aguenta{" "}
                <span className="text-brand">
                  {String(runway).replace(".", ",")}{" "}
                  {runway === 1 ? "mês" : "meses"}
                </span>{" "}
                sem receber nada
              </>
            )}
          </p>
          {runway !== null && (
            <p className="text-text-dim mt-1 text-xs">
              {formatCents(reservaCents)} guardados ÷{" "}
              {formatCents(essencialMensalCents)}/mês de essenciais (média de 3
              meses)
            </p>
          )}
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <section className="bg-surface-1/60 border-line rounded-xl border px-5 py-4 lg:col-span-3">
          <h2 className="mb-3 text-sm font-medium">
            Evolução do saldo · 90 dias
          </h2>
          {pontosDeSaldo.length > 1 ? (
            <LinhaSaldo pontos={pontosDeSaldo} />
          ) : (
            <VazioDeGrafico texto="Movimente o extrato e a linha aparece." />
          )}
        </section>

        <section className="bg-surface-1/60 border-line rounded-xl border px-5 py-4 lg:col-span-2">
          <h2 className="mb-3 text-sm font-medium">Para onde foi o dinheiro</h2>
          {fatiasDoMes.length > 0 ? (
            <DonutCategorias
              fatias={fatiasDoMes.map((fatia) => ({
                nome: fatia.name,
                totalCents: fatia.totalCents,
              }))}
            />
          ) : (
            <VazioDeGrafico texto="Nenhuma despesa categorizada neste mês." />
          )}
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="bg-surface-1/60 border-line rounded-xl border px-5 py-4">
          <h2 className="mb-3 text-sm font-medium">Receita × despesa</h2>
          {ultimosSeisMeses.length > 0 ? (
            <BarrasMensais
              meses={ultimosSeisMeses.map((mes: ResumoMensal) => ({
                mes: mes.mes,
                incomeCents: mes.incomeCents,
                expenseCents: mes.expenseCents,
              }))}
            />
          ) : (
            <VazioDeGrafico texto="Sem meses fechados ainda." />
          )}
        </section>

        <section className="bg-surface-1/60 border-line rounded-xl border px-5 py-4">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-sm font-medium">Próximos vencimentos</h2>
            <Button asChild variant="ghost" size="sm" className="text-text-mid">
              <Link href="/transacoes/pendentes">Ver todas</Link>
            </Button>
          </div>

          {proximas.length === 0 ? (
            <div className="grid place-items-center gap-2 py-8 text-center">
              <CalendarClock className="text-positive size-5" aria-hidden />
              <p className="text-text-mid text-sm">
                Nada a pagar. Tudo em dia.
              </p>
            </div>
          ) : (
            <ul className="mt-3 grid gap-1">
              {proximas.map((conta) => {
                const semaforo = classificarVencimento(
                  conta.dueDate,
                  dataDeHoje,
                );

                return (
                  <li
                    key={conta.id}
                    className="flex items-center justify-between gap-3 py-1.5"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <span
                        aria-hidden
                        className={cn(
                          "size-2 shrink-0 rounded-full",
                          semaforo === "vencido" && "bg-negative animate-pulse",
                          semaforo === "em_breve" && "bg-warning",
                          semaforo === "futuro" && "bg-text-dim",
                        )}
                      />
                      <p className="truncate text-sm">{conta.description}</p>
                    </div>
                    <p className="shrink-0 text-sm tabular-nums">
                      {conta.dueDate ? `${dataCurta(conta.dueDate)} · ` : ""}
                      {formatCents(conta.amountCents, { symbol: false })}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      <section className="bg-surface-1/60 border-line rounded-xl border px-5 py-4">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-sm font-medium">Últimos lançamentos</h2>
          <Button asChild variant="ghost" size="sm" className="text-text-mid">
            <Link href="/transacoes">Ver todos</Link>
          </Button>
        </div>

        {ultimos.length === 0 ? (
          <div className="grid place-items-center gap-2 py-8 text-center">
            <Sparkles className="text-brand size-5" aria-hidden />
            <p className="text-text-mid text-sm">
              Nenhum lançamento ainda neste espaço.
            </p>
          </div>
        ) : (
          <ul className="mt-3 grid gap-1">
            {ultimos.map((lancamento) => {
              const saida =
                lancamento.type === "expense" || lancamento.direction === "out";
              const entrada =
                lancamento.type === "income" || lancamento.direction === "in";

              return (
                <li
                  key={lancamento.id}
                  className="flex items-center justify-between gap-4 py-1.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {lancamento.description}
                    </p>
                    <p className="text-text-dim truncate text-xs">
                      {dataCurta(lancamento.date)} ·{" "}
                      {lancamento.categoryName ?? "Transferência"} ·{" "}
                      {lancamento.accountName}
                    </p>
                  </div>

                  <p
                    className={cn(
                      "shrink-0 text-sm font-medium tabular-nums",
                      entrada && "text-positive",
                    )}
                  >
                    {saida ? "−" : "+"}
                    {formatCents(lancamento.amountCents, { symbol: false })}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function Cabecalho() {
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-[-0.02em]">Dashboard</h1>
      <p className="text-text-mid mt-1 text-sm first-letter:uppercase">
        {rotuloDoMes()}
      </p>
    </div>
  );
}

function Cartao({
  rotulo,
  valorCents,
  icone,
}: {
  rotulo: string;
  valorCents: number;
  icone: "saldo" | "entrada" | "saida";
}) {
  const Icone =
    icone === "entrada"
      ? ArrowUpRight
      : icone === "saida"
        ? ArrowDownRight
        : Wallet;

  return (
    <section className="bg-surface-1/60 border-line rounded-xl border px-5 py-4">
      <div className="flex items-center gap-2">
        <Icone
          className={cn(
            "size-4",
            icone === "entrada" && "text-positive",
            icone === "saida" && "text-negative",
            icone === "saldo" && "text-brand",
          )}
          aria-hidden
        />
        <p className="text-text-mid text-xs tracking-wide uppercase">
          {rotulo}
        </p>
      </div>
      <p
        className={cn(
          "money mt-1 text-2xl",
          icone === "saldo" && valorCents < 0 && "text-negative",
        )}
      >
        {formatCents(valorCents)}
      </p>
    </section>
  );
}

function DetalheDoScore({ score }: { score: ReturnType<typeof healthScore> }) {
  const rotulos: Record<keyof typeof score.components, string> = {
    savingsRate: "Poupança",
    runway: "Reserva",
    debtLoad: "Dívida",
    budgetAdherence: "Orçamento",
    consistency: "Consistência",
  };

  return (
    <dl className="text-text-dim grid w-full grid-cols-5 gap-1 text-[10px]">
      {(
        Object.entries(score.components) as [
          keyof typeof score.components,
          (typeof score.components)[keyof typeof score.components],
        ][]
      ).map(([chave, componente]) => (
        <div key={chave} className="grid gap-0.5 text-center">
          <dt className="truncate">{rotulos[chave]}</dt>
          <dd className="text-text-mid font-medium tabular-nums">
            {Math.round(componente.points)}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function VazioDeGrafico({ texto }: { texto: string }) {
  return (
    <div className="text-text-dim grid h-40 place-items-center text-sm">
      {texto}
    </div>
  );
}

/**
 * Meses seguidos fechados no positivo, contando para trás a partir do mês
 * ANTERIOR ao corrente — o mês em curso ainda não fechou e entraria sempre
 * como quebra de sequência no comecinho do mês.
 */
function mesesSeguidosNoPositivo(
  meses: ResumoMensal[],
  mesCorrente: string,
): number {
  const fechados = meses.filter((mes) => mes.mes < mesCorrente);

  let sequencia = 0;

  for (let indice = fechados.length - 1; indice >= 0; indice -= 1) {
    const mes = fechados[indice]!;
    if (mes.incomeCents >= mes.expenseCents && mes.incomeCents > 0) {
      sequencia += 1;
    } else {
      break;
    }
  }

  return sequencia;
}

/** A regra do banco no formato do motor — igual ao usado na materialização. */
function comoRegraDoMotor(regra: {
  frequency: string;
  interval: number;
  dayOfMonth: number | null;
  weekday: number | null;
  startDate: string;
  endDate: string | null;
  occurrencesLimit: number | null;
}): RecurrenceRule {
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
