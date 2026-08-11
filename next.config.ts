import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Build quebra em erro de tipo — nunca ignorar (regra inviolável 6).
  // O Next 16 não roda mais ESLint no build; quem barra é o hook de pre-commit
  // e o `pnpm lint` no CI.
  typescript: { ignoreBuildErrors: false },
  reactStrictMode: true,
};

export default nextConfig;
