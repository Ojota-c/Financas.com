import { getCookieCache } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

import {
  HOME_ROUTE,
  LOGIN_ROUTE,
  SIGNUP_ROUTE,
  isAppRoute,
} from "@/lib/utils/routes";

/**
 * Decide quem entra onde, antes da rota renderizar.
 *
 * Com o Supabase isto também renovava o token a cada request. O Better Auth não
 * precisa: a sessão é um cookie assinado com validade própria, renovado pelo
 * `updateAge` no servidor. Some toda a dança de reconstruir a resposta para não
 * perder cookie de refresh.
 *
 * `getCookieCache` verifica a ASSINATURA do cookie de sessão localmente, sem ir
 * ao banco — mesmo perfil de latência do getClaims() de antes, e sem confiar em
 * dado cru do cliente. Mas continua sendo uma checagem OTIMISTA: o cookie pode
 * ter sido revogado no servidor e ainda estar dentro dos 5 minutos de cache.
 *
 * A doc do Next 16 é explícita: "Proxy is not intended... as a full session
 * management or authorization solution". Por isso a tranca real vive no layout
 * do grupo (app), que consulta o banco. Esta aqui existe para o redirect ser
 * instantâneo e para ninguém ver o esqueleto de uma tela que não vai poder usar.
 */
export async function updateSession(request: NextRequest) {
  const sessao = await getCookieCache(request);
  const autenticado = Boolean(sessao);

  const { pathname, search } = request.nextUrl;

  if (!autenticado && isAppRoute(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = LOGIN_ROUTE;
    url.search = "";
    url.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(url);
  }

  if (autenticado && (pathname === LOGIN_ROUTE || pathname === SIGNUP_ROUTE)) {
    const url = request.nextUrl.clone();
    url.pathname = HOME_ROUTE;
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}
