import "server-only";

import { z } from "zod";

/**
 * Variáveis que só existem no servidor. Nunca prefixadas com NEXT_PUBLIC_.
 *
 * O `import "server-only"` acima é a trava real: se algum componente de cliente
 * importar este módulo, o build quebra em vez de vazar credencial no bundle.
 */
const serverEnvSchema = z
  .object({
    // Role aurum_auth: dona das tabelas. Migrations e Better Auth. Ignora a RLS.
    DATABASE_URL: z.string().startsWith("postgres"),
    // Role aurum_app: não é dona de nada. A RLS se aplica. Todo dado de domínio.
    DATABASE_URL_APP: z.string().startsWith("postgres"),

    // Assina o cookie de sessão e o cache de sessão. Trocar este valor derruba
    // todo mundo que está logado. Gere com: openssl rand -base64 32
    BETTER_AUTH_SECRET: z.string().min(32),

    // SMTP. Em dev aponta para o Mailpit do compose; em produção, para o Resend.
    SMTP_URL: z.string().startsWith("smtp"),
    MAIL_FROM: z.string().min(1),

    // Opcionais: sem eles o app sobe e o login por e-mail funciona; só o botão
    // do Google some. Evita travar o `pnpm dev` de quem ainda não criou as
    // credenciais no Google Cloud Console.
    GOOGLE_CLIENT_ID: z.string().optional(),
    GOOGLE_CLIENT_SECRET: z.string().optional(),
  })
  .refine(
    (env) => usuarioDa(env.DATABASE_URL) !== usuarioDa(env.DATABASE_URL_APP),
    {
      path: ["DATABASE_URL_APP"],
      message:
        "aponta para a mesma role de DATABASE_URL. Seriam a mesma conexão, " +
        "a dona das tabelas ignoraria toda policy e a RLS viraria decoração.",
    },
  );

function usuarioDa(connectionString: string): string {
  try {
    return new URL(connectionString).username;
  } catch {
    return "";
  }
}

const parsed = serverEnvSchema.safeParse({
  DATABASE_URL: process.env.DATABASE_URL,
  DATABASE_URL_APP: process.env.DATABASE_URL_APP,
  BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
  SMTP_URL: process.env.SMTP_URL,
  MAIL_FROM: process.env.MAIL_FROM,
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
});

if (!parsed.success) {
  const faltando = parsed.error.issues
    .map((issue) => `  · ${issue.path.join(".")}: ${issue.message}`)
    .join("\n");

  throw new Error(
    `Variáveis de ambiente de servidor inválidas ou ausentes:\n${faltando}\n\n` +
      `Copie .env.example para .env.local e preencha. O banco sobe com: pnpm db:up`,
  );
}

export const serverEnv = parsed.data;
