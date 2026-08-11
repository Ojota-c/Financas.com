"use client";

import { useId } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils/cn";

type FieldProps = React.ComponentProps<typeof Input> & {
  label: string;
  error?: string | undefined;
};

/**
 * Campo com rótulo e erro amarrados por id — leitor de tela anuncia o erro
 * junto com o campo, em vez de deixar um texto vermelho solto na tela.
 */
export function Field({ label, error, className, ...props }: FieldProps) {
  const id = useId();
  const errorId = `${id}-erro`;

  return (
    <div className="grid gap-2">
      <Label htmlFor={id} className="text-text-mid text-xs font-medium">
        {label}
      </Label>
      <Input
        id={id}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        className={cn(
          "bg-surface-2/60 h-11 rounded-[var(--r-md)] text-[15px]",
          className,
        )}
        {...props}
      />
      {error && (
        <p id={errorId} className="text-negative text-xs">
          {error}
        </p>
      )}
    </div>
  );
}
