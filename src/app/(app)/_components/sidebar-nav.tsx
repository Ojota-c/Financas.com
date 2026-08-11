"use client";

import {
  ArrowLeftRight,
  ChartPie,
  LayoutDashboard,
  PiggyBank,
  Settings,
  Target,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils/cn";
import { APP_ROUTES, type AppRoute } from "@/lib/utils/routes";

type NavItem = {
  href: AppRoute;
  label: string;
  icon: LucideIcon;
  /** Fase que entrega a tela. Enquanto não existe, o item não navega. */
  disponivel: boolean;
};

const NAV: NavItem[] = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    disponivel: true,
  },
  {
    href: "/transacoes",
    label: "Transações",
    icon: ArrowLeftRight,
    disponivel: false,
  },
  { href: "/contas", label: "Contas", icon: Wallet, disponivel: false },
  {
    href: "/orcamento",
    label: "Orçamento",
    icon: PiggyBank,
    disponivel: false,
  },
  { href: "/metas", label: "Metas", icon: Target, disponivel: false },
  {
    href: "/relatorios",
    label: "Relatórios",
    icon: ChartPie,
    disponivel: false,
  },
  {
    href: "/config",
    label: "Configurações",
    icon: Settings,
    disponivel: false,
  },
];

// Trava de sanidade: item de menu sem rota declarada em routes.ts vira link morto.
const rotasConhecidas = new Set<string>(APP_ROUTES);

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Navegação principal" className="grid gap-0.5">
      {NAV.filter((item) => rotasConhecidas.has(item.href)).map((item) => {
        const Icon = item.icon;
        const ativo =
          pathname === item.href || pathname.startsWith(`${item.href}/`);

        const classes = cn(
          "flex items-center gap-3 rounded-[var(--r-md)] px-3 py-2 text-sm transition-colors duration-[var(--dur-fast)]",
          ativo
            ? "bg-surface-2 text-text"
            : "text-text-mid hover:bg-surface-2/60 hover:text-text",
        );

        if (!item.disponivel) {
          return (
            <span
              key={item.href}
              aria-disabled
              className={cn(
                classes,
                "text-text-dim hover:text-text-dim cursor-not-allowed hover:bg-transparent",
              )}
            >
              <Icon className="size-4 shrink-0" aria-hidden />
              <span className="flex-1">{item.label}</span>
              <span className="border-line text-text-dim rounded-full border px-1.5 py-px text-[10px]">
                em breve
              </span>
            </span>
          );
        }

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={ativo ? "page" : undefined}
            className={classes}
          >
            <Icon
              className={cn("size-4 shrink-0", ativo && "text-brand")}
              aria-hidden
            />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
