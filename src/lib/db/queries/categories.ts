import "server-only";

import { asc, eq } from "drizzle-orm";

import { categories } from "@/lib/db/schema";
import { withUser } from "@/lib/db/with-user";

import type { ContextoDaSessao } from "./accounts";

export type Categoria = {
  id: string;
  name: string;
  kind: string;
  parentId: string | null;
  bucket: string | null;
  color: string | null;
  icon: string | null;
  isArchived: boolean;
};

/** Pai com as folhas dentro — é como o seletor e os relatórios agrupam. */
export type CategoriaEmArvore = Categoria & { children: Categoria[] };

export async function listarCategorias(
  { userId, workspaceId }: ContextoDaSessao,
  { incluirArquivadas = false } = {},
): Promise<Categoria[]> {
  return withUser(userId, workspaceId, async (tx) =>
    tx
      .select({
        id: categories.id,
        name: categories.name,
        kind: categories.kind,
        parentId: categories.parentId,
        bucket: categories.bucket,
        color: categories.color,
        icon: categories.icon,
        isArchived: categories.isArchived,
      })
      .from(categories)
      .where(incluirArquivadas ? undefined : eq(categories.isArchived, false))
      .orderBy(asc(categories.sortOrder), asc(categories.name)),
  );
}

/**
 * Monta a árvore de dois níveis em memória, e não com CTE recursiva: são 65
 * linhas por workspace: o custo de trazer tudo e agrupar em JS é menor que o de
 * uma consulta recursiva, e o resultado é mais fácil de tipar.
 */
export async function listarCategoriasEmArvore(
  contexto: ContextoDaSessao,
  opcoes?: { incluirArquivadas?: boolean },
): Promise<CategoriaEmArvore[]> {
  const todas = await listarCategorias(contexto, opcoes);

  const pais = todas.filter((c) => c.parentId === null);
  const folhas = todas.filter((c) => c.parentId !== null);

  return pais.map((pai) => ({
    ...pai,
    children: folhas.filter((folha) => folha.parentId === pai.id),
  }));
}

export type NovaCategoria = {
  name: string;
  kind: string;
  parentId?: string | null;
  bucket?: string | null;
  color?: string | null;
  icon?: string | null;
};

export async function criarCategoria(
  { userId, workspaceId }: ContextoDaSessao,
  dados: NovaCategoria,
): Promise<string> {
  return withUser(userId, workspaceId, async (tx) => {
    const [linha] = await tx
      .insert(categories)
      .values({ ...dados, workspaceId })
      .returning({ id: categories.id });

    return linha!.id;
  });
}

export async function atualizarCategoria(
  { userId, workspaceId }: ContextoDaSessao,
  id: string,
  dados: Partial<NovaCategoria>,
): Promise<void> {
  await withUser(userId, workspaceId, async (tx) => {
    await tx.update(categories).set(dados).where(eq(categories.id, id));
  });
}

/** Mesma razão das contas: a FK recusa o delete, e o histórico importa mais. */
export async function arquivarCategoria(
  { userId, workspaceId }: ContextoDaSessao,
  id: string,
  arquivada = true,
): Promise<void> {
  await withUser(userId, workspaceId, async (tx) => {
    await tx
      .update(categories)
      .set({ isArchived: arquivada })
      .where(eq(categories.id, id));
  });
}
