import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { publicEnv } from "@/lib/validators/env";

/**
 * Cliente para Server Components, Route Handlers e Server Actions.
 * Sempre com a chave pública e o JWT do usuário: nunca `service_role` —
 * `service_role` ignora a RLS e só existe em cron e trigger de signup.
 *
 * Precisa ser criado por requisição; não dá pra guardar em módulo.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Server Component não pode escrever cookie. Sem problema: o
            // proxy já renovou a sessão antes desta renderização.
          }
        },
      },
    },
  );
}
