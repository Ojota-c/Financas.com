"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils/cn";

import { NAV_MOBILE, rotaAtiva } from "./nav-items";

/**
 * A navegação do celular, que até agora não existia: abaixo de `lg` a sidebar
 * fica escondida e o usuário não tinha como trocar de tela.
 *
 * Dois itens de cada lado do botão de lançar, como a §7 pede. O FAB fica no
 * centro porque é o alvo mais fácil para o polegar em uma mão — e lançar é a
 * ação que a pessoa repete todo dia.
 *
 * `pb-[env(safe-area-inset-bottom)]` respeita a faixa do notch: sem isso, no
 * iPhone a barra de gestos do sistema cobre metade dos alvos.
 */
export function BottomNav({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const esquerda = NAV_MOBILE.slice(0, 2);
  const direita = NAV_MOBILE.slice(2, 4);

  return (
    <nav
      aria-label="Navegação principal"
      className="border-line bg-bg/90 fixed inset-x-0 bottom-0 z-20 border-t pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
    >
      <div className="mx-auto grid max-w-md grid-cols-5 items-center px-2">
        {esquerda.map((item) => (
          <ItemDaBarra
            key={item.href}
            item={item}
            ativo={rotaAtiva(pathname, item.href)}
          />
        ))}

        <div className="grid place-items-center">
          {/* O gatilho do bottom sheet vem de fora: quem sabe montar o
              formulário é a árvore de servidor, que tem contas e categorias. */}
          {children}
        </div>

        {direita.map((item) => (
          <ItemDaBarra
            key={item.href}
            item={item}
            ativo={rotaAtiva(pathname, item.href)}
          />
        ))}
      </div>
    </nav>
  );
}

function ItemDaBarra({
  item,
  ativo,
}: {
  item: (typeof NAV_MOBILE)[number];
  ativo: boolean;
}) {
  const Icon = item.icon;

  const classes = cn(
    // 44px de alvo mínimo, como a §7 exige.
    "grid min-h-11 place-items-center gap-0.5 rounded-md px-1 py-2 text-[10px]",
    ativo ? "text-brand" : "text-text-dim",
  );

  if (!item.disponivel) {
    return (
      <span aria-disabled className={cn(classes, "opacity-40")}>
        <Icon className="size-5" aria-hidden />
        {item.short}
      </span>
    );
  }

  return (
    <Link
      href={item.href}
      aria-current={ativo ? "page" : undefined}
      className={classes}
    >
      <Icon className="size-5" aria-hidden />
      {item.short}
    </Link>
  );
}
