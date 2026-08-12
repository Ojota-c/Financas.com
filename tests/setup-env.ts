/**
 * Carrega o .env.local antes de qualquer import de teste.
 *
 * O Vitest não lê esse arquivo sozinho, e `@/lib/db/client` valida as variáveis
 * no topo do módulo — sem isto, a suíte morre no import com "variáveis
 * ausentes". `setupFiles` roda antes do módulo de teste ser importado, que é
 * exatamente a janela necessária.
 *
 * No CI as variáveis já vêm do ambiente e o arquivo não existe, daí o try.
 */
try {
  process.loadEnvFile(".env.local");
} catch {
  // ambiente já populado
}
