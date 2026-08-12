/**
 * Substitui o pacote `server-only` durante os testes.
 *
 * O pacote real lança ao ser importado fora do bundler do Next, e módulos como
 * `@/lib/db/client` o importam de propósito — é a trava que impede credencial
 * de vazar para o bundle do cliente. Num teste de node, essa trava não tem o
 * que proteger e só atrapalha.
 *
 * Ligado em vitest.config.ts, via resolve.alias.
 */
export {};
