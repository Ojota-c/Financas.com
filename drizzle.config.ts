import { defineConfig } from "drizzle-kit";

// O drizzle-kit roda fora do Next, então ninguém carrega o .env.local por ele.
// O Node 22 lê o arquivo sem dependência nenhuma. No CI as variáveis já vêm do
// ambiente e o arquivo não existe — daí o try.
try {
  process.loadEnvFile(".env.local");
} catch {
  // ambiente já populado
}

const url = process.env.DATABASE_URL;

if (!url) {
  throw new Error(
    "DATABASE_URL ausente. Copie .env.example para .env.local e preencha.\n" +
      "O banco sobe com: pnpm db:up",
  );
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/lib/db/schema",
  out: "./db/migrations",
  // Role aurum_auth: é ela que precisa ser dona das tabelas criadas aqui, porque
  // é sobre a propriedade delas que se apoia a separação de privilégio com
  // aurum_app (ver docker/postgres/init/00-roles.sh).
  dbCredentials: { url },
  strict: true,
  verbose: true,
});
