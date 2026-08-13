"use client";

import { useId } from "react";

import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils/cn";

/**
 * Rótulo, controle e erro amarrados por id — a parte de acessibilidade que se
 * esquece quando cada formulário monta o seu.
 *
 * Recebe `children` como função do id em vez de um `<Input>` fixo: o app tem
 * três controles que não são input de texto (MoneyInput, Select e o seletor de
 * data), e todos precisam do mesmo `aria-describedby` apontando para a mesma
 * mensagem de erro.
 */
export function Field({
  label,
  error,
  hint,
  className,
  children,
}: {
  label: string;
  error?: string | undefined;
  hint?: string;
  className?: string;
  children: (props: {
    id: string;
    "aria-invalid": boolean;
    "aria-describedby": string | undefined;
  }) => React.ReactNode;
}) {
  const id = useId();
  const idErro = `${id}-erro`;
  const idHint = `${id}-hint`;

  const descrito = [error ? idErro : null, hint ? idHint : null]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={cn("grid gap-2", className)}>
      <Label htmlFor={id}>{label}</Label>

      {children({
        id,
        "aria-invalid": Boolean(error),
        "aria-describedby": descrito || undefined,
      })}

      {hint && !error && (
        <p id={idHint} className="text-text-dim text-xs">
          {hint}
        </p>
      )}

      {error && (
        <p id={idErro} role="alert" className="text-negative text-xs">
          {error}
        </p>
      )}
    </div>
  );
}
