"use client";

import { useState, useTransition } from "react";

import { Pause, Play, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { Meta } from "@/lib/db/queries/goals";
import { cn } from "@/lib/utils/cn";

import { apagarMetaAction, pausarMetaAction } from "../actions";
import { AporteDialog } from "./aporte-dialog";
import { MetaDialog } from "./meta-dialog";

/** A régua de ações do card — a única parte do card que precisa de cliente. */
export function MetaCardAcoes({ meta }: { meta: Meta }) {
  const [pendente, iniciar] = useTransition();
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false);

  const pausada = meta.status === "paused";

  return (
    <div className="flex items-center gap-1">
      <AporteDialog goalId={meta.id} goalName={meta.name} />
      <MetaDialog meta={meta} />

      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={pausada ? `Reativar ${meta.name}` : `Pausar ${meta.name}`}
        disabled={pendente}
        onClick={() =>
          iniciar(async () => {
            await pausarMetaAction(meta.id, !pausada);
          })
        }
        className="text-text-dim hover:text-text"
      >
        {pausada ? (
          <Play className="size-3.5" aria-hidden />
        ) : (
          <Pause className="size-3.5" aria-hidden />
        )}
      </Button>

      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={
          confirmandoExclusao
            ? `Confirmar exclusão de ${meta.name}`
            : `Excluir ${meta.name}`
        }
        disabled={pendente}
        onClick={() => {
          if (!confirmandoExclusao) {
            setConfirmandoExclusao(true);
            setTimeout(() => setConfirmandoExclusao(false), 3000);
            return;
          }

          iniciar(async () => {
            await apagarMetaAction(meta.id);
          });
        }}
        className={cn(
          "text-text-dim hover:text-negative",
          confirmandoExclusao && "text-negative bg-negative/10",
        )}
      >
        <Trash2 className="size-3.5" aria-hidden />
      </Button>
    </div>
  );
}
