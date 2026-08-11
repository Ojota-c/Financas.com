import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import {
  HOME_ROUTE,
  LOGIN_ROUTE,
  SIGNUP_ROUTE,
  isAppRoute,
} from "@/lib/utils/routes";
import { publicEnv } from "@/lib/validators/env";

/**
 * Renova o token a cada request e decide quem entra onde.
 *
 * Duas armadilhas do @supabase/ssr, ambas tratadas abaixo:
 * 1. a resposta devolvida tem que ser a mesma que recebeu os cookies do
 *    refresh — criar uma nova do zero descarta o token renovado e derruba
 *    o usuário aleatoriamente;
 * 2. nada de lógica entre criar o cliente e verificar a sessão.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // getClaims valida a assinatura do JWT (local, com chave assimétrica) em vez
  // de confiar no cookie. Ler o cookie cru seria confiar em dado do cliente.
  const { data } = await supabase.auth.getClaims();
  const isAuthenticated = Boolean(data?.claims);

  const { pathname, search } = request.nextUrl;

  if (!isAuthenticated && isAppRoute(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = LOGIN_ROUTE;
    url.search = "";
    url.searchParams.set("next", `${pathname}${search}`);
    return redirectPreservingCookies(url, response);
  }

  if (
    isAuthenticated &&
    (pathname === LOGIN_ROUTE || pathname === SIGNUP_ROUTE)
  ) {
    const url = request.nextUrl.clone();
    url.pathname = HOME_ROUTE;
    url.search = "";
    return redirectPreservingCookies(url, response);
  }

  return response;
}

function redirectPreservingCookies(url: URL, source: NextResponse) {
  const redirect = NextResponse.redirect(url);
  for (const cookie of source.cookies.getAll()) {
    redirect.cookies.set(cookie);
  }
  return redirect;
}
