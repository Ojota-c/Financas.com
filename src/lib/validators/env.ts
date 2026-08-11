import { z } from "zod";

const publicEnvSchema = z.object({
  // Só o host. Copiar a URL da aba Data API traz "/rest/v1/" junto, e aí o
  // supabase-js monta /rest/v1/auth/v1/token — 404 silencioso no login.
  NEXT_PUBLIC_SUPABASE_URL: z
    .url()
    .refine(
      (value) => new URL(value).pathname === "/",
      "não pode ter caminho: use só https://<ref>.supabase.co",
    ),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
});

// As referências precisam ser literais `process.env.NEXT_PUBLIC_X`: é a forma
// textual que o Next substitui por string ao montar o bundle do cliente.
// Ler de um objeto dinâmico devolveria undefined no browser.
const parsed = publicEnvSchema.safeParse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
});

if (!parsed.success) {
  const faltando = parsed.error.issues
    .map((issue) => `  · ${issue.path.join(".")}: ${issue.message}`)
    .join("\n");

  throw new Error(
    `Variáveis de ambiente inválidas ou ausentes:\n${faltando}\n\n` +
      `Copie .env.example para .env.local e preencha. Em produção, ` +
      `configure na Vercel (Settings › Environment Variables).`,
  );
}

export const publicEnv = parsed.data;
