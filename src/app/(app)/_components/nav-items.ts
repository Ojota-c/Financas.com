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

import { APP_ROUTES, type AppRoute } from "@/lib/utils/routes";

/**
 * O menu, em um lugar só: a sidebar do desktop e a barra inferior do mobile
 * leem daqui. Duas listas separadas divergiriam na primeira tela nova — foi
 * exatamente o que aconteceu quando /contas passou a existir e continuou
 * marcada como "em breve" no menu.
 */
export type NavItem = {
  href: AppRoute;
  label: string;
  /** Rótulo curto da barra inferior, onde não cabe "Configurações". */
  short: string;
  icon: LucideIcon;
  /** Fase que entrega a tela. Enquanto não existe, o item não navega. */
  disponivel: boolean;
};

const TODOS: NavItem[] = [
  {
    href: "/dashboard",
    label: "Dashboard",
    short: "Início",
    icon: LayoutDashboard,
    disponivel: true,
  },
  {
    href: "/transacoes",
    label: "Transações",
    short: "Extrato",
    icon: ArrowLeftRight,
    disponivel: true,
  },
  {
    href: "/contas",
    label: "Contas",
    short: "Contas",
    icon: Wallet,
    disponivel: true,
  },
  {
    href: "/orcamento",
    label: "Orçamento",
    short: "Orçam.",
    icon: PiggyBank,
    disponivel: true,
  },
  {
    href: "/metas",
    label: "Metas",
    short: "Metas",
    icon: Target,
    disponivel: true,
  },
  {
    href: "/relatorios",
    label: "Relatórios",
    short: "Relat.",
    icon: ChartPie,
    disponivel: true,
  },
  {
    href: "/config",
    label: "Configurações",
    short: "Config",
    icon: Settings,
    disponivel: true,
  },
];

// Trava de sanidade: item de menu sem rota declarada em routes.ts vira link morto.
const rotasConhecidas = new Set<string>(APP_ROUTES);

export const NAV = TODOS.filter((item) => rotasConhecidas.has(item.href));

/**
 * Os quatro da barra inferior, dois de cada lado do botão de lançar. Cinco
 * alvos numa faixa de 360px deixariam cada um abaixo dos 44px que a §7 exige.
 */
export const NAV_MOBILE = NAV.filter((item) =>
  ["/dashboard", "/transacoes", "/contas", "/orcamento"].includes(item.href),
);

export function rotaAtiva(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
