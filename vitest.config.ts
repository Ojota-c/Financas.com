import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // O Vite 7 resolve os paths do tsconfig sem plugin.
    tsconfigPaths: true,

    /**
     * `server-only` lança por padrão e só vira stub vazio sob a condição de
     * exportação `react-server`. Ligar essa condição no resolvedor resolveria
     * — e quebraria o `pg`, que é CommonJS: a lista de condições afeta a
     * família inteira e o driver passa a chegar como namespace ESM, com o
     * erro "Class extends value [object Module]".
     *
     * O alias é cirúrgico: atinge só este pacote e deixa o resto do
     * resolvedor em paz.
     */
    alias: { "server-only": "tests/stubs/server-only.ts" },
  },

  test: {
    environment: "node",
    setupFiles: ["tests/setup-env.ts"],
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: ["tests/unit/**/*.test.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "rls",
          include: ["tests/rls/**/*.test.ts"],
          // Isolamento se testa em série: os casos dividem o mesmo banco e
          // contam linhas.
          fileParallelism: false,
          testTimeout: 30_000,
        },
      },
    ],
    coverage: {
      provider: "v8",
      // Regra inviolável 5: o motor financeiro é puro e tem cobertura total.
      // Ainda não existe arquivo em finance/ — o limiar já fica armado para a
      // fase 3, e só é avaliado com `pnpm test:coverage`.
      include: ["src/lib/finance/**/*.ts"],
      thresholds: {
        lines: 100,
        functions: 100,
        branches: 100,
        statements: 100,
      },
    },
  },
});
