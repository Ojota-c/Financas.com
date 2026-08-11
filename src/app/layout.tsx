import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";

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
        {children}
      </body>
    </html>
  );
}
