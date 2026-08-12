"use server";

import { APIError } from "better-auth/api";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth/server";
import { HOME_ROUTE, LOGIN_ROUTE, safeNextPath } from "@/lib/utils/routes";
import {
  loginSchema,
  signupSchema,
  type LoginInput,
  type SignupInput,
} from "@/lib/validators/auth";

export type AuthResult = { error: string } | { ok: true };

/**
 * O Better Auth erra com CÓDIGO, não com frase.
 *
 * Com o GoTrue este mapa comparava texto em inglês — `"Invalid login
 * credentials"` — e uma reescrita de mensagem no upstream teria degradado tudo
 * para o erro genérico sem quebrar nenhum teste. As chaves abaixo são as de
 * `auth.$ERROR_CODES` e fazem parte do contrato público da biblioteca.
 */
const MENSAGENS: Record<string, string> = {
  INVALID_EMAIL_OR_PASSWORD: "E-mail ou senha incorretos.",
  EMAIL_NOT_VERIFIED:
    "Confirme seu e-mail antes de entrar. Procure a mensagem na caixa de entrada.",
  USER_ALREADY_EXISTS: "Já existe uma conta com este e-mail.",
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: "Já existe uma conta com este e-mail.",
  PASSWORD_TOO_SHORT: "A senha precisa de pelo menos 8 caracteres.",
  PASSWORD_TOO_LONG: "A senha pode ter no máximo 72 caracteres.",
  INVALID_EMAIL: "E-mail inválido.",
  TOKEN_EXPIRED: "Este link expirou. Peça um novo.",
  INVALID_TOKEN: "Link inválido ou já utilizado.",
  PROVIDER_NOT_FOUND:
    "Login com Google não está configurado neste ambiente. Entre com e-mail e senha.",
};

function traduzirErro(erro: unknown): string {
  if (erro instanceof APIError) {
    // O limitador do Better Auth responde 429; não há código específico.
    if (erro.statusCode === 429) {
      return "Muitas tentativas em pouco tempo. Aguarde alguns minutos.";
    }

    const codigo = erro.body?.code;
    if (typeof codigo === "string" && codigo in MENSAGENS) {
      return MENSAGENS[codigo]!;
    }
  }

  return "Não foi possível concluir. Tente novamente.";
}

export async function signInWithPassword(
  values: LoginInput,
  next?: string,
): Promise<AuthResult> {
  const parsed = loginSchema.safeParse(values);
  if (!parsed.success) return { error: "Dados inválidos." };

  try {
    await auth.api.signInEmail({
      body: { email: parsed.data.email, password: parsed.data.password },
      headers: await headers(),
    });
  } catch (erro) {
    return { error: traduzirErro(erro) };
  }

  // Fora do try: redirect() sinaliza por exceção, e capturá-la aqui viraria
  // "não foi possível concluir" logo depois de um login bem-sucedido.
  redirect(safeNextPath(next) ?? HOME_ROUTE);
}

export async function signUpWithPassword(
  values: SignupInput,
  next?: string,
): Promise<AuthResult> {
  const parsed = signupSchema.safeParse(values);
  if (!parsed.success) return { error: "Dados inválidos." };

  // O destino pós-confirmação viaja na URL, nunca em sessionStorage: o link do
  // e-mail pode ser aberto em outro aparelho, onde esse storage não existe.
  const destino = safeNextPath(next) ?? HOME_ROUTE;

  try {
    await auth.api.signUpEmail({
      body: {
        email: parsed.data.email,
        password: parsed.data.password,
        name: parsed.data.fullName,
        callbackURL: destino,
      },
      headers: await headers(),
    });
  } catch (erro) {
    return { error: traduzirErro(erro) };
  }

  // Sem sessão ainda: requireEmailVerification only deixa entrar depois do
  // clique no link. O formulário mostra a tela "confirme seu e-mail".
  return { ok: true };
}

export async function signInWithGoogle(next?: string): Promise<AuthResult> {
  const destino = safeNextPath(next) ?? HOME_ROUTE;

  let url: string | undefined;

  try {
    const resultado = await auth.api.signInSocial({
      body: { provider: "google", callbackURL: destino },
      headers: await headers(),
    });
    url = resultado.url;
  } catch (erro) {
    return { error: traduzirErro(erro) };
  }

  if (!url) return { error: "Não foi possível abrir o login do Google." };

  redirect(url);
}

export async function signOut(): Promise<never> {
  try {
    await auth.api.signOut({ headers: await headers() });
  } catch {
    // Sessão já inválida ou expirada: o destino é o mesmo, a tela de login.
  }

  redirect(LOGIN_ROUTE);
}
