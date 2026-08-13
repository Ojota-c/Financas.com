import type { Metadata } from "next";

import { Landmark, Pencil, Wallet } from "lucide-react";

import { Button } from "@/components/ui/button";
import { requireSessionContext } from "@/lib/auth/session";
import { listarContas } from "@/lib/db/queries/accounts";
import { formatCents } from "@/lib/finance";
import { ROTULO_DO_TIPO_DE_CONTA } from "@/lib/validators/finance";

import { AccountDialog } from "./_components/account-dialog";

export const metadata: Metadata = { title: "Contas" };

export default async function ContasPage() {
  const contexto = await requireSessionContext();
  const contas = await listarContas(contexto);

  const total = contas.reduce((soma, conta) => soma + conta.balanceCents, 0);

  return (
    <div className="mx-auto grid max-w-5xl gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-[-0.02em]">Contas</h1>
          <p className="text-text-mid mt-1 text-sm">
            Onde o seu dinheiro está hoje.
          </p>
        </div>

        <AccountDialog />
      </div>

      {contas.length > 0 && (
        <section className="glass rounded-xl px-6 py-5">
          <p className="text-text-mid text-xs tracking-wide uppercase">
            Saldo consolidado
          </p>
          <p className="mt-1 text-3xl font-semibold tabular-nums">
            {formatCents(total)}
          </p>
        </section>
      )}

      {contas.length === 0 ? (
        <section className="glass grid place-items-center gap-3 rounded-xl px-6 py-16 text-center">
          <Wallet className="text-brand size-6" aria-hidden />
          <p className="text-base font-medium">Nenhuma conta ainda</p>
          <p className="text-text-mid max-w-sm text-sm">
            Cadastre a conta onde você recebe. É dela que o saldo e o dashboard
            passam a viver.
          </p>
          <div className="mt-2">
            <AccountDialog />
          </div>
        </section>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {contas.map((conta) => (
            <li
              key={conta.id}
              className="glass flex items-center justify-between gap-4 rounded-xl px-5 py-4"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Landmark
                    className="text-text-dim size-4 shrink-0"
                    aria-hidden
                  />
                  <p className="truncate font-medium">{conta.name}</p>
                </div>
                <p className="text-text-dim mt-0.5 text-xs">
                  {ROTULO_DO_TIPO_DE_CONTA[
                    conta.type as keyof typeof ROTULO_DO_TIPO_DE_CONTA
                  ] ?? conta.type}
                  {conta.institution ? ` · ${conta.institution}` : ""}
                </p>
              </div>

              <div className="flex items-center gap-3">
                <p
                  className={`text-right font-semibold tabular-nums ${
                    conta.balanceCents < 0 ? "text-negative" : ""
                  }`}
                >
                  {formatCents(conta.balanceCents)}
                </p>

                <AccountDialog conta={conta}>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Editar ${conta.name}`}
                    className="text-text-mid"
                  >
                    <Pencil className="size-4" aria-hidden />
                  </Button>
                </AccountDialog>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
