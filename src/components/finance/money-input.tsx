"use client";

import { forwardRef, useId } from "react";

import { cn } from "@/lib/utils/cn";

/**
 * O campo de dinheiro do app.
 *
 * Trabalha em CENTAVOS o tempo todo: cada tecla digitada empurra um dígito para
 * a direita, como numa maquininha — digitar "1", "2", "3" produz R$ 1,23. Não
 * existe um instante sequer em que o valor seja float, e por isso não existe
 * arredondamento a acontecer aqui.
 *
 * O valor é controlado por `valueCents` (inteiro) e reportado por
 * `onChangeCents` (inteiro). A string formatada é só pintura — quem escuta
 * recebe centavos.
 *
 * `inputMode="numeric"` é o que faz o teclado do celular abrir direto no
 * numérico, e é metade da meta de "lançar em menos de 5 segundos".
 */

export type MoneyInputProps = {
  valueCents: number;
  onChangeCents: (cents: number) => void;
  /** Deixa digitar valor negativo (saldo inicial de cartão, por exemplo). */
  allowNegative?: boolean;
  id?: string;
  name?: string;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
};

function formatarParaEdicao(cents: number): string {
  const negativo = cents < 0;
  const absoluto = Math.abs(cents);

  const centavos = absoluto % 100;
  const reais = (absoluto - centavos) / 100;

  const inteiro = new Intl.NumberFormat("pt-BR").format(reais);

  return `${negativo ? "-" : ""}${inteiro},${String(centavos).padStart(2, "0")}`;
}

export const MoneyInput = forwardRef<HTMLInputElement, MoneyInputProps>(
  function MoneyInput(
    {
      valueCents,
      onChangeCents,
      allowNegative = false,
      className,
      placeholder = "0,00",
      ...props
    },
    ref,
  ) {
    const gerado = useId();
    const id = props.id ?? gerado;

    function aoDigitar(evento: React.ChangeEvent<HTMLInputElement>) {
      const bruto = evento.target.value;

      // Só os dígitos importam: a máscara é reconstruída do zero a cada tecla,
      // então apagar, colar e digitar no meio convergem para o mesmo resultado.
      const digitos = bruto.replace(/\D/g, "");
      const negativo = allowNegative && bruto.trimStart().startsWith("-");

      if (digitos === "") {
        onChangeCents(0);
        return;
      }

      // 15 dígitos ≈ R$ 9 trilhões: para bem antes do inteiro seguro do double.
      const cents = Number(digitos.slice(0, 15));

      onChangeCents(negativo ? -cents : cents);
    }

    return (
      <div className="relative">
        <span
          aria-hidden
          className="text-text-dim pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm"
        >
          R$
        </span>
        <input
          {...props}
          ref={ref}
          id={id}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          value={formatarParaEdicao(valueCents)}
          onChange={aoDigitar}
          placeholder={placeholder}
          className={cn(
            "border-line bg-surface-2/50 text-text placeholder:text-text-dim",
            "focus-visible:border-brand focus-visible:ring-brand/30 h-11 w-full rounded-md border",
            "py-2 pr-3 pl-10 text-[15px] tabular-nums outline-none focus-visible:ring-2",
            "aria-invalid:border-negative aria-invalid:ring-negative/20",
            "disabled:cursor-not-allowed disabled:opacity-50",
            className,
          )}
        />
      </div>
    );
  },
);
