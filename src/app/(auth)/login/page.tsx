import type { Metadata } from "next";
import Link from "next/link";

import { googleHabilitado } from "@/lib/auth/server";
import { SIGNUP_ROUTE, safeNextPath } from "@/lib/utils/routes";
import { AuthCard } from "../_components/auth-card";
import { Divider } from "../_components/divider";
import { GoogleButton } from "../_components/google-button";
import { LoginForm } from "../_components/login-form";

export const metadata: Metadata = { title: "Entrar" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const next = safeNextPath(readParam(params.next)) ?? undefined;
  const erro = readParam(params.erro);

  const signupHref = next
    ? `${SIGNUP_ROUTE}?next=${encodeURIComponent(next)}`
    : SIGNUP_ROUTE;

  return (
    <AuthCard title="Entrar" subtitle="Bem-vindo de volta ao seu Aurum.">
      <div className="grid gap-5">
        {erro && (
          <p
            role="alert"
            className="border-warning/30 bg-warning/10 text-warning rounded-md border px-3 py-2 text-xs"
          >
            {erro}
          </p>
        )}

        {/* Sem credencial do Google configurada o botão não teria como
            funcionar; melhor não existir do que existir quebrado. */}
        {googleHabilitado && (
          <>
            <GoogleButton next={next} />
            <Divider label="ou" />
          </>
        )}
        <LoginForm next={next} />

        <p className="text-text-mid text-center text-sm">
          Não tem conta?{" "}
          <Link
            href={signupHref}
            className="text-brand font-medium hover:underline"
          >
            Criar agora
          </Link>
        </p>
      </div>
    </AuthCard>
  );
}

function readParam(value: string | string[] | undefined): string | null {
  return typeof value === "string" ? value : null;
}
