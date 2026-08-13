import "server-only";

import { cache } from "react";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { listarWorkspacesDoUsuario } from "@/lib/db/queries/workspaces";
import { LOGIN_ROUTE } from "@/lib/utils/routes";

import { auth } from "./server";

/**
 * Onde o `workspaceId` de cada request nasce.
 *
 * Toda query de domínio precisa de dois valores — quem é e onde está — e os
 * dois saem daqui. O cookie guarda a escolha do switcher; a sessão guarda a
 * identidade.
 *
 * O cookie **nunca** é confiado: ele é conferido contra a lista de workspaces
 * que o banco devolveu para este usuário, e um valor que não esteja na lista é
 * descartado em silêncio, caindo no espaço pessoal. Cookie é entrada do
 * usuário como qualquer outra — mesmo que a RLS já barrasse o acesso pelo
 * `is_member()`, deixar um id forjado chegar até a query renderizaria a tela
 * inteira vazia em vez de mostrar os dados certos.
 */

export const WORKSPACE_COOKIE = "aurum_ws";

export type WorkspaceResumo = {
  id: string;
  name: string;
  type: string;
  icon: string | null;
  color: string | null;
};

export type SessionContext = {
  userId: string;
  workspaceId: string;
  name: string;
  email: string;
  image: string | null;
  workspaces: WorkspaceResumo[];
};

/**
 * `cache()` do React: um Server Component, o layout e a página do mesmo request
 * chamam isto sem repetir a consulta de sessão nem a de workspaces.
 */
export const getSessionContext = cache(
  async (): Promise<SessionContext | null> => {
    const session = await auth.api.getSession({ headers: await headers() });

    if (!session) return null;

    const userId = session.user.id;
    const workspaces = await listarWorkspacesDoUsuario(userId);

    // Um usuário sem workspace nenhum não deveria existir: o trigger de
    // cadastro cria o pessoal na mesma transação do perfil. Se acontecer, é
    // dado corrompido, e seguir daqui só produziria telas vazias sem explicação.
    if (workspaces.length === 0) {
      throw new Error(
        `usuário ${userId} não tem workspace — o trigger de cadastro falhou`,
      );
    }

    const escolhido = (await cookies()).get(WORKSPACE_COOKIE)?.value;
    const valido = workspaces.some((ws) => ws.id === escolhido);

    const pessoal = workspaces.find((ws) => ws.type === "personal");

    const workspaceId =
      valido && escolhido ? escolhido : (pessoal ?? workspaces[0]!).id;

    return {
      userId,
      workspaceId,
      name: session.user.name,
      email: session.user.email,
      image: session.user.image ?? null,
      workspaces,
    };
  },
);

/**
 * Para as rotas do grupo (app), onde estar deslogado não é um estado possível.
 *
 * Continua sendo a tranca REAL: consulta o banco e enxerga revogação na hora,
 * ao contrário do proxy, que faz a checagem otimista pelo cookie assinado.
 */
export async function requireSessionContext(): Promise<SessionContext> {
  const contexto = await getSessionContext();

  if (!contexto) redirect(LOGIN_ROUTE);

  return contexto;
}
