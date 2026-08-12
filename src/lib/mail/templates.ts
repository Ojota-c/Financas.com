import "server-only";

import type { Email } from "./send";

/**
 * Cliente de e-mail não resolve variável CSS, então aqui — e só aqui — a cor vai
 * literal. É a exceção consciente à regra 4; o valor é o mesmo `--accent` de
 * globals.css e precisa ser trocado junto se o acento mudar.
 */
const ACCENT = "#22d3ee";

export function emailDeConfirmacao(
  nome: string,
  url: string,
): Omit<Email, "para"> {
  const saudacao = nome.trim() ? `Olá, ${nome.split(" ")[0]}!` : "Olá!";

  return {
    assunto: "Confirme seu e-mail · Aurum",
    texto:
      `${saudacao}\n\n` +
      `Confirme seu e-mail para ativar sua conta no Aurum:\n${url}\n\n` +
      `O link vale por 24 horas. Se não foi você que se cadastrou, ignore esta mensagem.`,
    html: `<!doctype html>
<html lang="pt-BR"><body style="font-family:system-ui,-apple-system,sans-serif;line-height:1.6;padding:24px">
  <p>${saudacao}</p>
  <p>Confirme seu e-mail para ativar sua conta no Aurum.</p>
  <p><a href="${url}" style="display:inline-block;padding:12px 20px;border-radius:12px;background:${ACCENT};color:#08090d;text-decoration:none;font-weight:600">Confirmar e-mail</a></p>
  <p style="font-size:14px;color:#666">Ou copie este endereço no navegador:<br>${url}</p>
  <p style="font-size:14px;color:#666">O link vale por 24 horas. Se não foi você que se cadastrou, ignore esta mensagem.</p>
</body></html>`,
  };
}
