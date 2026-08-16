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
import { Input } from "@/components/ui/input";
import type { Meta } from "@/lib/db/queries/goals";
import {
  goalSchema,
  type GoalInput,
  type GoalValues,
} from "@/lib/validators/finance";

import { atualizarMetaAction, criarMetaAction } from "../actions";

/**
 * Criar ou editar um cofrinho. A data-alvo é opcional de propósito: "reserva de
 * emergência" não tem prazo, "viagem em julho" tem — e é a data que faz o
 * aporte sugerido existir.
 */
export function MetaDialog({ meta }: { meta?: Meta }) {
  const [aberto, setAberto] = useState(false);
  const [erroServidor, setErroServidor] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  const editando = meta !== undefined;

  const valoresIniciais: GoalInput = {
    name: meta?.name ?? "",
    target: meta?.targetCents ?? 0,
    targetDate: meta?.targetDate ?? "",
    accountId: meta?.accountId ?? "",
    color: meta?.color ?? "",
  };

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<GoalInput, unknown, GoalValues>({
    resolver: zodResolver(goalSchema),
    defaultValues: valoresIniciais,
  });

  function enviar(valores: GoalValues) {
    setErroServidor(null);

    iniciar(async () => {
      const resultado = editando
        ? await atualizarMetaAction(meta.id, valores)
        : await criarMetaAction(valores);

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
          reset(valoresIniciais);
          setErroServidor(null);
        }
      }}
    >
      <DialogTrigger asChild>
        {editando ? (
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Editar meta ${meta.name}`}
            className="text-text-dim hover:text-text"
          >
            <Pencil className="size-3.5" aria-hidden />
          </Button>
        ) : (
          <Button className="gap-2">
            <Plus className="size-4" aria-hidden />
            Nova meta
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{editando ? meta.name : "Nova meta"}</DialogTitle>
          <DialogDescription>
            Um cofrinho com alvo: reserva, viagem, troca de notebook.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(enviar)} className="grid gap-4" noValidate>
          <Field label="Nome" error={errors.name?.message}>
            {(props) => (
              <Input
                {...props}
                {...register("name")}
                placeholder="Reserva de emergência"
                maxLength={60}
                autoFocus={!editando}
              />
            )}
          </Field>

          <Field label="Valor alvo" error={errors.target?.message}>
            {(props) => (
              <Controller
                control={control}
                name="target"
                render={({ field }) => (
                  <MoneyInput
                    {...props}
                    valueCents={
                      typeof field.value === "number" ? field.value : 0
                    }
                    onChangeCents={field.onChange}
                  />
                )}
              />
            )}
          </Field>

          <Field
            label="Até quando"
            hint="Opcional. Com data, o app sugere o aporte mensal."
            error={errors.targetDate?.message}
          >
            {(props) => (
              <Input {...props} type="date" {...register("targetDate")} />
            )}
          </Field>

          {erroServidor && (
            <p
              role="alert"
              className="border-negative/30 bg-negative/10 text-negative rounded-md border px-3 py-2 text-xs"
            >
              {erroServidor}
            </p>
          )}

          <Button
            type="submit"
            disabled={pendente}
            className="w-full font-semibold"
          >
            {pendente ? "Salvando…" : editando ? "Salvar" : "Criar meta"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
