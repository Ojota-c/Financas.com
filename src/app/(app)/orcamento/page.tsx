import type { Metadata } from "next";
import Link from "next/link";

import { ChevronLeft, ChevronRight, PiggyBank } from "lucide-react";

import { Button } from "@/components/ui/button";
import { requireSessionContext } from "@/lib/auth/session";
import {
  listarOrcamentoDoMes,
  type LinhaDeOrcamento,
} from "@/lib/db/queries/budgets";
import {
  addMonthsClamped,
  categoryProgress,
  formatCents,
  monthLeftover,
  sumCents,
  type BudgetAlertLevel,
} from "@/lib/finance";
import { cn } from "@/lib/utils/cn";
import { primeiroDiaDoMes, rotuloDoMes } from "@/lib/utils/dates";

import { OrcamentoDialog } from "./_components/orcamento-dialog";

export const metadata: Metadata = { title: "Orçamento" };

/** `?mes=YYYY-MM` navega entre meses; ausente é o mês corrente. */
function lerPeriodo(params: Record<string, string | string[] | undefined>) {
  const mes = params.mes;

  if (typeof mes === "string" && /^\d{4}-\d{2}$/.test(mes)) {
    return `${mes}-01`;
  }

  return primeiroDiaDoMes();
}

const TOM_DA_BARRA: Record<BudgetAlertLevel, string> = {
  none: "bg-brand",
  warn80: "bg-warning",
  over100: "bg-negative",
};

export default async function OrcamentoPage({
  searchParams,
}: PageProps<"/orcamento">) {
  const contexto = await requireSessionContext();
  const period = lerPeriodo(await searchParams);

  const linhas = await listarOrcamentoDoMes(contexto, period);

  // O cálculo é TODO do motor puro; a página só distribui números na tela.
  const calculadas = linhas.map((linha) => {
    const rolloverCents =
      linha.rollover && linha.prevLimitCents !== null
        ? monthLeftover(linha.prevLimitCents, linha.prevSpentCents)
        : 0;

    const progresso =
      linha.limitCents !== null
        ? categoryProgress({
            spentCents: linha.spentCents,
            limitCents: linha.limitCents,
            rolloverCents,
          })
        : null;

    return { ...linha, rolloverCents, progresso };
  });

  const comTeto = calculadas.filter((linha) => linha.progresso !== null);
  const semTeto = calculadas.filter((linha) => linha.progresso === null);

  const totalTetoCents = sumCents(
    comTeto.map((linha) => linha.progresso!.effectiveLimitCents),
  );
  const totalGastoCents = sumCents(comTeto.map((linha) => linha.spentCents));
  const estouradas = comTeto.filter(
    (linha) => linha.progresso!.alert === "over100",
  ).length;

  const mesAnterior = addMonthsClamped(period, -1).slice(0, 7);
  const mesSeguinte = addMonthsClamped(period, 1).slice(0, 7);

  const grupos = new Map<string, typeof calculadas>();
  for (const linha of calculadas) {
    const grupo = grupos.get(linha.parentName) ?? [];
    grupo.push(linha);
    grupos.set(linha.parentName, grupo);
  }

  return (
    <div className="mx-auto grid max-w-5xl gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-[-0.02em]">
            Orçamento
          </h1>
          <p className="text-text-mid mt-1 text-sm first-letter:uppercase">
            {rotuloDoMes(period)}
          </p>
        </div>

        <div className="flex items-center gap-1">
          <Button
            asChild
            variant="ghost"
            size="icon-sm"
            className="text-text-mid"
          >
            <Link
              href={`/orcamento?mes=${mesAnterior}`}
              aria-label="Mês anterior"
            >
              <ChevronLeft className="size-4" aria-hidden />
            </Link>
          </Button>
          <Button
            asChild
            variant="ghost"
            size="icon-sm"
            className="text-text-mid"
          >
            <Link
              href={`/orcamento?mes=${mesSeguinte}`}
              aria-label="Mês seguinte"
            >
              <ChevronRight className="size-4" aria-hidden />
            </Link>
          </Button>
        </div>
      </div>

      {comTeto.length > 0 && (
        <section className="glass grid grid-cols-3 gap-4 rounded-xl px-6 py-4">
          <div>
            <p className="text-text-dim text-[10px] tracking-wide uppercase">
              Orçado
            </p>
            <p className="money mt-0.5 text-lg">
              {formatCents(totalTetoCents)}
            </p>
          </div>
          <div>
            <p className="text-text-dim text-[10px] tracking-wide uppercase">
              Gasto
            </p>
            <p className="money mt-0.5 text-lg">
              {formatCents(totalGastoCents)}
            </p>
          </div>
          <div>
            <p className="text-text-dim text-[10px] tracking-wide uppercase">
              Estouradas
            </p>
            <p
              className={cn(
                "money mt-0.5 text-lg",
                estouradas > 0 && "text-negative",
              )}
            >
              {estouradas}
            </p>
          </div>
        </section>
      )}

      {comTeto.length === 0 && (
        <section className="glass grid place-items-center gap-3 rounded-xl px-6 py-14 text-center">
          <PiggyBank className="text-brand size-6" aria-hidden />
          <p className="text-base font-medium">Nenhum teto definido</p>
          <p className="text-text-mid max-w-sm text-sm">
            Escolha um teto mensal para as categorias que importam. O app avisa
            quando chegar em 80% e quando estourar.
          </p>
        </section>
      )}

      {[...grupos.entries()].map(([pai, doGrupo]) => {
        // Grupo inteiro sem teto e sem gasto não merece uma seção — vai para a
        // lista compacta do fim.
        const relevante = doGrupo.some(
          (linha) => linha.progresso !== null || linha.spentCents > 0,
        );
        if (!relevante) return null;

        return (
          <section key={pai} className="grid gap-2">
            <h2 className="text-text-mid text-xs font-medium tracking-wide uppercase">
              {pai}
            </h2>

            <div className="bg-surface-1/60 border-line grid gap-1 rounded-xl border px-5 py-3">
              {doGrupo
                .filter(
                  (linha) => linha.progresso !== null || linha.spentCents > 0,
                )
                .map((linha) => (
                  <LinhaDoOrcamento
                    key={linha.categoryId}
                    linha={linha}
                    period={period}
                  />
                ))}
            </div>
          </section>
        );
      })}

      {semTeto.filter((linha) => linha.spentCents === 0).length > 0 && (
        <details className="text-text-mid text-sm">
          <summary className="cursor-pointer select-none">
            Categorias sem movimento neste mês
          </summary>
          <div className="bg-surface-1/40 border-line mt-2 grid gap-1 rounded-xl border px-5 py-3">
            {semTeto
              .filter((linha) => linha.spentCents === 0)
              .map((linha) => (
                <div
                  key={linha.categoryId}
                  className="flex items-center justify-between gap-3 py-1.5"
                >
                  <p className="truncate text-sm">
                    {linha.categoryName}
                    <span className="text-text-dim ml-2 text-xs">
                      {linha.parentName}
                    </span>
                  </p>
                  <OrcamentoDialog
                    categoryId={linha.categoryId}
                    categoryName={linha.categoryName}
                    period={period}
                    budgetId={linha.budgetId}
                    limitCents={linha.limitCents}
                    rollover={linha.rollover}
                  />
                </div>
              ))}
          </div>
        </details>
      )}
    </div>
  );
}

