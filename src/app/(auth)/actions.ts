"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { absoluteUrl } from "@/lib/utils/site-url";
import {
  AUTH_CALLBACK_ROUTE,
  HOME_ROUTE,
  LOGIN_ROUTE,
  safeNextPath,
} from "@/lib/utils/routes";
import {
  loginSchema,
  signupSchema,
  type LoginInput,
  type SignupInput,
} from "@/lib/validators/auth";

export type AuthResult = { error: string } | { ok: true };

/** Mensagem do Supabase vem em inglês; a borda do app fala português. */
function traduzirErro(message: string): string {
  const map: Record<string, string> = {
    "Invalid login credentials": "E-mail ou senha incorretos.",
    "Email not confirmed":
      "Confirme seu e-mail antes de entrar. Procure a mensagem na caixa de entrada.",
    "User already registered": "Já existe uma conta com este e-mail.",
    "Email rate limit exceeded":
      "Muitas tentativas em pouco tempo. Aguarde alguns minutos.",
    "For security purposes, you can only request this after 60 seconds.":
      "Aguarde um minuto antes de tentar de novo.",
  };

  return map[message] ?? "Não foi possível concluir. Tente novamente.";
}

export async function signInWithPassword(
  values: LoginInput,
  next?: string,
): Promise<AuthResult> {
  const parsed = loginSchema.safeParse(values);
  if (!parsed.success) return { error: "Dados inválidos." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) return { error: traduzirErro(error.message) };

  redirect(safeNextPath(next) ?? HOME_ROUTE);
}

export async function signUpWithPassword(
  values: SignupInput,
  next?: string,
): Promise<AuthResult> {
  const parsed = signupSchema.safeParse(values);
  if (!parsed.success) return { error: "Dados inválidos." };

  const supabase = await createClient();

  // O destino pós-confirmação viaja na URL, nunca em sessionStorage: o link do
  // e-mail pode ser aberto em outro aparelho, onde esse storage não existe.
  const destino = safeNextPath(next);
  const callback = destino
    ? `${AUTH_CALLBACK_ROUTE}?next=${encodeURIComponent(destino)}`
    : AUTH_CALLBACK_ROUTE;

  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: absoluteUrl(callback),
      data: { full_name: parsed.data.fullName },
    },
  });

  if (error) return { error: traduzirErro(error.message) };

  return { ok: true };
}

export async function signInWithGoogle(next?: string): Promise<AuthResult> {
  const supabase = await createClient();

  const destino = safeNextPath(next);
  const callback = destino
    ? `${AUTH_CALLBACK_ROUTE}?next=${encodeURIComponent(destino)}`
    : AUTH_CALLBACK_ROUTE;

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: absoluteUrl(callback) },
  });

  if (error || !data.url) {
    return { error: "Não foi possível abrir o login do Google." };
  }

  redirect(data.url);
}

export async function signOut(): Promise<never> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect(LOGIN_ROUTE);
}
