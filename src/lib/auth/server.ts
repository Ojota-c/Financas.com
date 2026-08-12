import "server-only";

import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { organization } from "better-auth/plugins";

import { dbAuth } from "@/lib/db/client";
import * as schema from "@/lib/db/schema";
import { enviarEmail } from "@/lib/mail/send";
import { emailDeConfirmacao } from "@/lib/mail/templates";
import { getSiteUrl } from "@/lib/utils/site-url";
import { serverEnv } from "@/lib/validators/server-env";

/**
 * Substitui o GoTrue do Supabase. Roda dentro do próprio Next — sem container
 * de autenticação, sem serviço externo.
 *
 * Conecta por `dbAuth` (role aurum_auth), que é dona das tabelas e portanto
 * ignora a RLS. Isso é obrigatório, não um atalho: durante o login ainda não
 * existe usuário para uma policy avaliar. Todo dado de DOMÍNIO segue por
 * `dbApp` + withUser(), onde a RLS vale.
 */

export const googleHabilitado = Boolean(
  serverEnv.GOOGLE_CLIENT_ID && serverEnv.GOOGLE_CLIENT_SECRET,
);

export const auth = betterAuth({
  baseURL: getSiteUrl(),
  secret: serverEnv.BETTER_AUTH_SECRET,

  database: drizzleAdapter(dbAuth, {
    provider: "pg",
    // Explícito de propósito: o adapter localiza cada tabela pela chave do
    // schema, então renomear um export em schema/auth.ts quebraria a busca em
    // runtime, não no build.
    schema,
    // Cadastro grava em profiles e account; sem transação, uma falha no meio
    // deixaria usuário sem credencial.
    transaction: true,
  }),

  advanced: {
    database: {
      // Mantém tudo em uuid, como o schema do planejamento. O id do convite
      // também é uuid — o Better Auth trata esse gerador como opaco, então o
      // fluxo normal de convite por e-mail continua valendo.
      generateId: "uuid",
    },
  },

  emailAndPassword: {
    enabled: true,
    // Decisão do projeto: cadastro é público, mas confirmação é obrigatória.
    requireEmailVerification: true,
    // Espelha passwordField de @/lib/validators/auth — schema único form ↔ servidor.
    minPasswordLength: 8,
    maxPasswordLength: 72,
  },

  emailVerification: {
    sendOnSignUp: true,
    // Clicar no link já entra, como acontecia com o exchangeCodeForSession.
    autoSignInAfterVerification: true,
    expiresIn: 60 * 60 * 24,
    sendVerificationEmail: async ({ user, url }) => {
      await enviarEmail({
        para: user.email,
        ...emailDeConfirmacao(user.name, url),
      });
    },
  },

  socialProviders: googleHabilitado
    ? {
        google: {
          clientId: serverEnv.GOOGLE_CLIENT_ID ?? "",
          clientSecret: serverEnv.GOOGLE_CLIENT_SECRET ?? "",
        },
      }
    : {},

  session: {
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
    // Sessão assinada em cookie: o proxy valida sem ir ao banco a cada request.
    // É o que preserva a latência que o getClaims() do Supabase tinha.
    cookieCache: { enabled: true, maxAge: 5 * 60 },
  },

  user: {
    // `profiles` e não `users`: o nome vem do planejamento §4.2 e evita de
    // brinde o atrito de `user` ser palavra-chave do SQL.
    modelName: "profiles",
    additionalFields: {
      locale: {
        type: "string",
        required: false,
        defaultValue: "pt-BR",
        input: false,
      },
      currency: {
        type: "string",
        required: false,
        defaultValue: "BRL",
        input: false,
      },
      onboardingDone: {
        type: "boolean",
        required: false,
        defaultValue: false,
        input: false,
      },
    },
  },

  plugins: [
    organization({
      schema: {
        organization: {
          modelName: "workspaces",
          additionalFields: {
            // 'personal' | 'shared'. O CHECK vive na migration (etapa D).
            type: {
              type: "string",
              required: false,
              defaultValue: "personal",
              input: false,
            },
            icon: { type: "string", required: false, input: false },
            color: { type: "string", required: false, input: false },
          },
        },
        member: { modelName: "workspace_members" },
        invitation: { modelName: "workspace_invites" },
      },
      // §4.2: convite expira em 7 dias.
      invitationExpiresIn: 60 * 60 * 24 * 7,
      // Link vazado não vira acesso: aceitar exige sessão com e-mail verificado
      // e igual ao do convite. É a mesma garantia que o accept_invite em
      // security definer dava, agora sem SQL próprio.
      requireEmailVerificationOnInvitation: true,
      // Workspace compartilhado é fase 4. O workspace pessoal nasce do trigger
      // de banco, que não passa por aqui. Liberar depois, junto com o convite.
      allowUserToCreateOrganization: false,
    }),

    // Precisa ser o ÚLTIMO: é ele que deixa as Server Actions gravarem o cookie
    // de sessão. Sem isso o login "funciona" e o usuário continua deslogado.
    nextCookies(),
  ],
});
