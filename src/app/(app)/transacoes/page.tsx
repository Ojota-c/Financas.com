import type { Metadata } from "next";
import Link from "next/link";

import { ArrowLeftRight, CalendarClock, Repeat, Wallet } from "lucide-react";

import { Button } from "@/components/ui/button";
import { requireSessionContext } from "@/lib/auth/session";
import { listarContas } from "@/lib/db/queries/accounts";
import { listarCategoriasEmArvore } from "@/lib/db/queries/categories";
import {
  contarLancamentos,
  listarLancamentos,
  type FiltroDeLancamentos,
} from "@/lib/db/queries/transactions";

import { Filtros } from "./_components/filtros";
import { LinhaLancamento } from "./_components/linha-lancamento";
import { NovoLancamentoSheet } from "./_components/novo-lancamento-sheet";

export const metadata: Metadata = { title: "Transações" };

const POR_PAGINA = 50;

/** Só passa adiante o que o filtro conhece — query string é entrada do usuário. */
function lerFiltro(params: Record<string, string | string[] | undefined>) {
  const texto = (chave: string): string | undefined => {
    const valor = params[chave];
    return typeof valor === "string" && valor !== "" ? valor : undefined;
  };

  const tipo = texto("tipo");
  const filtro: FiltroDeLancamentos = {
    busca: texto("busca"),
    de: texto("de"),
    ate: texto("ate"),
    accountId: texto("conta"),
    limite: POR_PAGINA,
  };

  if (tipo === "income" || tipo === "expense" || tipo === "transfer") {
    filtro.type = tipo;
  }

  return filtro;
}

export default async function TransacoesPage({
  searchParams,
}: PageProps<"/transacoes">) {
  const contexto = await requireSessionContext();
  const filtro = lerFiltro(await searchParams);

  const [contas, categorias, lancamentos, total, totalAPagar] =
    await Promise.all([
      listarContas(contexto),
      listarCategoriasEmArvore(contexto),
      listarLancamentos(contexto, filtro),
      contarLancamentos(contexto, filtro),
      contarLancamentos(contexto, { status: "pending" }),
    ]);

  return (
    <div className="mx-auto grid max-w-5xl gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-[-0.02em]">
            Transações
          </h1>
          <p className="text-text-mid mt-1 text-sm">
            {total === 0
              ? "Nenhum lançamento"
              : `${total} ${total === 1 ? "lançamento" : "lançamentos"}`}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            asChild
            variant="outline"
            size="sm"
            className="text-text-mid gap-2"
          >
            <Link href="/transacoes/recorrentes">
              <Repeat className="size-4" aria-hidden />
              Recorrências
            </Link>
          </Button>

          <Button
            asChild
            variant="outline"
            size="sm"
            className="text-text-mid gap-2"
          >
            <Link href="/transacoes/pendentes">
              <CalendarClock className="size-4" aria-hidden />A pagar
              {totalAPagar > 0 && (
                <span className="bg-warning/15 text-warning rounded-full px-1.5 py-px text-[10px] font-semibold tabular-nums">
                  {totalAPagar}
                </span>
              )}
            </Link>
          </Button>

          {contas.length > 0 && (
            <div className="hidden sm:block">
              <NovoLancamentoSheet contas={contas} categorias={categorias} />
            </div>
          )}
        </div>
      </div>

      {contas.length === 0 ? (
        <section className="glass grid place-items-center gap-3 rounded-xl px-6 py-16 text-center">
          <Wallet className="text-brand size-6" aria-hidden />
          <p className="text-base font-medium">Cadastre uma conta primeiro</p>
          <p className="text-text-mid max-w-sm text-sm">
            Todo lançamento sai de uma conta ou entra nela.
          </p>
          <Button asChild className="mt-2">
            <Link href="/contas">Ir para Contas</Link>
          </Button>
        </section>
      ) : (
        <>
          <Filtros contas={contas} />

          {lancamentos.length === 0 ? (
            <section className="glass grid place-items-center gap-3 rounded-xl px-6 py-16 text-center">
              <ArrowLeftRight className="text-brand size-6" aria-hidden />
              <p className="text-base font-medium">Nada por aqui</p>
              <p className="text-text-mid max-w-sm text-sm">
                Nenhum lançamento corresponde a estes filtros.
              </p>
            </section>
          ) : (
            <section className="bg-surface-1/60 border-line rounded-xl border px-5 py-2">
              <ul>
                {lancamentos.map((lancamento) => (
                  <LinhaLancamento
                    key={lancamento.id}
                    lancamento={lancamento}
                  />
                ))}
              </ul>
            </section>
          )}

          {total > lancamentos.length && (
            <p className="text-text-dim text-center text-xs">
              Mostrando os {lancamentos.length} mais recentes de {total}. Refine
              com os filtros acima.
            </p>
          )}
        </>
      )}
    </div>
  );
}
