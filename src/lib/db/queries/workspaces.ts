import "server-only";

import { asc, eq } from "drizzle-orm";

import { workspace_members, workspaces } from "@/lib/db/schema";
import { withUserAcrossWorkspaces } from "@/lib/db/with-user";

/**
 * Os workspaces de uma pessoa — o que alimenta o switcher.
 *
 * É a razão de `withUserAcrossWorkspaces` existir: aqui ainda não há espaço
 * ativo, porque é justamente o que se vai escolher. Toda outra query deste
 * diretório usa `withUser`.
 */
export async function listarWorkspacesDoUsuario(userId: string) {
  return withUserAcrossWorkspaces(userId, async (tx) => {
    const linhas = await tx
      .select({
        id: workspaces.id,
        name: workspaces.name,
        type: workspaces.type,
        icon: workspaces.icon,
        color: workspaces.color,
      })
      .from(workspaces)
      .innerJoin(
        workspace_members,
        eq(workspace_members.organizationId, workspaces.id),
      )
      .where(eq(workspace_members.userId, userId))
      // O pessoal primeiro: 'personal' < 'shared' em ordem alfabética, e é
      // onde a pessoa cai por padrão.
      .orderBy(asc(workspaces.type), asc(workspaces.name));

    return linhas;
  });
}
