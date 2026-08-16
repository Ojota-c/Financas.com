"use client";

import { useEffect, useRef, useState } from "react";

import { formatCents, type Cents } from "@/lib/finance";

/**
 * Número que conta até o valor ao aparecer (§7: count-up ao mudar). A conta é
 * feita em centavos INTEIROS a cada quadro — o float só existe no easing do
 * tempo, nunca no dinheiro. Com prefers-reduced-motion o valor simplesmente
 * aparece.
 */
export function MoneyCountUp({
  cents,
  symbol = true,
}: {
  cents: Cents;
  symbol?: boolean;
}) {
  const [atual, setAtual] = useState(0);
  const quadro = useRef<number>(0);

  useEffect(() => {
    const reduzir = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    const duracao = reduzir ? 0 : 700;
    const inicio = performance.now();

    const passo = (agora: number) => {
      const t = duracao === 0 ? 1 : Math.min((agora - inicio) / duracao, 1);
      const suavizado = 1 - (1 - t) ** 3;
      setAtual(Math.round(cents * suavizado));
      if (t < 1) quadro.current = requestAnimationFrame(passo);
    };

    quadro.current = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(quadro.current);
  }, [cents]);

  return <>{formatCents(atual, { symbol })}</>;
}
