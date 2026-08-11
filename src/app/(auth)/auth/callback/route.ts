import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { HOME_ROUTE, LOGIN_ROUTE, safeNextPath } from "@/lib/utils/routes";

/**
 * Ponto de chegada de tudo que vem de fora com um `code`: retorno do Google e
 * link de confirmação de e-mail. Troca o code pela sessão (PKCE) e devolve o
 * usuário ao destino — que pode ser o /convite/[token] que ele tentou abrir.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const destino = safeNextPath(searchParams.get("next")) ?? HOME_ROUTE;

  // O Supabase devolve o motivo em `error_description` quando o link expirou
  // ou já foi usado.
  const erroExterno = searchParams.get("error_description");
  if (erroExterno) {
    return NextResponse.redirect(
      `${origin}${LOGIN_ROUTE}?erro=${encodeURIComponent(erroExterno)}`,
    );
  }

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${destino}`);
    }
  }

  return NextResponse.redirect(
    `${origin}${LOGIN_ROUTE}?erro=${encodeURIComponent(
      "Link inválido ou expirado. Peça um novo.",
    )}`,
  );
}
