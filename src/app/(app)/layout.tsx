import { LogOut } from "lucide-react";

import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { requireSessionContext } from "@/lib/auth/session";
import { listarContas } from "@/lib/db/queries/accounts";
import { listarCategoriasEmArvore } from "@/lib/db/queries/categories";
import { signOut } from "../(auth)/actions";
import { BottomNav } from "./_components/bottom-nav";
import { SidebarNav } from "./_components/sidebar-nav";
import { NovoLancamentoSheet } from "./transacoes/_components/novo-lancamento-sheet";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  // Esta é a tranca REAL: consulta o banco e enxerga revogação na hora. O proxy
  // só faz a checagem otimista pelo cookie assinado, que pode estar até 5
  // minutos desatualizado — e a doc do Next desaconselha usá-lo como
  // autorização de fato.
  //
  // O `cache()` de getSessionContext faz esta chamada e a das páginas filhas
  // virarem uma consulta só por request.
  const { email, name, userId, workspaceId, workspaces } =
    await requireSessionContext();

  const nome = name.trim() || (email.split("@")[0] ?? email);
  const workspaceAtivo = workspaces.find((ws) => ws.id === workspaceId);

  // O FAB da barra inferior abre o mesmo bottom sheet da página de transações,
  // e ele precisa de contas e categorias montadas no servidor. As duas consultas
  // são as mesmas que as páginas filhas já fazem — o `cache()` do React
  // deduplica dentro do request.
  const [contas, categorias] = await Promise.all([
    listarContas({ userId, workspaceId }),
    listarCategoriasEmArvore({ userId, workspaceId }),
  ]);

  return (
    <div className="flex min-h-dvh">
      <aside className="border-line bg-surface-1/40 hidden w-60 shrink-0 flex-col border-r p-4 lg:flex">
        <div className="px-2 py-2">
          <Logo />
        </div>

        {/* Enquanto só existe o espaço pessoal, o switcher seria um menu de um
            item só. Vira seletor de verdade na fase 4, junto do convite. */}
        <div className="border-line bg-surface-2/50 text-text-mid mt-4 truncate rounded-md border px-3 py-2 text-xs">
          {workspaceAtivo?.name ?? "Espaço pessoal"}
        </div>

        <div className="mt-6 flex-1">
          <SidebarNav />
        </div>

        <div className="border-line grid gap-2 border-t pt-4">
          <div className="px-3">
            <p className="truncate text-sm font-medium">{nome}</p>
            <p className="text-text-dim truncate text-xs">{email}</p>
          </div>
          <form action={signOut}>
            <Button
              type="submit"
              variant="ghost"
              size="sm"
              className="text-text-mid hover:text-text w-full justify-start gap-3 px-3"
            >
              <LogOut className="size-4" aria-hidden />
              Sair
            </Button>
          </form>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="border-line bg-bg/80 sticky top-0 z-10 flex items-center justify-between border-b px-5 py-3 backdrop-blur lg:hidden">
          <Logo />
          <form action={signOut}>
            <Button
              type="submit"
              variant="ghost"
              size="icon"
              aria-label="Sair"
              className="text-text-mid"
            >
              <LogOut className="size-4" aria-hidden />
            </Button>
          </form>
        </header>

        {/* pb-24 no mobile para o último item da lista não ficar embaixo da
            barra fixa. */}
        <main className="min-w-0 flex-1 p-5 pb-24 sm:p-8 lg:pb-8">
          {children}
        </main>
      </div>

      <BottomNav>
        <NovoLancamentoSheet
          contas={contas}
          categorias={categorias}
          variante="fab"
        />
      </BottomNav>
    </div>
  );
}
