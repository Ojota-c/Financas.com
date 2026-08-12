import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  {
    rules: {
      // Regra inviolável 6: `any` é erro de build, não aviso.
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      // console.log vaza dado de usuário em log de produção; warn/error são intencionais.
      "no-console": ["error", { allow: ["warn", "error"] }],
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/lib/db/client"],
              message:
                "Dado de domínio se lê por withUser() (@/lib/db/with-user), que informa ao Postgres de quem é a sessão. Usar dbApp direto roda query sem sujeito: a RLS devolve zero linha e o bug aparece como 'sumiu tudo'. dbAuth é exclusivo do Better Auth e ignora a RLS.",
            },
          ],
        },
      ],
    },
  },

  {
    // O choke point acima não pode valer para quem É o choke point — nem para
    // a suíte que prova que ele funciona: o teste de isolamento precisa dos
    // dois pools lado a lado justamente para comparar o que cada role enxerga.
    files: [
      "src/lib/db/**/*.ts",
      "src/lib/auth/server.ts",
      "tests/rls/**/*.ts",
    ],
    rules: { "no-restricted-imports": "off" },
  },

  {
    // O motor financeiro é puro: sem React, sem banco, sem relógio do sistema.
    files: ["src/lib/finance/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            "react",
            "react-dom",
            "next/*",
            "@/lib/db/*",
            "@/lib/auth/*",
            "better-auth",
            "better-auth/*",
            "drizzle-orm",
            "drizzle-orm/*",
          ],
        },
      ],
      "no-restricted-globals": [
        "error",
        { name: "Date", message: "A data de referência é sempre parâmetro." },
      ],
      "no-restricted-syntax": [
        "error",
        {
          selector: "NewExpression[callee.name='Date']",
          message: "A data de referência é sempre parâmetro.",
        },
        {
          selector:
            "CallExpression[callee.object.name='Date'][callee.property.name='now']",
          message: "A data de referência é sempre parâmetro.",
        },
      ],
    },
  },

  // Prettier por último: desliga as regras de formatação do ESLint.
  prettier,

  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "pnpm-lock.yaml",
  ]),
]);

export default eslintConfig;
