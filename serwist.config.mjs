import { serwist } from "@serwist/next/config";

/**
 * Passo externo de build do service worker (`serwist build`, no fim do
 * `pnpm build`). Externo porque o plugin webpack do @serwist/next não roda no
 * Turbopack, que é o bundler do Next 16.
 */
export default serwist({
  swSrc: "src/sw.ts",
  swDest: "public/sw.js",
});
