import { LogOut } from "lucide-react";
import { redirect } from "next/navigation";

import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { LOGIN_ROUTE } from "@/lib/utils/routes";
import { signOut } from "../(auth)/actions";
import { SidebarNav } from "./_components/sidebar-nav";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  // O proxy já barra quem não tem sessão; esta checagem é a segunda tranca,
  // para o caso de a rota ser adicionada fora do matcher algum dia.
  if (!data?.claims) redirect(LOGIN_ROUTE);

  const email = typeof data.claims.email === "string" ? data.claims.email : "";
  const metadata = data.claims.user_metadata;
  const nome =
    metadata && typeof metadata.full_name === "string"
      ? metadata.full_name
      : email.split("@")[0];

  return (
    <div className="flex min-h-dvh">
      <aside className="border-line bg-surface-1/40 hidden w-60 shrink-0 flex-col border-r p-4 lg:flex">
        <div className="px-2 py-2">
          <Logo />
        </div>

        {/* Seletor de workspace chega na fase 1, junto da tabela. Até lá o
            usuário só tem o espaço pessoal criado no cadastro. */}
        <div className="border-line bg-surface-2/50 text-text-mid mt-4 rounded-[var(--r-md)] border px-3 py-2 text-xs">
          Espaço pessoal
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

        <main className="min-w-0 flex-1 p-5 sm:p-8">{children}</main>
      </div>
    </div>
  );
}