function LinhaDoOrcamento({
  linha,
  period,
}: {
  linha: LinhaDeOrcamento & {
    rolloverCents: number;
    progresso: ReturnType<typeof categoryProgress> | null;
  };
  period: string;
}) {
  const progresso = linha.progresso;

  return (
    <div className="grid gap-1.5 py-2">
      <div className="flex items-center justify-between gap-3">
        <p className="min-w-0 truncate text-sm font-medium">
          {linha.categoryName}
          {linha.rolloverCents > 0 && (
            <span className="text-text-dim ml-2 text-xs">
              +{formatCents(linha.rolloverCents)} do mês passado
            </span>
          )}
        </p>

        <div className="flex shrink-0 items-center gap-2">
          <p className="text-sm tabular-nums">
            <span
              className={cn(
                progresso?.alert === "over100" && "text-negative font-medium",
                progresso?.alert === "warn80" && "text-warning font-medium",
              )}
            >
              {formatCents(linha.spentCents, { symbol: false })}
            </span>
            {progresso && (
              <span className="text-text-dim">
                {" "}
                /{" "}
                {formatCents(progresso.effectiveLimitCents, { symbol: false })}
              </span>
            )}
          </p>
          <OrcamentoDialog
            categoryId={linha.categoryId}
            categoryName={linha.categoryName}
            period={period}
            budgetId={linha.budgetId}
            limitCents={linha.limitCents}
            rollover={linha.rollover}
          />
        </div>
      </div>

      {progresso && (
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.min(
            Math.round(progresso.usedFraction * 100),
            999,
          )}
          aria-label={`${linha.categoryName}: ${Math.round(progresso.usedFraction * 100)}% do teto`}
          className="bg-surface-2 h-1.5 overflow-hidden rounded-full"
        >
          <div
            className={cn(
              "h-full rounded-full transition-[width] duration-300",
              TOM_DA_BARRA[progresso.alert],
            )}
            style={{
              width: `${Math.min(progresso.usedFraction * 100, 100)}%`,
            }}
          />
        </div>
      )}

      {progresso?.alert === "over100" && (
        <p className="text-negative text-xs">
          Estourou em {formatCents(Math.abs(progresso.remainingCents))}
        </p>
      )}
    </div>
  );
}
