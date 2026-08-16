/**
 * O semáforo de contas a pagar (§5.1): vencido · vence em ≤3 dias · futuro.
 *
 * Vive em utils e não em lib/finance porque não é cálculo de dinheiro — é
 * comparação de calendário para decidir cor e ordem de exibição. As datas são
 * strings `YYYY-MM-DD`, que comparam corretamente como texto, então nada aqui
 * toca `Date`.
 */

export type Semaforo = "vencido" | "em_breve" | "futuro";

const DIAS_DO_ALERTA = 3;

/** Soma dias a uma data civil sem passar por fuso — aritmética de calendário. */
export function somarDias(data: string, dias: number): string {
  const [ano, mes, dia] = data.split("-").map(Number);
  const somada = new Date(Date.UTC(ano!, mes! - 1, dia! + dias));

  const mm = String(somada.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(somada.getUTCDate()).padStart(2, "0");

  return `${somada.getUTCFullYear()}-${mm}-${dd}`;
}

export function classificarVencimento(
  dueDate: string | null,
  hoje: string,
): Semaforo {
  // Pendente sem vencimento não deveria existir (CHECK do banco), mas se
  // existir, tratá-lo como vencido o coloca no topo — errar para o lado que
  // grita é melhor que esconder uma conta a pagar.
  if (!dueDate) return "vencido";

  if (dueDate < hoje) return "vencido";
  if (dueDate <= somarDias(hoje, DIAS_DO_ALERTA)) return "em_breve";

  return "futuro";
}

/** "vence hoje" · "venceu há 3 dias" · "vence em 12 dias" */
export function rotuloDoVencimento(
  dueDate: string | null,
  hoje: string,
): string {
  if (!dueDate) return "sem vencimento";
  if (dueDate === hoje) return "vence hoje";

  const dias = diferencaEmDias(hoje, dueDate);

  if (dias < 0) {
    const n = -dias;
    return n === 1 ? "venceu ontem" : `venceu há ${n} dias`;
  }

  return dias === 1 ? "vence amanhã" : `vence em ${dias} dias`;
}

function diferencaEmDias(de: string, ate: string): number {
  const [a1, m1, d1] = de.split("-").map(Number);
  const [a2, m2, d2] = ate.split("-").map(Number);

  const t1 = Date.UTC(a1!, m1! - 1, d1!);
  const t2 = Date.UTC(a2!, m2! - 1, d2!);

  return Math.round((t2 - t1) / 86_400_000);
}
