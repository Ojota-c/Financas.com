import { formatInTimeZone } from "date-fns-tz";

/**
 * Data civil brasileira, sempre.
 *
 * O servidor pode rodar em UTC, e é aí que mora a armadilha: às 22h de 31 de
 * janeiro em São Paulo já é dia 1º de fevereiro em UTC. Um lançamento feito à
 * noite cairia no mês seguinte, e o fechamento do mês mostraria um número que
 * não bate com o extrato.
 *
 * Só `hoje()` consulta o relógio, e ele fixa o fuso em vez de herdar o do
 * processo. As demais funções operam sobre a string `YYYY-MM-DD` como
 * calendário puro — sem `new Date(data)`, que interpretaria a string como UTC e
 * devolveria o dia anterior no Brasil.
 */

export const FUSO_BR = "America/Sao_Paulo";

export function hoje(): string {
  return formatInTimeZone(new Date(), FUSO_BR, "yyyy-MM-dd");
}

function partes(data: string): [number, number, number] {
  const [ano, mes, dia] = data.split("-").map(Number);

  return [ano!, mes!, dia!];
}

/** Primeiro dia do mês — é o `period` dos orçamentos. */
export function primeiroDiaDoMes(data: string = hoje()): string {
  const [ano, mes] = partes(data);

  return `${ano}-${String(mes).padStart(2, "0")}-01`;
}

export function ultimoDiaDoMes(data: string = hoje()): string {
  const [ano, mes] = partes(data);

  // Dia 0 do mês seguinte é o último do mês atual, e o `Date.UTC` mantém a
  // conta fora de qualquer fuso — aqui é aritmética de calendário, não relógio.
  const ultimo = new Date(Date.UTC(ano, mes, 0)).getUTCDate();

  return `${ano}-${String(mes).padStart(2, "0")}-${String(ultimo).padStart(2, "0")}`;
}

const MESES = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
] as const;

/** "agosto de 2026" — o rótulo do período no dashboard. */
export function rotuloDoMes(data: string = hoje()): string {
  const [ano, mes] = partes(data);

  return `${MESES[mes - 1]} de ${ano}`;
}

/** "12 de ago" — data curta de lista. */
export function dataCurta(data: string): string {
  const [, mes, dia] = partes(data);

  return `${dia} de ${MESES[mes - 1]?.slice(0, 3)}`;
}
