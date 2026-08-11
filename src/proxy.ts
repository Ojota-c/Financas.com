import type { NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/middleware";

// No Next 16 o arquivo de middleware chama-se `proxy.ts`; `middleware.ts`
// ainda funciona, mas emite aviso de depreciação no build.
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Tudo, menos:
     * - _next/static, _next/image, favicon
     * - arquivos com extensão (imagens, fontes, manifest)
     * O refresh de token precisa passar em toda navegação; se o matcher for
     * só o grupo (app), a sessão expira em quem ficou parado no /login.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?|json|txt|xml)$).*)",
  ],
};
