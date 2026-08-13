"use client";

import { useState, useTransition } from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";

import { MoneyInput } from "@/components/finance/money-input";
import { Field } from "@/components/form/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Conta } from "@/lib/db/queries/accounts";
import { hoje } from "@/lib/utils/dates";
import {
  transferSchema,
  type TransferInput,
  type TransferValues,
} from "@/lib/validators/finance";

import { criarTransferenciaAction } from "../actions";

/**
 * Transferência entre contas próprias. Sem categoria de propósito: mover
 * dinheiro de lugar não é gasto, e categorizar faria o relatório somar mais do
 * que a pessoa ganhou. As duas pernas nascem na mesma transação, no servidor.
 */
export function TransferenciaForm({
  contas,
  aoConcluir,
}: {
  contas: Conta[];
  aoConcluir: () => void;
}) {
  const [erroServidor, setErroServidor] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<TransferInput, unknown, TransferValues>({
    resolver: zodResolver(transferSchema),
    defaultValues: {
      origemAccountId: contas[0]?.id ?? "",
      destinoAccountId: contas[1]?.id ?? "",
      amount: 0,
      date: hoje(),
      description: "Transferência",
    },
  });

  function enviar(valores: TransferValues) {
    setErroServidor(null);

    iniciar(async () => {
      const resultado = await criarTransferenciaAction(valores);

      if ("error" in resultado) {
        setErroServidor(resultado.error);
        return;
      }

      aoConcluir();
    });
  }

  // Com uma conta só não há para onde transferir.
  if (contas.length < 2) {
    return (
      <p className="text-text-mid py-8 text-center text-sm">
        Transferência precisa de duas contas. Cadastre outra em Contas.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit(enviar)} className="grid gap-4" noValidate>
      <Field label="Valor" error={errors.amount?.message}>
        {(props) => (
          <Controller
            control={control}
            name="amount"
            render={({ field }) => (
              <MoneyInput
                {...props}
                valueCents={typeof field.value === "number" ? field.value : 0}
                onChangeCents={field.onChange}
                autoFocus
              />
            )}
          />
        )}
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="De" error={errors.origemAccountId?.message}>
          {(props) => (
            <Controller
              control={control}
              name="origemAccountId"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger {...props} className="w-full">
                    <SelectValue placeholder="Conta de origem" />
                  </SelectTrigger>
                  <SelectContent>
                    {contas.map((conta) => (
                      <SelectItem key={conta.id} value={conta.id}>
                        {conta.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          )}
        </Field>

        <Field label="Para" error={errors.destinoAccountId?.message}>
          {(props) => (
            <Controller
              control={control}
              name="destinoAccountId"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger {...props} className="w-full">
                    <SelectValue placeholder="Conta de destino" />
                  </SelectTrigger>
                  <SelectContent>
                    {contas.map((conta) => (
                      <SelectItem key={conta.id} value={conta.id}>
                        {conta.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          )}
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Descrição" error={errors.description?.message}>
          {(props) => (
            <Input
              {...props}
              {...register("description")}
              placeholder="Para a reserva"
              maxLength={120}
            />
          )}
        </Field>

        <Field label="Data" error={errors.date?.message}>
          {(props) => <Input {...props} type="date" {...register("date")} />}
        </Field>
      </div>

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
        size="lg"
        disabled={pendente}
        className="h-11 w-full font-semibold"
      >
        {pendente ? "Transferindo…" : "Transferir"}
      </Button>
    </form>
  );
}
