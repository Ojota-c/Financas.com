"use client";

import { useState, useTransition } from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { PiggyBank } from "lucide-react";
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
import { hoje } from "@/lib/utils/dates";
import {
  contributionSchema,
  type ContributionInput,
  type ContributionValues,
} from "@/lib/validators/finance";

import { aportarAction } from "../actions";

/**
 * Aportar (ou resgatar: valor negativo) num cofrinho. O trigger do banco soma
 * em `saved_cents` na mesma transação — aqui só se registra o evento.
 */
export function AporteDialog({
  goalId,
  goalName,
}: {
  goalId: string;
  goalName: string;
}) {
  const [aberto, setAberto] = useState(false);
  const [erroServidor, setErroServidor] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<ContributionInput, unknown, ContributionValues>({
    resolver: zodResolver(contributionSchema),
    defaultValues: { goalId, amount: 0, date: hoje() },
  });

  function enviar(valores: ContributionValues) {
    setErroServidor(null);

    iniciar(async () => {
      const resultado = await aportarAction(valores);

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
          reset({ goalId, amount: 0, date: hoje() });
          setErroServidor(null);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <PiggyBank className="size-4" aria-hidden />
          Aportar
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Aporte em {goalName}</DialogTitle>
          <DialogDescription>
            Guardou, registra. Para resgatar, use valor negativo.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(enviar)} className="grid gap-4" noValidate>
          <Field label="Valor" error={errors.amount?.message}>
            {(props) => (
              <Controller
                control={control}
                name="amount"
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

          <Field label="Data" error={errors.date?.message}>
            {(props) => <Input {...props} type="date" {...register("date")} />}
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
            {pendente ? "Salvando…" : "Registrar aporte"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
