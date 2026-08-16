import type { Metadata } from "next";

import { requireSessionContext } from "@/lib/auth/session";
import { listarCategoriasEmArvore } from "@/lib/db/queries/categories";

import { CategoriasManager } from "./_components/categorias-manager";

export const metadata: Metadata = { title: "Configurações" };

export default async function ConfigPage() {
  const { email, name, userId, workspaces, workspaceId } =
    await requireSessionContext();

  const arvore = await listarCategoriasEmArvore(
    { userId, workspaceId },
    { incluirArquivadas: true },
  );

  const workspaceAtivo = workspaces.find((ws) => ws.id === workspaceId);

  return (
    <div className="mx-auto grid max-w-3xl gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-[-0.02em]">
          Configurações
        </h1>
        <p className="text-text-mid mt-1 text-sm">
          Seu perfil, seu espaço e o catálogo de categorias.
        </p>
      </div>

      <section className="bg-surface-1/60 border-line grid gap-1 rounded-xl border px-5 py-4">
        <h2 className="text-text-mid text-xs tracking-wide uppercase">
          Perfil
        </h2>
        <p className="text-sm font-medium">{name}</p>
        <p className="text-text-dim text-sm">{email}</p>
        <p className="text-text-dim mt-1 text-xs">
          Espaço ativo: {workspaceAtivo?.name ?? "Pessoal"} · espaços
          compartilhados chegam na fase 4.
        </p>
      </section>

      <section className="grid gap-3">
        <div>
          <h2 className="text-sm font-medium">Categorias</h2>
          <p className="text-text-mid mt-0.5 text-xs">
            Renomeie, arquive ou crie categorias. O bucket
            (necessidade/desejo/guardar) alimenta o 50/30/20 sozinho.
          </p>
        </div>

        <CategoriasManager arvore={arvore} />
      </section>
    </div>
  );
}
