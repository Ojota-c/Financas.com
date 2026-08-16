import type { Metadata } from "next";
import Link from "next/link";

import { ArrowLeft, CalendarClock } from "lucide-react";

import { Button } from "@/components/ui/button";
import { requireSessionContext } from "@/lib/auth/session";
import { pendentes } from "@/lib/db/queries/transactions";
import { formatCents, sumCents } from "@/lib/finance";
import { hoje } from "@/lib/utils/dates";
import { classificarVencimento, type Semaforo } from "@/lib/utils/vencimento";

import { LinhaPendente } from "./_components/linha-pendente";

export const metadata: Metadata = { title: "Contas a pagar" };

const TITULO_DO_GRUPO: Record<Semaforo, string> = {
  vencido: "Vencidas",
  em_breve: "Vencem em até 3 dias",
  futuro: "Mais adiante",
};

const ORDEM: Semaforo[] = ["vencido", "em_breve", "futuro"];

export default async function ContasAPagarPage() {
  const contexto = await requireSessionContext();

  // Sem paginação de propósito: contas a pagar em aberto se contam em dezenas.
  // Se um dia forem centenas, o problema é outro.
  const lista = await pendentes(contexto, 500);
  const dataDeHoje = hoje();

  const grupos = new Map<Semaforo, typeof lista>(ORDEM.map((s) => [s, []]));

  for (const lancamento of lista) {
    grupos
      .get(classificarVencimento(lancamento.dueDate, dataDeHoje))!
      .push(lancamento);
  }

  const totalCents = sumCents(lista.map((l) => l.amountCents));

  return (
    <div className="mx-auto grid max-w-5xl gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="text-text-mid mb-1 -ml-2 h-7 gap-1 px-2"
          >
            <Link href="/transacoes">
              <ArrowLeft className="size-3.5" aria-hidden />
              Extrato
            </Link>
          </Button>
          <h1 className="text-2xl font-semibold tracking-[-0.02em]">
            Contas a pagar
          </h1>
          <p className="text-text-mid mt-1 text-sm">
            {lista.length === 0
              ? "Nada em aberto"
              : `${lista.length} em aberto · ${formatCents(totalCents)}`}
          </p>
        </div>
      </div>

      {lista.length === 0 ? (
        <section className="glass grid place-items-center gap-3 rounded-xl px-6 py-16 text-center">
          <CalendarClock className="text-positive size-6" aria-hidden />
          <p className="text-base font-medium">Tudo em dia</p>
          <p className="text-text-mid max-w-sm text-sm">
            Nenhuma conta pendente. Ao lançar uma despesa, marque &ldquo;ainda
            não paguei&rdquo; e ela aparece aqui com o vencimento.
          </p>
        </section>
      ) : (
        ORDEM.map((semaforo) => {
          const doGrupo = grupos.get(semaforo)!;
          if (doGrupo.length === 0) return null;

          return (
            <section key={semaforo} className="grid gap-2">
              <h2 className="text-text-mid text-xs font-medium tracking-wide uppercase">
                {TITULO_DO_GRUPO[semaforo]}
              </h2>
              <div className="bg-surface-1/60 border-line rounded-xl border px-4 py-1">
                <ul>
                  {doGrupo.map((lancamento) => (
                    <LinhaPendente
                      key={lancamento.id}
                      lancamento={lancamento}
                      semaforo={semaforo}
                      hoje={dataDeHoje}
                    />
                  ))}
                </ul>
              </div>
            </section>
          );
        })
      )}
    </div>
  );
}
