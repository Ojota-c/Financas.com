import { type Cents } from "@/lib/finance";

/**
 * Rótulo compacto de eixo: "4,2 mil" em vez de "R$ 4.200,00" (§7 — eixo sem
 * casas decimais e abreviado).
 *
 * Só aritmética de inteiros, como o formatador de money.ts: resto e divisão
 * exata, nunca `/100` em ponto flutuante solto — é borda de exibição, mas a
 * regra 1 continua valendo dentro dela.
 */
export function reaisCompactos(cents: Cents): string {
  const negativo = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);

  const reais = (abs - (abs % 100)) / 100;

  if (reais >= 1_000_000) {
    const inteiro = (reais - (reais % 1_000_000)) / 1_000_000;
    const decimo = Math.round((reais % 1_000_000) / 100_000);
    return decimo === 0
      ? `${negativo}${inteiro} mi`
      : `${negativo}${inteiro},${decimo} mi`;
  }

  if (reais >= 1_000) {
    const inteiro = (reais - (reais % 1_000)) / 1_000;
    const decimo = Math.round((reais % 1_000) / 100);
    return decimo === 0
      ? `${negativo}${inteiro} mil`
      : `${negativo}${inteiro},${decimo} mil`;
  }

  return `${negativo}${reais}`;
}

const MESES_CURTOS = [
  "jan",
  "fev",
  "mar",
  "abr",
  "mai",
  "jun",
  "jul",
  "ago",
  "set",
  "out",
  "nov",
  "dez",
] as const;

/** "ago" a partir de "2026-08" ou "2026-08-01". */
export function mesCurto(anoMes: string): string {
  const mes = Number(anoMes.slice(5, 7));
  return MESES_CURTOS[mes - 1] ?? anoMes;
}
