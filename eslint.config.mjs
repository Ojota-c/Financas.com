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
          paths: [
            {
              name: "@supabase/supabase-js",
              importNames: ["createClient"],
              message:
                "Use @/lib/supabase/client (browser) ou @/lib/supabase/server (server). createClient direto ignora a propagação do JWT e, com service_role, a RLS.",
            },
          ],
        },
      ],
    },
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
            "@supabase/*",
            "@/lib/db/*",
            "@/lib/supabase/*",
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
