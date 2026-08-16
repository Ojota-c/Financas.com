import type { MetadataRoute } from "next";

/**
 * O manifest como rota tipada do Next em vez de JSON solto em public/ — o
 * compilador confere os campos, e a URL (/manifest.webmanifest) entra no
 * <head> automaticamente via metadata do layout raiz.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Aurum",
    short_name: "Aurum",
    description:
      "Controle de gastos, contas, orçamento e metas — com projeção, score de saúde financeira e espaço compartilhado.",
    id: "/",
    start_url: "/dashboard",
    display: "standalone",
    // As mesmas cores de --bg: a splash e a moldura do PWA são a única
    // superfície que os tokens CSS não alcançam.
    background_color: "#08090d",
    theme_color: "#08090d",
    orientation: "portrait",
    lang: "pt-BR",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
