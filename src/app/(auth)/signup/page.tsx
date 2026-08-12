import type { Metadata } from "next";
import Link from "next/link";

import { googleHabilitado } from "@/lib/auth/server";
import { LOGIN_ROUTE, safeNextPath } from "@/lib/utils/routes";
import { AuthCard } from "../_components/auth-card";
import { Divider } from "../_components/divider";
import { GoogleButton } from "../_components/google-button";
import { SignupForm } from "../_components/signup-form";

export const metadata: Metadata = { title: "Criar conta" };

export default async function SignupPage({
  searchParams,
}: PageProps<"/signup">) {
  const params = await searchParams;
  const next = safeNextPath(readParam(params.next)) ?? undefined;

  const loginHref = next
    ? `${LOGIN_ROUTE}?next=${encodeURIComponent(next)}`
    : LOGIN_ROUTE;

  return (
    <AuthCard
      title="Criar conta"
      subtitle="Leva um minuto. Seu espaço pessoal já vem pronto."
    >
      <div className="grid gap-5">
        {/* Ver login/page.tsx: sem credencial, o botão só teria como falhar. */}
        {googleHabilitado && (
          <>
            <GoogleButton next={next} />
            <Divider label="ou" />
          </>
        )}
        <SignupForm next={next} />

        <p className="text-text-mid text-center text-sm">
          Já tem conta?{" "}
          <Link
            href={loginHref}
            className="text-brand font-medium hover:underline"
          >
            Entrar
          </Link>
        </p>
      </div>
    </AuthCard>
  );
}

function readParam(value: string | string[] | undefined): string | null {
  return typeof value === "string" ? value : null;
}
