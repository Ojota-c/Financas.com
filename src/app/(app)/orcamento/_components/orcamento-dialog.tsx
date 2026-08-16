"use client";

import { useState, useTransition } from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { Pencil, Plus } from "lucide-react";
import { Controller, useForm } from "react-hook-form";

import { Field } from "@/components/form/field";
import { MoneyInput } from "@/components/finance/money-input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  budgetSchema,
  type BudgetInput,
  type BudgetValues,
} from "@/lib/validators/finance";

import { definirOrcamentoAction, removerOrcamentoAction } from "../actions";

/**
 * Define ou edita o teto de UMA categoria no mês aberto. O período nunca é
 * escolhido aqui — vem da navegação de mês da página, senão a pessoa define
 * teto de março achando que era abril.
 */
export function OrcamentoDialog({
  categoryId,
  categoryName,
  period,
  budgetId,
  limitCents,
  rollover,
}: {
  categoryId: string;
  categoryName: string;
  period: string;
  budgetId: string | null;
  limitCents: number | null;
  rollover: boolean;
}) {
  const [aberto, setAberto] = useState(false);
  const [erroServidor, setErroServidor] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  const editando = budgetId !== null;

  const {
    control,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<BudgetInput, unknown, BudgetValues>({
    resolver: zodResolver(budgetSchema),
    defaultValues: {
      categoryId,
      period,
      limit: limitCents ?? 0,
      rollover,
    },
  });

  function enviar(valores: BudgetValues) {
    setErroServidor(null);

    iniciar(async () => {
      const resultado = await definirOrcamentoAction(valores);

      if ("error" in resultado) {
        setErroServidor(resultado.error);
        return;
      }

      setAberto(false);
    });
  }

  function remover() {
    if (!budgetId) return;

    iniciar(async () => {
      const resultado = await removerOrcamentoAction(budgetId);

      if ("error" in resultado) {
        setErroServidor(resultado.error);
        return;
      }

      setAberto(false);
    });
  }

  return (
    <Dialog
      open={aberto}
      onOpenChange={(estado) => {
        setAberto(estado);
        if (estado) {
          reset({ categoryId, period, limit: limitCents ?? 0, rollover });
          setErroServidor(null);
        }
      }}
    >
      <DialogTrigger asChild>
        {editando ? (
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Editar teto de ${categoryName}`}
            className="text-text-dim hover:text-text"
          >
            <Pencil className="size-3.5" aria-hidden />
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            className="text-text-dim hover:text-text h-7 gap-1 px-2 text-xs"
          >
            <Plus className="size-3.5" aria-hidden />
            Definir teto
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{categoryName}</DialogTitle>
          <DialogDescription>
            Teto mensal desta categoria. O app avisa aos 80% e no estouro.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(enviar)} className="grid gap-4" noValidate>
          <Field label="Teto do mês" error={errors.limit?.message}>
            {(props) => (
              <Controller
                control={control}
                name="limit"
                render={({ field }) => (
                  <MoneyInput
                    {...props}
                    valueCents={
                      typeof field.value === "number" ? field.value : 0
                    }
                    onChangeCents={field.onChange}
                    autoFocus
                  />
                )}
              />
            )}
          </Field>

          <Controller
            control={control}
            name="rollover"
            render={({ field }) => (
              <label className="text-text-mid flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="accent-brand size-4"
                  checked={field.value ?? false}
                  onChange={(evento) => field.onChange(evento.target.checked)}
                />
                Sobra do mês vai para o mês seguinte (envelope)
              </label>
            )}
          />

          {erroServidor && (
            <p
              role="alert"
              className="border-negative/30 bg-negative/10 text-negative rounded-md border px-3 py-2 text-xs"
            >
              {erroServidor}
            </p>
          )}

          <div className="flex gap-2">
            {editando && (
              <Button
                type="button"
                variant="ghost"
                disabled={pendente}
                onClick={remover}
                className="text-text-dim hover:text-negative"
              >
                Remover
              </Button>
            )}
            <Button
              type="submit"
              disabled={pendente}
              className="flex-1 font-semibold"
            >
              {pendente ? "Salvando…" : "Salvar teto"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
