import "server-only";

import nodemailer from "nodemailer";

import { serverEnv } from "@/lib/validators/server-env";

/**
 * Uma interface de e-mail para os dois ambientes.
 *
 * Em dev, SMTP_URL aponta para o Mailpit do docker-compose e nada sai da
 * máquina — a mensagem aparece em http://localhost:8025. Em produção aponta
 * para o SMTP do Resend. É o mesmo código: só a variável muda.
 */

// O dev server reavalia o módulo a cada hot reload; sem cache, cada alteração
// de arquivo abriria um pool SMTP novo.
const transportCache = globalThis as unknown as {
  __aurumTransport?: nodemailer.Transporter;
};

const transport = (transportCache.__aurumTransport ??=
  nodemailer.createTransport(serverEnv.SMTP_URL));

export type Email = {
  para: string;
  assunto: string;
  texto: string;
  html: string;
};

export async function enviarEmail(email: Email): Promise<void> {
  await transport.sendMail({
    from: serverEnv.MAIL_FROM,
    to: email.para,
    subject: email.assunto,
    text: email.texto,
    html: email.html,
  });
}
