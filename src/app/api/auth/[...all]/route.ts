import { toNextJsHandler } from "better-auth/next-js";

import { auth } from "@/lib/auth/server";

// Todo o fluxo de autenticação passa por aqui: /api/auth/sign-in/*,
// /api/auth/callback/google, /api/auth/verify-email, /api/auth/sign-out…
// É o que substitui os endpoints que antes moravam no domínio do Supabase.
export const { GET, POST } = toNextJsHandler(auth);
