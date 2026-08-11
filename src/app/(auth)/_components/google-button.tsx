"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { signInWithGoogle } from "../actions";

/** Logo do Google em traço único: cor de marca externa não entra no tema (regra 4). */
function GoogleGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="size-4" fill="currentColor">
      <path d="M12.24 10.29v3.62h5.05a4.32 4.32 0 0 1-1.88 2.84l3.03 2.35c1.77-1.63 2.79-4.04 2.79-6.9 0-.67-.06-1.31-.17-1.91h-8.82Z" />
      <path d="M5.28 14.28a5.9 5.9 0 0 1 0-4.56L2.19 7.34a9.83 9.83 0 0 0 0 9.32l3.09-2.38Z" />
      <path d="M12.24 4.75c1.4 0 2.65.48 3.64 1.42l2.7-2.7A9.6 9.6 0 0 0 12.24 1 9.83 9.83 0 0 0 2.19 7.34l3.09 2.38a5.87 5.87 0 0 1 6.96-4.97Z" />
      <path d="M12.24 23c2.66 0 4.89-.87 6.52-2.38l-3.03-2.35c-.84.57-1.93.9-3.49.9a5.87 5.87 0 0 1-5.52-3.99l-3.09 2.38A9.83 9.83 0 0 0 12.24 23Z" />
    </svg>
  );
}

export function GoogleButton({ next }: { next?: string | undefined }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="grid gap-2">
      <Button
        type="button"
        variant="outline"
        size="lg"
        disabled={isPending}
        className="border-line-strong bg-surface-2/50 hover:bg-surface-2 h-11 w-full rounded-[var(--r-md)] font-medium"
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const result = await signInWithGoogle(next);
            if ("error" in result) setError(result.error);
          });
        }}
      >
        <GoogleGlyph />
        {isPending ? "Abrindo o Google…" : "Continuar com Google"}
      </Button>
      {error && (
        <p role="alert" className="text-negative text-xs">
          {error}
        </p>
      )}
    </div>
  );
}
