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
  transactionSchema,
  type TransactionInput,
  type TransactionValues,
} from "@/lib/validators/finance";

import { criarLancamentoAction } from "../actions";

/**
 * Receita e despesa. Transferência tem forma própria (duas contas, sem
 * categoria), então mora em outro formulário — um schema condicional cobrindo
 * os três casos ficaria mais difícil de ler do que dois formulários.
 *
 * A ordem dos campos é a da §5.1: valor primeiro, com foco automático e teclado
 * numérico, porque é o único que a pessoa SEMPRE precisa digitar. Data já vem
 * preenchida com hoje, e conta com a primeira da lista.
 */
// 1–12 direto, depois os marcos comuns de loja. 48 é o teto do schema.
const PARCELAS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 18, 24, 36, 48];

export function LancamentoForm({
  tipo,
  contas,
  categorias,
  aoConcluir,
}: {
  tipo: "income" | "expense";
  contas: Conta[];
  categorias: CategoriaEmArvore[];
  aoConcluir: () => void;
}) {
  const [erroServidor, setErroServidor] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  // Só as folhas recebem lançamento — o pai agrupa. E só as do tipo certo:
  // oferecer "Salário" numa despesa é como o dado sai errado sem ninguém notar.
  const grupos = categorias
    .map((pai) => ({
      ...pai,
      children: pai.children.filter((filha) => filha.kind === tipo),
    }))
    .filter((pai) => pai.children.length > 0);

  const {
    register,
    control,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<TransactionInput, unknown, TransactionValues>({
    resolver: zodResolver(transactionSchema),
    defaultValues: {
      type: tipo,
      accountId: contas[0]?.id ?? "",
      categoryId: "",
      amount: 0,
      installments: 1,
      date: hoje(),
      description: "",
      status: "cleared",
      dueDate: "",
    },
  });

  // `useWatch` e não `watch()`: o segundo devolve uma função nova a cada render,
  // que o React Compiler não consegue memoizar sem arriscar UI velha.
  const status = useWatch({ control, name: "status" });

  function enviar(valores: TransactionValues) {
    setErroServidor(null);

    iniciar(async () => {
      const resultado = await criarLancamentoAction(valores);

      if ("error" in resultado) {
        setErroServidor(resultado.error);
        return;
      }

      aoConcluir();
    });
  }

  return (
    <form
      onSubmit={handleSubmit(enviar)}
      className="grid gap-4"
      noValidate
      // O zod é a autoridade; a validação nativa do browser só atrapalharia com
      // mensagem em inglês e formato diferente.
    >
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

      <Field label="Descrição" error={errors.description?.message}>
        {(props) => (
          <Input
            {...props}
            {...register("description")}
            placeholder={tipo === "expense" ? "Mercado" : "Salário"}
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

        <Field label="Data" error={errors.date?.message}>
          {(props) => <Input {...props} type="date" {...register("date")} />}
        </Field>
      </div>

      {tipo === "expense" && (
        <Field
          label="Parcelas"
          hint="O valor acima é o de CADA parcela."
          error={errors.installments?.message}
        >
          {(props) => (
            <Controller
              control={control}
              name="installments"
              render={({ field }) => (
                <Select
                  value={String(field.value ?? 1)}
                  onValueChange={(valor) => field.onChange(Number(valor))}
                >
                  <SelectTrigger {...props} className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PARCELAS.map((n) => (
                      <SelectItem key={n} value={String(n)}>
                        {n === 1 ? "À vista" : `${n}x`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          )}
        </Field>
      )}

      {/* O checkbox é boolean e o campo é enum, então ele não vai por
          `register` — traduz-se aqui, num ponto só. */}
      <label className="text-text-mid flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="accent-brand size-4"
          checked={status === "pending"}
          onChange={(evento) =>
            setValue("status", evento.target.checked ? "pending" : "cleared", {
              shouldValidate: true,
            })
          }
        />
        Ainda não paguei — é uma conta a pagar
      </label>

      {status === "pending" && (
        <Field label="Vencimento" error={errors.dueDate?.message}>
          {(props) => <Input {...props} type="date" {...register("dueDate")} />}
        </Field>
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
        {pendente ? "Salvando…" : "Lançar"}
      </Button>
    </form>
  );
}
