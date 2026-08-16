"use client";

import { useEffect, useRef, useState } from "react";

/**
 * O gauge circular do Score de Saúde (§5.2): anel neon que desenha até o valor
 * e número que conta junto. A animação respeita prefers-reduced-motion — nesse
 * caso o valor simplesmente aparece.
 *
 * Recebe o score PRONTO do motor puro; aqui é só geometria e tinta.
 */
export function ScoreGauge({
  score,
  tamanho = 148,
}: {
  /** 0–100, já calculado por lib/finance/score. */
  score: number;
  tamanho?: number;
}) {
  const [progresso, setProgresso] = useState(0);
  const quadro = useRef<number>(0);

  useEffect(() => {
    const reduzir = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    // Com reduced-motion a duração zera e o primeiro quadro já assenta no
    // valor final — o caminho é um só, sem setState síncrono no efeito.
    const duracao = reduzir ? 0 : 900;
    const inicio = performance.now();

    const passo = (agora: number) => {
      const t = duracao === 0 ? 1 : Math.min((agora - inicio) / duracao, 1);
      // easeOutCubic — desenha rápido e assenta devagar.
      const suavizado = 1 - (1 - t) ** 3;
      setProgresso(Math.round(score * suavizado));
      if (t < 1) quadro.current = requestAnimationFrame(passo);
    };

    quadro.current = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(quadro.current);
  }, [score]);

  const raio = 62;
  const circunferencia = 2 * Math.PI * raio;
  // Arco de 270°, aberto embaixo — o vão é onde mora o rótulo.
  const arco = circunferencia * 0.75;
  const preenchido = (arco * progresso) / 100;

  const tom =
    score >= 70
      ? "var(--positive)"
      : score >= 40
        ? "var(--warning)"
        : "var(--negative)";

  return (
    <div
      className="relative"
      style={{ width: tamanho, height: tamanho }}
      role="meter"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={score}
      aria-label={`Score de saúde financeira: ${score} de 100`}
    >
      <svg viewBox="0 0 148 148" className="size-full -rotate-[225deg]">
        <circle
          cx="74"
          cy="74"
          r={raio}
          fill="none"
          stroke="var(--surface-2)"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={`${arco} ${circunferencia}`}
        />
        <circle
          cx="74"
          cy="74"
          r={raio}
          fill="none"
          stroke={tom}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={`${preenchido} ${circunferencia}`}
          style={{
            filter: `drop-shadow(0 0 8px color-mix(in oklab, ${tom} 45%, transparent))`,
          }}
        />
      </svg>

      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <p className="money text-3xl" data-numeric>
            {progresso}
          </p>
          <p className="text-text-dim text-[10px] tracking-wide uppercase">
            de 100
          </p>
        </div>
      </div>
    </div>
  );
}
