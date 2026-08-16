import type { NextConfig } from "next";

import { lanIPs } from "./src/lib/utils/lan-origins";

const nextConfig: NextConfig = {
  // Build quebra em erro de tipo — nunca ignorar (regra inviolável 6).
  // O Next 16 não roda mais ESLint no build; quem barra é o hook de pre-commit
  // e o `pnpm lint` no CI.
  typescript: { ignoreBuildErrors: false },
  reactStrictMode: true,

  // Abrir o app pelo celular na rede local (http://IP:3000) é requisito de
  // dev — sem isto o Next barra os assets como requisição cross-origin.
  allowedDevOrigins: lanIPs(),
};

// O service worker NÃO passa por aqui de propósito: o plugin webpack do
// @serwist/next não funciona no Turbopack do Next 16. O sw.js nasce num passo
// próprio do build — `serwist build`, configurado em serwist.config.mjs.
export default nextConfig;
