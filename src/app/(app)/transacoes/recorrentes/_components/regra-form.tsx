"use client";

import { useState, useTransition } from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm, useWatch } from "react-hook-form";

import { Field } from "@/components/form/field";
import { MoneyInput } from "@/components/finance/money-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Conta } from "@/lib/db/queries/accounts";
import type { CategoriaEmArvore } from "@/lib/db/queries/categories";
import { hoje } from "@/lib/utils/dates";
import {
  FREQUENCIAS,
  ROTULO_DA_FREQUENCIA,
  recurringSchema,
  type RecurringInput,
  type RecurringValues,
} from "@/lib/validators/finance";

import { criarRegraAction } from "../actions";

const DIAS_DA_SEMANA = [
  "Domingo",
  "Segunda",
  "Terça",
  "Quarta",
  "Quinta",
  "Sexta",
  "Sábado",
] as const;

/**
 * Nova recorrência: aluguel, salário, assinatura. O molde é o mesmo do
 * lançamento; muda o QUANDO — frequência, dia e início.
 */
export function RegraForm({
  contas,
  categorias,
  aoConcluir,
}: {
  contas: Conta[];
  categorias: CategoriaEmArvore[];
  aoConcluir: () => void;
}) {
  const [erroServidor, setErroServidor] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<RecurringInput, unknown, RecurringValues>({
    resolver: zodResolver(recurringSchema),
    defaultValues: {
      type: "expense",
      accountId: contas[0]?.id ?? "",
      categoryId: "",
      amount: 0,
      description: "",
      frequency: "monthly",
      interval: 1,
      dayOfMonth: Number(hoje().slice(8, 10)),
      weekday: 1,
      startDate: hoje(),
      endDate: "",
      autoPost: false,
    },
  });

  const tipo = useWatch({ control, name: "type" }) ?? "expense";
  const frequencia = useWatch({ control, name: "frequency" });
  const autoPost = useWatch({ control, name: "autoPost" });

  const grupos = categorias
    .map((pai) => ({
      ...pai,
      children: pai.children.filter((filha) => filha.kind === tipo),
    }))
    .filter((pai) => pai.children.length > 0);

  function enviar(valores: RecurringValues) {
    setErroServidor(null);

    iniciar(async () => {
      const resultado = await criarRegraAction(valores);

      if ("error" in resultado) {
        setErroServidor(resultado.error);
        return;
      }

      aoConcluir();
    });
  }

  return (
    <form onSubmit={handleSubmit(enviar)} className="grid gap-4" noValidate>
      <Field label="Tipo" error={errors.type?.message}>
        {(props) => (
          <Controller
            control={control}
            name="type"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger {...props} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="expense">Despesa</SelectItem>
                  <SelectItem value="income">Receita</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
        )}
      </Field>

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
              />
            )}
          />
        )}
      </Field>

      <Field label="Descrição" error={errors.description?.message}>
        {(props) => (
          <Input
            {...props}
            {...register("description")}
            placeholder={tipo === "expense" ? "Aluguel" : "Salário"}
            maxLength={120}
          />
        )}
      </Field>

      <Field label="Categoria" error={errors.categoryId?.message}>
        {(props) => (
          <Controller
            control={control}
            name="categoryId"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger {...props} className="w-full">
                  <SelectValue placeholder="Escolha uma categoria" />
                </SelectTrigger>
                <SelectContent>
                  {grupos.map((pai) => (
                    <SelectGroup key={pai.id}>
                      <SelectLabel>{pai.name}</SelectLabel>
                      {pai.children.map((filha) => (
                        <SelectItem key={filha.id} value={filha.id}>
                          {filha.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        )}
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Conta" error={errors.accountId?.message}>
          {(props) => (
            <Controller
              control={control}
              name="accountId"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger {...props} className="w-full">
                    <SelectValue placeholder="Escolha a conta" />
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

        <Field label="Frequência" error={errors.frequency?.message}>
          {(props) => (
            <Controller
              control={control}
              name="frequency"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger {...props} className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FREQUENCIAS.map((frequenciaOpcao) => (
                      <SelectItem key={frequenciaOpcao} value={frequenciaOpcao}>
                        {ROTULO_DA_FREQUENCIA[frequenciaOpcao]}
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
        {frequencia === "monthly" && (
          <Field
            label="Dia do mês"
            hint="Dia 31 em mês curto vira o último dia."
            error={errors.dayOfMonth?.message}
          >
            {(props) => (
              <Input
                {...props}
                type="number"
                min={1}
                max={31}
                inputMode="numeric"
                {...register("dayOfMonth")}
              />
            )}
          </Field>
        )}

        {frequencia === "weekly" && (
          <Field label="Dia da semana" error={errors.weekday?.message}>
            {(props) => (
              <Controller
                control={control}
                name="weekday"
                render={({ field }) => (
                  <Select
                    value={String(field.value ?? 1)}
                    onValueChange={(valor) => field.onChange(Number(valor))}
                  >
                    <SelectTrigger {...props} className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DIAS_DA_SEMANA.map((dia, indice) => (
                        <SelectItem key={dia} value={String(indice)}>
                          {dia}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            )}
          </Field>
        )}

        <Field label="Começa em" error={errors.startDate?.message}>
          {(props) => (
            <Input {...props} type="date" {...register("startDate")} />
          )}
        </Field>

        <Field
          label="Termina em"
          hint="Opcional — vazio repete para sempre."
          error={errors.endDate?.message}
        >
          {(props) => <Input {...props} type="date" {...register("endDate")} />}
        </Field>
      </div>

      <Controller
        control={control}
        name="autoPost"
        render={({ field }) => (
          <label className="text-text-mid flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="accent-brand size-4"
              checked={field.value ?? false}
              onChange={(evento) => field.onChange(evento.target.checked)}
            />
            Lançar sozinho, sem pedir confirmação
          </label>
        )}
      />

      {!autoPost && (
        <p className="text-text-dim text-xs">
          Cada ocorrência entra como conta a pagar, para você confirmar no
          semáforo.
        </p>
      )}

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
        disabled={pendente || contas.length === 0}
        className="h-11 w-full font-semibold"
      >
        {pendente ? "Salvando…" : "Criar recorrência"}
      </Button>
    </form>
  );
}
