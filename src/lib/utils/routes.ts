/**
 * Mapa de rotas em um lugar só. O proxy, a sidebar e os redirects leem daqui —
 * rota nova é uma linha aqui, não uma string espalhada em três arquivos.
 */

/** Grupo (app): exige sessão. */
export const APP_ROUTES = [
  "/dashboard",
  "/transacoes",
  "/contas",
  "/orcamento",
  "/metas",
  "/relatorios",
  "/config",
] as const;

export type AppRoute = (typeof APP_ROUTES)[number];

/** Para onde o usuário autenticado cai. */
export const HOME_ROUTE: AppRoute = "/dashboard";

export const LOGIN_ROUTE = "/login";
export const SIGNUP_ROUTE = "/signup";
export const AUTH_CALLBACK_ROUTE = "/auth/callback";

/** Abertas mesmo sem sessão — o convite precisa ser lido antes do cadastro. */
export const PUBLIC_ROUTES = [
  LOGIN_ROUTE,
  SIGNUP_ROUTE,
  AUTH_CALLBACK_ROUTE,
  "/convite",
] as const;

export function isAppRoute(pathname: string): boolean {
  return APP_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
}

export function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
}

/**
 * Só aceita caminho interno. O `next` viaja na URL do convite e da confirmação
 * de e-mail; sem esta trava, um link montado por terceiro redirecionaria o
 * usuário recém-logado para fora do domínio.
 */
export function safeNextPath(next: string | null | undefined): string | null {
  if (!next) return null;
  if (!next.startsWith("/") || next.startsWith("//")) return null;
  return next;
}
