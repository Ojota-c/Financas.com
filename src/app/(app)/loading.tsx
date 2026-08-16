/**
 * Esqueleto de transição do grupo (app). Sem ele, tocar num item do menu
 * deixa a tela anterior congelada até o servidor responder — no celular isso
 * lê como travamento. Com ele, o App Router troca de rota na hora e o
 * conteúdo real entra por streaming quando chegar.
 */
export default function Loading() {
  return (
    <div className="mx-auto grid max-w-6xl gap-5" aria-busy>
      <div className="grid gap-2">
        <div className="bg-surface-2 h-7 w-40 animate-pulse rounded-md" />
        <div className="bg-surface-2/70 h-4 w-56 animate-pulse rounded-md" />
      </div>

      <div className="bg-surface-1/60 border-line h-40 animate-pulse rounded-xl border" />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="bg-surface-1/60 border-line h-24 animate-pulse rounded-xl border" />
        <div className="bg-surface-1/60 border-line h-24 animate-pulse rounded-xl border" />
        <div className="bg-surface-1/60 border-line hidden h-24 animate-pulse rounded-xl border sm:block" />
        <div className="bg-surface-1/60 border-line hidden h-24 animate-pulse rounded-xl border lg:block" />
      </div>

      <div className="bg-surface-1/60 border-line h-64 animate-pulse rounded-xl border" />

      <span className="sr-only">Carregando…</span>
    </div>
  );
}
