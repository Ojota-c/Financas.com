"use client";

import { useState, useTransition } from "react";

import { Pause, Play, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { Regra } from "@/lib/db/queries/recurring";
import { formatCents } from "@/lib/finance";
import { cn } from "@/lib/utils/cn";
import { dataCurta } from "@/lib/utils/dates";
import { ROTULO_DA_FREQUENCIA } from "@/lib/validators/finance";

import { alternarRegraAction, apagarRegraAction } from "../actions";

function rotuloDaRegra(regra: Regra): string {
  const base =
    ROTULO_DA_FREQUENCIA[
      regra.frequency as keyof typeof ROTULO_DA_FREQUENCIA
    ] ?? regra.frequency;

  if (regra.interval > 1) return `${base}, a cada ${regra.interval}`;
  return base;
}

export function LinhaRegra({ regra }: { regra: Regra }) {
  const [pendente, iniciar] = useTransition();
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false);

  const receita = regra.template.type === "income";

  return (
    <li
      className={cn(
        "border-line/60 flex items-center justify-between gap-3 border-b py-3 last:border-b-0",
        pendente && "opacity-50",
        !regra.isActive && "opacity-60",
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium">
            {regra.template.description}
          </p>
          {regra.autoPost ? (
            <span className="border-line text-text-dim shrink-0 rounded-full border px-1.5 py-px text-[10px]">
              automática
            </span>
          ) : (
            <span className="border-warning/40 text-warning shrink-0 rounded-full border px-1.5 py-px text-[10px]">
              confirma antes
            </span>
          )}
          {!regra.isActive && (
            <span className="border-line text-text-dim shrink-0 rounded-full border px-1.5 py-px text-[10px]">
              pausada
            </span>
          )}
        </div>
        <p className="text-text-dim truncate text-xs">
          {rotuloDaRegra(regra)}
          {regra.nextOccurrence && regra.isActive
            ? ` · próxima em ${dataCurta(regra.nextOccurrence)}`
            : ""}
        </p>
      </div>

      <p
        className={cn(
          "shrink-0 text-sm font-medium tabular-nums",
          receita && "text-positive",
        )}
      >
        {receita ? "+" : "−"}
        {formatCents(regra.template.amountCents, { symbol: false })}
      </p>

      <div className="flex shrink-0 items-center gap-1">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={
            regra.isActive
              ? `Pausar ${regra.template.description}`
              : `Reativar ${regra.template.description}`
          }
          disabled={pendente}
          onClick={() =>
            iniciar(async () => {
              await alternarRegraAction(regra.id, !regra.isActive);
            })
          }
          className="text-text-mid hover:text-text"
        >
          {regra.isActive ? (
            <Pause className="size-4" aria-hidden />
          ) : (
            <Play className="size-4" aria-hidden />
          )}
        </Button>

        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={
            confirmandoExclusao
              ? `Confirmar exclusão de ${regra.template.description}`
              : `Excluir ${regra.template.description}`
          }
          disabled={pendente}
          onClick={() => {
            if (!confirmandoExclusao) {
              setConfirmandoExclusao(true);
              setTimeout(() => setConfirmandoExclusao(false), 3000);
              return;
            }

            iniciar(async () => {
              await apagarRegraAction(regra.id);
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
