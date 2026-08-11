import type { Metadata } from "next";
import { Sparkles } from "lucide-react";

export const metadata: Metadata = { title: "Dashboard" };

export default function DashboardPage() {
  return (
    <div className="mx-auto grid max-w-5xl gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-[-0.02em]">Dashboard</h1>
        <p className="text-text-mid mt-1 text-sm">
          Fundação no ar. Os números aparecem quando as contas e os lançamentos
          existirem.
        </p>
      </div>

      <section className="glass grid place-items-center gap-3 rounded-[var(--r-xl)] px-6 py-16 text-center">
        <Sparkles className="text-brand size-6" aria-hidden />
        <p className="text-base font-medium">Nada por aqui ainda</p>
        <p className="text-text-mid max-w-sm text-sm">
          A fase 1 traz contas, categorias e lançamentos — e este espaço vira
          saldo, receita e despesa do mês.
        </p>
      </section>
    </div>
  );
}
