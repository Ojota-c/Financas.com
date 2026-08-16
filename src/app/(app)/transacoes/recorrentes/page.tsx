import type { Metadata } from "next";
import Link from "next/link";

import { ArrowLeft, Repeat } from "lucide-react";

import { Button } from "@/components/ui/button";
import { requireSessionContext } from "@/lib/auth/session";
import { listarContas } from "@/lib/db/queries/accounts";
import { listarCategoriasEmArvore } from "@/lib/db/queries/categories";
import { listarRegras } from "@/lib/db/queries/recurring";

import { LinhaRegra } from "./_components/linha-regra";
import { NovaRegraSheet } from "./_components/nova-regra-sheet";

export const metadata: Metadata = { title: "Recorrências" };

export default async function RecorrenciasPage() {
  const contexto = await requireSessionContext();

  const [contas, categorias, regras] = await Promise.all([
    listarContas(contexto),
    listarCategoriasEmArvore(contexto),
    listarRegras(contexto),
  ]);

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
            Recorrências
          </h1>
          <p className="text-text-mid mt-1 text-sm">
            Aluguel, salário, assinaturas — o que se repete entra sozinho.
          </p>
        </div>

        {contas.length > 0 && (
          <NovaRegraSheet contas={contas} categorias={categorias} />
        )}
      </div>

      {regras.length === 0 ? (
        <section className="glass grid place-items-center gap-3 rounded-xl px-6 py-16 text-center">
          <Repeat className="text-brand size-6" aria-hidden />
          <p className="text-base font-medium">Nada se repete ainda</p>
          <p className="text-text-mid max-w-sm text-sm">
            Crie uma recorrência e o lançamento aparece todo mês — como conta a
            pagar para confirmar, ou direto no extrato se preferir.
          </p>
        </section>
      ) : (
        <section className="bg-surface-1/60 border-line rounded-xl border px-5 py-2">
          <ul>
            {regras.map((regra) => (
              <LinhaRegra key={regra.id} regra={regra} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
