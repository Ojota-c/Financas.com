import type { NextRequest } from "next/server";

import { updateSession } from "@/lib/auth/proxy";

// No Next 16 o arquivo de middleware chama-se `proxy.ts`; `middleware.ts`
// ainda funciona, mas emite aviso de depreciação no build.
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Tudo, menos:
     * - api/auth — os endpoints do Better Auth. Passar por aqui só gastaria
     *   uma leitura de cookie no caminho do próprio login
     * - _next/static, _next/image, favicon
     * - arquivos com extensão (imagens, fontes, manifest)
     */
    "/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?|json|txt|xml)$).*)",
  ],
};
