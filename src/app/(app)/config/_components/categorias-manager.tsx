"use client";

import { useState, useTransition } from "react";

import { Archive, ArchiveRestore, Check, Pencil, Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CategoriaEmArvore } from "@/lib/db/queries/categories";
import { cn } from "@/lib/utils/cn";
import { BUCKETS, ROTULO_DO_BUCKET } from "@/lib/validators/finance";

import {
  arquivarCategoriaAction,
  criarCategoriaAction,
  renomearCategoriaAction,
} from "../actions";

/**
 * O catálogo do workspace, editável: renomear no lugar, arquivar sem apagar
 * (o histórico continua de pé) e criar folha nova dentro de um grupo.
 * Pai não se edita: é a espinha do relatório.
 */
export function CategoriasManager({ arvore }: { arvore: CategoriaEmArvore[] }) {
  return (
    <div className="grid gap-4">
      {arvore.map((pai) => (
        <Grupo key={pai.id} pai={pai} />
      ))}
    </div>
  );
}

function Grupo({ pai }: { pai: CategoriaEmArvore }) {
  const [criando, setCriando] = useState(false);

  return (
    <section className="grid gap-1">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-text-mid text-xs font-medium tracking-wide uppercase">
          {pai.name}
          {pai.kind === "income" && (
            <span className="text-positive ml-1.5 normal-case">· receita</span>
          )}
        </h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setCriando((estado) => !estado)}
          className="text-text-dim hover:text-text h-6 gap-1 px-1.5 text-xs"
        >
          <Plus className="size-3" aria-hidden />
          nova
        </Button>
      </div>

      <div className="bg-surface-1/60 border-line rounded-lg border px-4 py-1">
        {criando && (
          <NovaFolha
            parentId={pai.id}
            ehDespesa={pai.kind === "expense"}
            aoConcluir={() => setCriando(false)}
          />
        )}

        {pai.children.map((folha) => (
          <Folha
            key={folha.id}
            id={folha.id}
            nome={folha.name}
            bucket={folha.bucket}
            arquivada={folha.isArchived}
          />
        ))}
      </div>
    </section>
  );
}

function Folha({
  id,
  nome,
  bucket,
  arquivada,
}: {
  id: string;
  nome: string;
  bucket: string | null;
  arquivada: boolean;
}) {
  const [pendente, iniciar] = useTransition();
  const [editando, setEditando] = useState(false);
  const [novoNome, setNovoNome] = useState(nome);

  function salvar() {
    if (novoNome.trim() === "" || novoNome === nome) {
      setEditando(false);
      setNovoNome(nome);
      return;
    }

    iniciar(async () => {
      await renomearCategoriaAction({ id, name: novoNome });
      setEditando(false);
    });
  }

  return (
    <div
      className={cn(
        "border-line/60 flex items-center justify-between gap-2 border-b py-2 last:border-b-0",
        pendente && "opacity-50",
        arquivada && "opacity-50",
      )}
    >
      {editando ? (
        <form
          className="flex flex-1 items-center gap-1"
          onSubmit={(evento) => {
            evento.preventDefault();
            salvar();
          }}
        >
          <Input
            value={novoNome}
            onChange={(evento) => setNovoNome(evento.target.value)}
            maxLength={60}
            autoFocus
            className="h-8"
            aria-label={`Novo nome para ${nome}`}
          />
          <Button
            type="submit"
            variant="ghost"
            size="icon-sm"
            aria-label="Salvar nome"
            className="text-positive"
          >
            <Check className="size-4" aria-hidden />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Cancelar edição"
            onClick={() => {
              setEditando(false);
              setNovoNome(nome);
            }}
            className="text-text-dim"
          >
            <X className="size-4" aria-hidden />
          </Button>
        </form>
      ) : (
        <p className="min-w-0 flex-1 truncate text-sm">
          {nome}
          {arquivada && (
            <span className="text-text-dim ml-1.5 text-xs">arquivada</span>
          )}
          {bucket && (
            <span className="text-text-dim ml-1.5 text-xs">
              {ROTULO_DO_BUCKET[bucket as (typeof BUCKETS)[number]] ?? bucket}
            </span>
          )}
        </p>
      )}

      {!editando && (
        <div className="flex shrink-0 items-center">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Renomear ${nome}`}
            disabled={pendente}
            onClick={() => setEditando(true)}
            className="text-text-dim hover:text-text"
          >
            <Pencil className="size-3.5" aria-hidden />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={arquivada ? `Restaurar ${nome}` : `Arquivar ${nome}`}
            disabled={pendente}
            onClick={() =>
              iniciar(async () => {
                await arquivarCategoriaAction(id, !arquivada);
              })
            }
            className="text-text-dim hover:text-text"
          >
            {arquivada ? (
              <ArchiveRestore className="size-3.5" aria-hidden />
            ) : (
              <Archive className="size-3.5" aria-hidden />
            )}
          </Button>
        </div>
      )}
    </div>
  );
}

function NovaFolha({
  parentId,
  ehDespesa,
  aoConcluir,
}: {
  parentId: string;
  ehDespesa: boolean;
  aoConcluir: () => void;
}) {
  const [pendente, iniciar] = useTransition();
  const [nome, setNome] = useState("");
  const [bucket, setBucket] = useState<string>("needs");
  const [erro, setErro] = useState<string | null>(null);

  return (
    <form
      className="border-line/60 grid gap-2 border-b py-2"
      onSubmit={(evento) => {
        evento.preventDefault();
        setErro(null);

        iniciar(async () => {
          const resultado = await criarCategoriaAction({
            name: nome,
            parentId,
            bucket: ehDespesa
              ? (bucket as (typeof BUCKETS)[number])
              : undefined,
          });

          if ("error" in resultado) {
            setErro(resultado.error);
            return;
          }

          aoConcluir();
        });
      }}
    >
      <div className="flex items-center gap-2">
        <Input
          value={nome}
          onChange={(evento) => setNome(evento.target.value)}
          placeholder="Nome da categoria"
          maxLength={60}
          autoFocus
          className="h-8"
          aria-label="Nome da nova categoria"
        />

        {ehDespesa && (
          <Select value={bucket} onValueChange={setBucket}>
            <SelectTrigger
              className="h-8 w-36 shrink-0"
              aria-label="Bucket do 50/30/20"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {BUCKETS.map((opcao) => (
                <SelectItem key={opcao} value={opcao}>
                  {ROTULO_DO_BUCKET[opcao]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <Button
          type="submit"
          size="sm"
          disabled={pendente || nome.trim() === ""}
          className="h-8 shrink-0"
        >
          Criar
        </Button>
      </div>

      {erro && (
        <p role="alert" className="text-negative text-xs">
          {erro}
        </p>
      )}
    </form>
  );
}
