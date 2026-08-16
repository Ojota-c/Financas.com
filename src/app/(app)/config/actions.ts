"use server";

import { revalidatePath } from "next/cache";

import { requireSessionContext } from "@/lib/auth/session";
import {
  arquivarCategoria,
  atualizarCategoria,
  criarCategoria,
  listarCategorias,
} from "@/lib/db/queries/categories";
import {
  categorySchema,
  renameCategorySchema,
  type CategoryInput,
  type RenameCategoryInput,
} from "@/lib/validators/finance";

export type ActionResult = { ok: true } | { error: string };

function primeiroErro(issues: { message: string }[]): string {
  return issues[0]?.message ?? "Dados inválidos.";
}

/** Toda tela que oferece categoria no formulário. */
function revalidarCategorias() {
  revalidatePath("/config");
  revalidatePath("/transacoes");
  revalidatePath("/orcamento");
  revalidatePath("/dashboard");
}

export async function criarCategoriaAction(
  valores: CategoryInput,
): Promise<ActionResult> {
  const contexto = await requireSessionContext();

  const parsed = categorySchema.safeParse(valores);
  if (!parsed.success) return { error: primeiroErro(parsed.error.issues) };

  // O kind vem do PAI, nunca do formulário: folha de receita dentro de grupo
  // de despesa quebraria o donut e o 50/30/20.
  const todas = await listarCategorias(contexto, { incluirArquivadas: true });
  const pai = todas.find(
    (categoria) =>
      categoria.id === parsed.data.parentId && categoria.parentId === null,
  );

  if (!pai) return { error: "Grupo inválido." };

  if (pai.kind === "expense" && !parsed.data.bucket) {
    return { error: "Categoria de despesa precisa de um bucket." };
  }

  await criarCategoria(contexto, {
    name: parsed.data.name,
    kind: pai.kind,
    parentId: pai.id,
    bucket: pai.kind === "expense" ? parsed.data.bucket : null,
  });

  revalidarCategorias();

  return { ok: true };
}

export async function renomearCategoriaAction(
  valores: RenameCategoryInput,
): Promise<ActionResult> {
  const contexto = await requireSessionContext();

  const parsed = renameCategorySchema.safeParse(valores);
  if (!parsed.success) return { error: primeiroErro(parsed.error.issues) };

  await atualizarCategoria(contexto, parsed.data.id, {
    name: parsed.data.name,
  });

  revalidarCategorias();

  return { ok: true };
}

export async function arquivarCategoriaAction(
  id: string,
  arquivada: boolean,
): Promise<ActionResult> {
  const contexto = await requireSessionContext();

  await arquivarCategoria(contexto, id, arquivada);

  revalidarCategorias();

  return { ok: true };
}
