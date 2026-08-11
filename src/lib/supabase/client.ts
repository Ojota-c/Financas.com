import { createBrowserClient } from "@supabase/ssr";

import { publicEnv } from "@/lib/validators/env";

/**
 * Cliente para Client Components. Usa a chave pública (anon/publishable) e o
 * JWT do usuário guardado em cookie — a RLS é quem decide o que ele enxerga.
 */
export function createClient() {
  return createBrowserClient(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}
