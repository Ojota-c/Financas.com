"use client";

import { useRef, useState, useTransition } from "react";

import { Check, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { Lancamento } from "@/lib/db/queries/transactions";
import { formatCents } from "@/lib/finance";
import { cn } from "@/lib/utils/cn";
import { rotuloDoVencimento, type Semaforo } from "@/lib/utils/vencimento";

import {
  apagarLancamentoAction,
  confirmarLancamentoAction,
} from "../../actions";

const TOM_DO_SEMAFORO: Record<Semaforo, string> = {
  vencido: "bg-negative",
  em_breve: "bg-warning",
  futuro: "bg-text-dim",
};

/** Arrastar além disso marca como pago. ~metade de um polegar de folga. */
const LIMIAR_DO_SWIPE = 96;

/**
 * Uma conta a pagar, com o gesto da §5.1: swipe para a direita marca como pago.
 *
 * O gesto vive em pointer events e não numa lib de gesto — é um único eixo, um
 * único limiar, e o botão de check continua ali para quem navega por teclado ou
 * nem sabe que o swipe existe. O swipe é atalho, nunca o único caminho.
 */
export function LinhaPendente({
  lancamento,
  semaforo,
  hoje,
}: {
  lancamento: Lancamento;
  semaforo: Semaforo;
  hoje: string;
}) {
  const [pendente, iniciar] = useTransition();
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false);
  const [arrasto, setArrasto] = useState(0);
  const origem = useRef<{ x: number; y: number } | null>(null);

  function pagar() {
    iniciar(async () => {
      await confirmarLancamentoAction(lancamento.id);
    });
  }

  return (
    <li className="relative overflow-hidden">
      {/* O fundo que o arrasto revela: quanto mais puxa, mais perto do "pago". */}
      <div
        aria-hidden
        className={cn(
          "bg-positive/15 text-positive absolute inset-0 flex items-center gap-2 rounded-lg px-4 text-sm font-medium opacity-0 transition-opacity",
          arrasto > 24 && "opacity-100",
        )}
      >
        <Check className="size-4" />
        {arrasto > LIMIAR_DO_SWIPE ? "Solte para pagar" : "Pago"}
      </div>

      <div
        className={cn(
          "border-line/60 bg-bg relative flex touch-pan-y items-center justify-between gap-3 border-b py-3 last:border-b-0",
          pendente && "opacity-50",
          arrasto === 0 && "transition-transform duration-200",
        )}
        style={{ transform: `translateX(${arrasto}px)` }}
        onPointerDown={(evento) => {
          if (evento.pointerType === "mouse") return;
          origem.current = { x: evento.clientX, y: evento.clientY };
        }}
        onPointerMove={(evento) => {
          if (!origem.current) return;

          const dx = evento.clientX - origem.current.x;
          const dy = evento.clientY - origem.current.y;

          // Gesto mais vertical que horizontal é scroll — solta o arrasto.
          if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 12) {
            origem.current = null;
            setArrasto(0);
            return;
          }

          setArrasto(Math.max(0, dx));
        }}
        onPointerUp={() => {
          if (arrasto > LIMIAR_DO_SWIPE) pagar();
          origem.current = null;
          setArrasto(0);
        }}
        onPointerCancel={() => {
          origem.current = null;
          setArrasto(0);
        }}
      >
        <span
          aria-hidden
          className={cn(
            "size-2 shrink-0 rounded-full",
            TOM_DO_SEMAFORO[semaforo],
            semaforo === "vencido" && "animate-pulse",
          )}
        />

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">
            {lancamento.description}
          </p>
          <p
            className={cn(
              "truncate text-xs",
              semaforo === "vencido"
                ? "text-negative"
                : semaforo === "em_breve"
                  ? "text-warning"
                  : "text-text-dim",
            )}
          >
            {rotuloDoVencimento(lancamento.dueDate, hoje)} ·{" "}
            {lancamento.accountName}
          </p>
        </div>

        <p className="shrink-0 text-sm font-medium tabular-nums">
          {formatCents(lancamento.amountCents)}
        </p>

        <div className="flex shrink-0 items-center gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Marcar ${lancamento.description} como pago`}
            disabled={pendente}
            onClick={pagar}
            className="text-text-mid hover:text-positive"
          >
            <Check className="size-4" aria-hidden />
          </Button>

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
      </div>
    </li>
  );
}
