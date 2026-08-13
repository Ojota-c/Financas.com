"use client";

import { useState, useTransition } from "react";

import { Check, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { Lancamento } from "@/lib/db/queries/transactions";
import { formatCents } from "@/lib/finance";
import { dataCurta } from "@/lib/utils/dates";
import { cn } from "@/lib/utils/cn";

import { apagarLancamentoAction, confirmarLancamentoAction } from "../actions";

/**
 * Uma linha do extrato.
 *
 * O sinal não é só a cor: receita leva "+", saída leva "−", e o status pendente
 * leva rótulo escrito. A §7 exige isso — "nunca comunicar informação só por
 * cor" —, e sem o sinal a linha fica ilegível para quem não distingue verde de
 * vermelho.
 */
export function LinhaLancamento({ lancamento }: { lancamento: Lancamento }) {
  const [pendente, iniciar] = useTransition();
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false);

  const saida = lancamento.type === "expense" || lancamento.direction === "out";
  const entrada = lancamento.type === "income" || lancamento.direction === "in";

  const aPagar = lancamento.status === "pending";

  return (
    <li
      className={cn(
        "border-line/60 flex items-center justify-between gap-3 border-b py-3 last:border-b-0",
        pendente && "opacity-50",
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium">
            {lancamento.description}
          </p>
          {aPagar && (
            <span className="border-warning/40 text-warning shrink-0 rounded-full border px-1.5 py-px text-[10px]">
              a pagar
            </span>
          )}
        </div>
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
        {entrada ? "+" : saida ? "−" : ""}
        {formatCents(lancamento.amountCents, { symbol: false })}
      </p>

      <div className="flex shrink-0 items-center gap-1">
        {aPagar && (
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Marcar ${lancamento.description} como pago`}
            disabled={pendente}
            onClick={() =>
              iniciar(async () => {
                await confirmarLancamentoAction(lancamento.id);
              })
            }
            className="text-text-mid hover:text-positive"
          >
            <Check className="size-4" aria-hidden />
          </Button>
        )}

        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={
            confirmandoExclusao
              ? `Confirmar exclusão de ${lancamento.description}`
              : `Excluir ${lancamento.description}`
          }
          disabled={pendente}
          onClick={() => {
            // Dois toques em vez de um `confirm()`: apagar é irreversível, e um
            // diálogo nativo no meio de uma lista quebra o ritmo de quem está
            // limpando vários.
            if (!confirmandoExclusao) {
              setConfirmandoExclusao(true);
              setTimeout(() => setConfirmandoExclusao(false), 3000);
              return;
            }

            iniciar(async () => {
              await apagarLancamentoAction(lancamento.id);
            });
          }}
          className={cn(
            "text-text-dim hover:text-negative",
            confirmandoExclusao && "text-negative bg-negative/10",
          )}
        >
          <Trash2 className="size-4" aria-hidden />
        </Button>
      </div>
    </li>
  );
}
