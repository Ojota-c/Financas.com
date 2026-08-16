import type { Metadata } from "next";

import { Bug, ChartPie, Flame, RefreshCcw } from "lucide-react";

import { BarrasMensais } from "@/components/charts/barras-mensais";
import { HeatmapAnual } from "@/components/charts/heatmap-anual";
import { SankeyRenda } from "@/components/charts/sankey-renda";
import { requireSessionContext } from "@/lib/auth/session";
import {
  fluxoDeGastos,
  gastoPorDia,
  gastosPorCategoria,
  listarLancamentos,
  resumoDoPeriodo,
  resumoPorMes,
} from "@/lib/db/queries/transactions";
import {
  addMonthsClamped,
  antExpenses,
  formatCents,
  paretoConcentration,
  subscriptionRadar,
} from "@/lib/finance";
import {
  hoje,
  primeiroDiaDoMes,
  rotuloDoMes,
  ultimoDiaDoMes,
} from "@/lib/utils/dates";

export const metadata: Metadata = { title: "Relatórios" };

/** Abaixo disso é "comprinha" — o limiar clássico dos R$ 30 do §5.2. */
const LIMIAR_FORMIGA_CENTS = 3000;

export default async function RelatoriosPage() {
  const contexto = await requireSessionContext();

  const dataDeHoje = hoje();
  const ano = Number(dataDeHoje.slice(0, 4));
  const de = primeiroDiaDoMes(dataDeHoje);
  const ate = ultimoDiaDoMes(dataDeHoje);
  const inicio12m = primeiroDiaDoMes(addMonthsClamped(dataDeHoje, -11));
  const inicio6m = primeiroDiaDoMes(addMonthsClamped(dataDeHoje, -5));

  const [dias, meses, fluxo, resumo, despesasDoMes, fatias, despesas6m] =
    await Promise.all([
      gastoPorDia(contexto, `${ano}-01-01`, `${ano}-12-31`),
      resumoPorMes(contexto, inicio12m, ate),
      fluxoDeGastos(contexto, de, ate),
      resumoDoPeriodo(contexto, de, ate),
      listarLancamentos(contexto, {
        de,
        ate,
        type: "expense",
        status: "cleared",
        limite: 1000,
      }),
      gastosPorCategoria(contexto, de, ate),
      listarLancamentos(contexto, {
        de: inicio6m,
        ate,
        type: "expense",
        limite: 2000,
      }),
    ]);

  // ── Motor puro faz as contas; a página distribui. ──

  const formigas = antExpenses(
    despesasDoMes.map((despesa) => despesa.amountCents),
    LIMIAR_FORMIGA_CENTS,
    resumo.incomeCents,
  );

  const pareto = paretoConcentration(
    fatias.map((fatia) => ({ name: fatia.name, totalCents: fatia.totalCents })),
    0.7,
  );

  const assinaturas = subscriptionRadar(
    despesas6m.map((despesa) => ({
      description: despesa.description,
      amountCents: despesa.amountCents,
      date: despesa.date,
    })),
  );

  const temDados = despesasDoMes.length > 0 || meses.length > 0;

  return (
    <div className="mx-auto grid max-w-6xl gap-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-[-0.02em]">
          Relatórios
        </h1>
        <p className="text-text-mid mt-1 text-sm">
          Padrões que o extrato sozinho não mostra.
        </p>
      </div>

      {!temDados && (
        <section className="glass grid place-items-center gap-3 rounded-xl px-6 py-16 text-center">
          <ChartPie className="text-brand size-6" aria-hidden />
          <p className="text-base font-medium">Ainda sem matéria-prima</p>
          <p className="text-text-mid max-w-sm text-sm">
            Os relatórios nascem do extrato. Lance o dia a dia e volte aqui — os
            padrões aparecem rápido.
          </p>
        </section>
      )}

      {temDados && (
        <>
          <section className="bg-surface-1/60 border-line rounded-xl border px-5 py-4">
            <h2 className="mb-1 text-sm font-medium">
              Para onde a renda foi{" "}
              <span className="text-text-dim font-normal first-letter:lowercase">
                · {rotuloDoMes(dataDeHoje)}
              </span>
            </h2>
            {fluxo.length > 0 && resumo.incomeCents > 0 ? (
              <SankeyRenda
                fluxo={{ incomeCents: resumo.incomeCents, gastos: fluxo }}
              />
            ) : (
              <p className="text-text-dim grid h-32 place-items-center text-sm">
                Precisa de receita e despesa categorizada no mês.
              </p>
            )}
          </section>

          <div className="grid gap-4 lg:grid-cols-3">
            <PainelDeInsight
              icone={<Bug className="text-warning size-4" aria-hidden />}
              titulo="Gastos formiga"
            >
              {formigas.count === 0 ? (
                <p className="text-text-dim text-sm">
                  Nenhuma comprinha abaixo de{" "}
                  {formatCents(LIMIAR_FORMIGA_CENTS)} este mês.
                </p>
              ) : (
                <>
                  <p className="money text-2xl">
                    {formatCents(formigas.totalCents)}
                  </p>
                  <p className="text-text-mid text-sm">
                    em {formigas.count} comprinhas abaixo de{" "}
                    {formatCents(LIMIAR_FORMIGA_CENTS)}
                    {formigas.incomeFraction !== null &&
                      ` — ${Math.round(formigas.incomeFraction * 100)}% da sua renda`}
                    .
                  </p>
                </>
              )}
            </PainelDeInsight>

            <PainelDeInsight
              icone={<Flame className="text-brand size-4" aria-hidden />}
              titulo="Curva ABC"
            >
              {pareto.categoriesNeeded === 0 ? (
                <p className="text-text-dim text-sm">
                  Sem gasto categorizado no mês.
                </p>
              ) : (
                <>
                  <p className="text-2xl font-semibold tabular-nums">
                    {pareto.categoriesNeeded}{" "}
                    <span className="text-text-mid text-sm font-normal">
                      {pareto.categoriesNeeded === 1
                        ? "categoria concentra"
                        : "categorias concentram"}{" "}
                      {Math.round(pareto.topShareFraction * 100)}% dos gastos
                    </span>
                  </p>
                  <p className="text-text-mid text-sm">
                    {pareto.topCategories.join(" · ")}
                  </p>
                </>
              )}
            </PainelDeInsight>

            <PainelDeInsight
              icone={<RefreshCcw className="text-brand size-4" aria-hidden />}
              titulo="Radar de assinaturas"
            >
              {assinaturas.length === 0 ? (
                <p className="text-text-dim text-sm">
                  Nada recorrente detectado ainda — o radar precisa de 3 meses
                  da mesma cobrança.
                </p>
              ) : (
                <ul className="grid gap-1.5">
                  {assinaturas.slice(0, 4).map((assinatura) => (
                    <li
                      key={assinatura.normalizedDescription}
                      className="flex items-baseline justify-between gap-3 text-sm"
                    >
                      <span className="min-w-0 truncate capitalize">
                        {assinatura.normalizedDescription}
                        {assinatura.priceIncreased && (
                          <span className="text-warning ml-1.5 text-xs">
                            subiu
                          </span>
                        )}
                      </span>
                      <span className="shrink-0 tabular-nums">
                        {formatCents(assinatura.annualizedCents)}
                        <span className="text-text-dim text-xs">/ano</span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </PainelDeInsight>
          </div>

          <section className="bg-surface-1/60 border-line rounded-xl border px-5 py-4">
            <h2 className="mb-3 text-sm font-medium">
              Receita × despesa · 12 meses
            </h2>
            <BarrasMensais meses={meses} />
          </section>

          <section className="bg-surface-1/60 border-line rounded-xl border px-5 py-4">
            <h2 className="mb-3 text-sm font-medium">
              Mapa de calor dos gastos · {ano}
            </h2>
            <HeatmapAnual dias={dias} ano={ano} />
          </section>
        </>
      )}
    </div>
  );
}

function PainelDeInsight({
  icone,
  titulo,
  children,
}: {
  icone: React.ReactNode;
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-surface-1/60 border-line grid content-start gap-2 rounded-xl border px-5 py-4">
      <div className="flex items-center gap-2">
        {icone}
        <h2 className="text-text-mid text-xs tracking-wide uppercase">
          {titulo}
        </h2>
      </div>
      {children}
    </section>
  );
}
