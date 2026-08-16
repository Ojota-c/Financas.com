import type { Metadata } from "next";

import { Target, Trophy } from "lucide-react";

import { requireSessionContext } from "@/lib/auth/session";
import {
  listarMetas,
  listarTodosAportes,
  type Meta,
} from "@/lib/db/queries/goals";
import {
  formatCents,
  projectedCompletionDate,
  suggestedMonthlyContribution,
  sumCents,
} from "@/lib/finance";
import { cn } from "@/lib/utils/cn";
import { dataCurta, hoje } from "@/lib/utils/dates";

import { MetaCardAcoes } from "./_components/meta-card-acoes";
import { MetaDialog } from "./_components/meta-dialog";

export const metadata: Metadata = { title: "Metas" };

export default async function MetasPage() {
  const contexto = await requireSessionContext();

  const [metas, aportes] = await Promise.all([
    listarMetas(contexto),
    listarTodosAportes(contexto),
  ]);

  const dataDeHoje = hoje();
  const totalGuardado = sumCents(metas.map((meta) => meta.savedCents));

  const aportesPorMeta = new Map<string, typeof aportes>();
  for (const aporte of aportes) {
    const lista = aportesPorMeta.get(aporte.goalId) ?? [];
    lista.push(aporte);
    aportesPorMeta.set(aporte.goalId, lista);
  }

  return (
    <div className="mx-auto grid max-w-5xl gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-[-0.02em]">Metas</h1>
          <p className="text-text-mid mt-1 text-sm">
            {metas.length === 0
              ? "Nenhum cofrinho ainda"
              : `${formatCents(totalGuardado)} guardados em ${metas.length} ${
                  metas.length === 1 ? "meta" : "metas"
                }`}
          </p>
        </div>

        <MetaDialog />
      </div>

      {metas.length === 0 ? (
        <section className="glass grid place-items-center gap-3 rounded-xl px-6 py-16 text-center">
          <Target className="text-brand size-6" aria-hidden />
          <p className="text-base font-medium">Dê um destino ao dinheiro</p>
          <p className="text-text-mid max-w-sm text-sm">
            Reserva de emergência, viagem, notebook novo. Com um alvo e uma
            data, o app diz quanto guardar por mês.
          </p>
        </section>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {metas.map((meta) => (
            <MetaCard
              key={meta.id}
              meta={meta}
              aportes={aportesPorMeta.get(meta.id) ?? []}
              hoje={dataDeHoje}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function MetaCard({
  meta,
  aportes,
  hoje: dataDeHoje,
}: {
  meta: Meta;
  aportes: { date: string; amountCents: number }[];
  hoje: string;
}) {
  const batida = meta.savedCents >= meta.targetCents;
  const pausada = meta.status === "paused";

  const fracao =
    meta.targetCents > 0 ? Math.min(meta.savedCents / meta.targetCents, 1) : 0;

  const sugestao = suggestedMonthlyContribution({
    targetCents: meta.targetCents,
    savedCents: meta.savedCents,
    targetDate: meta.targetDate ?? undefined,
    referenceDate: dataDeHoje,
  });

  const projecao = batida
    ? null
    : projectedCompletionDate({
        targetCents: meta.targetCents,
        savedCents: meta.savedCents,
        contributions: aportes,
        referenceDate: dataDeHoje,
      });

  return (
    <section
      className={cn(
        "bg-surface-1/60 border-line grid content-start gap-3 rounded-xl border px-5 py-4",
        // --gold é reservado a CONQUISTA — meta batida é exatamente isso.
        batida && "border-gold/40",
        pausada && "opacity-70",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 truncate text-sm font-medium">
            {batida && (
              <Trophy className="text-gold size-4 shrink-0" aria-hidden />
            )}
            {meta.name}
            {pausada && (
              <span className="border-line text-text-dim shrink-0 rounded-full border px-1.5 py-px text-[10px] font-normal">
                pausada
              </span>
            )}
          </p>
          <p className="text-text-mid mt-0.5 text-xs">
            {batida
              ? "Meta completa 🎉"
              : meta.targetDate
                ? `até ${dataCurta(meta.targetDate)}`
                : "sem prazo"}
          </p>
        </div>
      </div>

      <div>
        <p className="money text-xl">
          {formatCents(meta.savedCents)}
          <span className="text-text-dim ml-1 text-sm font-normal">
            / {formatCents(meta.targetCents)}
          </span>
        </p>

        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(fracao * 100)}
          aria-label={`${meta.name}: ${Math.round(fracao * 100)}% guardado`}
          className="bg-surface-2 mt-2 h-1.5 overflow-hidden rounded-full"
        >
          <div
            className={cn(
              "h-full rounded-full",
              batida ? "bg-gold" : "brand-gradient",
            )}
            style={{ width: `${fracao * 100}%` }}
          />
        </div>
      </div>

      {!batida && (sugestao !== null || projecao !== null) && (
        <div className="text-text-mid grid gap-0.5 text-xs">
          {sugestao !== null && sugestao > 0 && (
            <p>
              Guarde{" "}
              <span className="text-text font-medium">
                {formatCents(sugestao)}/mês
              </span>{" "}
              para chegar no prazo.
            </p>
          )}
          {projecao !== null && (
            <p>
              No ritmo atual, conclui em{" "}
              <span className="text-text font-medium">
                {dataCurta(projecao)}
              </span>
              .
            </p>
          )}
        </div>
      )}

      <MetaCardAcoes meta={meta} />
    </section>
  );
}
