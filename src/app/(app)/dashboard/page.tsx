import type { Metadata } from "next";
import Link from "next/link";

import { ArrowDownRight, ArrowUpRight, Sparkles, Wallet } from "lucide-react";

import { Button } from "@/components/ui/button";
import { requireSessionContext } from "@/lib/auth/session";
import { listarContas } from "@/lib/db/queries/accounts";
import {
  listarLancamentos,
  resumoDoPeriodo,
} from "@/lib/db/queries/transactions";
import { formatCents } from "@/lib/finance";
import {
  dataCurta,
  primeiroDiaDoMes,
  rotuloDoMes,
  ultimoDiaDoMes,
} from "@/lib/utils/dates";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const contexto = await requireSessionContext();

  const de = primeiroDiaDoMes();
  const ate = ultimoDiaDoMes();

  // Uma consulta de sessão por request (o `cache` do React), três de dados.
  const [contas, resumo, ultimos] = await Promise.all([
    listarContas(contexto),
    resumoDoPeriodo(contexto, de, ate),
    listarLancamentos(contexto, { limite: 8 }),
  ]);

  const saldo = contas.reduce((soma, conta) => soma + conta.balanceCents, 0);

  if (contas.length === 0) {
    return (
      <div className="mx-auto grid max-w-5xl gap-6">
        <Cabecalho />
        <section className="glass grid place-items-center gap-3 rounded-xl px-6 py-16 text-center">
          <Wallet className="text-brand size-6" aria-hidden />
          <p className="text-base font-medium">Comece pela sua conta</p>
          <p className="text-text-mid max-w-sm text-sm">
            O dashboard vive do extrato. Cadastre a conta onde você recebe e os
            números aparecem aqui.
          </p>
          <Button asChild className="mt-2">
            <Link href="/contas">Cadastrar conta</Link>
          </Button>
        </section>
      </div>
    );
  }

  return (
    <div className="mx-auto grid max-w-5xl gap-6">
      <Cabecalho />

      <section className="glass rounded-xl px-6 py-6">
        <p className="text-text-mid text-xs tracking-wide uppercase">
          Saldo consolidado
        </p>
        <p
          className={`mt-1 text-4xl font-semibold tabular-nums ${
            saldo < 0 ? "text-negative" : ""
          }`}
        >
          {formatCents(saldo)}
        </p>
        <p className="text-text-dim mt-2 text-xs">
          {contas.length} {contas.length === 1 ? "conta" : "contas"} ativa
          {contas.length === 1 ? "" : "s"}
        </p>
      </section>

      <div className="grid gap-3 sm:grid-cols-2">
        <Cartao
          rotulo="Receita do mês"
          valor={resumo.incomeCents}
          tom="positive"
        />
        <Cartao
          rotulo="Despesa do mês"
          valor={resumo.expenseCents}
          tom="negative"
        />
      </div>

      <section className="glass rounded-xl px-6 py-5">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-sm font-medium">Últimos lançamentos</h2>
          <Button asChild variant="ghost" size="sm" className="text-text-mid">
            <Link href="/transacoes">Ver todos</Link>
          </Button>
        </div>

        {ultimos.length === 0 ? (
          <div className="grid place-items-center gap-2 py-10 text-center">
            <Sparkles className="text-brand size-5" aria-hidden />
            <p className="text-text-mid text-sm">
              Nenhum lançamento ainda neste espaço.
            </p>
          </div>
        ) : (
          <ul className="mt-4 grid gap-1">
            {ultimos.map((lancamento) => {
              const saida =
                lancamento.type === "expense" || lancamento.direction === "out";

              return (
                <li
                  key={lancamento.id}
                  className="flex items-center justify-between gap-4 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {lancamento.description}
                    </p>
                    <p className="text-text-dim truncate text-xs">
                      {dataCurta(lancamento.date)} ·{" "}
                      {lancamento.categoryName ?? "Transferência"} ·{" "}
                      {lancamento.accountName}
                    </p>
                  </div>

                  <p
                    className={`shrink-0 text-sm font-medium tabular-nums ${
                      lancamento.type === "income"
                        ? "text-positive"
                        : saida
                          ? "text-text"
                          : "text-text-mid"
                    }`}
                  >
                    {saida ? "−" : "+"}
                    {formatCents(lancamento.amountCents, { symbol: false })}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function Cabecalho() {
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-[-0.02em]">Dashboard</h1>
      <p className="text-text-mid mt-1 text-sm first-letter:uppercase">
        {rotuloDoMes()}
      </p>
    </div>
  );
}

function Cartao({
  rotulo,
  valor,
  tom,
}: {
  rotulo: string;
  valor: number;
  tom: "positive" | "negative";
}) {
  const Icone = tom === "positive" ? ArrowUpRight : ArrowDownRight;

  return (
    <section className="glass rounded-xl px-5 py-4">
      <div className="flex items-center gap-2">
        <Icone
          className={
            tom === "positive" ? "text-positive size-4" : "text-negative size-4"
          }
          aria-hidden
        />
        <p className="text-text-mid text-xs tracking-wide uppercase">
          {rotulo}
        </p>
      </div>
      <p className="mt-1 text-2xl font-semibold tabular-nums">
        {formatCents(valor)}
      </p>
    </section>
  );
}
