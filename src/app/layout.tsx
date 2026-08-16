import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { SerwistProvider } from "@serwist/next/react";

import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: "Aurum", template: "%s · Aurum" },
  description:
    "Controle de gastos, contas, orçamento e metas — com projeção, score de saúde financeira e espaço compartilhado.",
  applicationName: "Aurum",
  // iOS ignora o manifest para o ícone da tela inicial; o apple-touch-icon é
  // o único caminho que ele respeita.
  icons: {
    icon: [{ url: "/icons/icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/icons/icon-180.png", sizes: "180x180" }],
  },
  appleWebApp: {
    capable: true,
    title: "Aurum",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  themeColor: "#08090D",
  // Área segura do notch (§7): o bottom tab bar da fase 5 depende disso.
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      className={`dark ${geistSans.variable} ${geistMono.variable} h-full`}
    >
      <body className="bg-bg text-text flex min-h-full flex-col antialiased">
        {/* O sw.js só existe depois do `serwist build` (produção). Registrar em
            dev seria um 404 no console a cada reload. */}
        {process.env.NODE_ENV === "production" ? (
          <SerwistProvider swUrl="/sw.js">{children}</SerwistProvider>
        ) : (
          children
        )}
      </body>
    </html>
  );
}
