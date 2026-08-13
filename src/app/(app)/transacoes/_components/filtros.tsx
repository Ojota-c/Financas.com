"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { Search, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Conta } from "@/lib/db/queries/accounts";

/**
 * Os filtros vivem na URL, não em estado local.
 *
 * Assim a lista filtrada é compartilhável, sobrevive ao F5 e ao botão voltar, e
 * a página continua sendo Server Component — quem refaz a query é o servidor, a
 * partir do searchParams, em vez de o cliente buscar tudo e filtrar na memória.
 */

const TODOS = "todos";

export function Filtros({ contas }: { contas: Conta[] }) {
  const router = useRouter();
  const params = useSearchParams();
  const [pendente, iniciar] = useTransition();

  const [busca, setBusca] = useState(params.get("busca") ?? "");

  function aplicar(mudancas: Record<string, string | null>) {
    const proximos = new URLSearchParams(params.toString());

    for (const [chave, valor] of Object.entries(mudancas)) {
      if (valor === null || valor === "" || valor === TODOS) {
        proximos.delete(chave);
      } else {
        proximos.set(chave, valor);
      }
    }

    iniciar(() => {
      router.replace(`/transacoes?${proximos.toString()}`, { scroll: false });
    });
  }

  // Debounce da busca: uma ida ao servidor por tecla digitada seria uma query
  // por caractere, e o resultado da penúltima chegaria depois da última.
  useEffect(() => {
    const atual = params.get("busca") ?? "";
    if (busca === atual) return;

    const timer = setTimeout(() => aplicar({ busca }), 350);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busca]);

  const de = params.get("de") ?? "";
  const ate = params.get("ate") ?? "";
  const conta = params.get("conta") ?? TODOS;
  const tipo = params.get("tipo") ?? TODOS;

  const temFiltro = Boolean(
    params.get("busca") ||
    params.get("de") ||
    params.get("ate") ||
    params.get("conta") ||
    params.get("tipo"),
  );

  return (
    <div className="grid gap-3" data-pendente={pendente || undefined}>
      <div className="relative">
        <Search
          className="text-text-dim pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
          aria-hidden
        />
        <Input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar na descrição"
          aria-label="Buscar lançamentos"
          className="h-11 pl-9"
        />
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <Select value={tipo} onValueChange={(v) => aplicar({ tipo: v })}>
          <SelectTrigger className="w-full" aria-label="Tipo">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS}>Todos os tipos</SelectItem>
            <SelectItem value="expense">Despesas</SelectItem>
            <SelectItem value="income">Receitas</SelectItem>
            <SelectItem value="transfer">Transferências</SelectItem>
          </SelectContent>
        </Select>

        <Select value={conta} onValueChange={(v) => aplicar({ conta: v })}>
          <SelectTrigger className="w-full" aria-label="Conta">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS}>Todas as contas</SelectItem>
            {contas.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Input
          type="date"
          value={de}
          onChange={(e) => aplicar({ de: e.target.value })}
          aria-label="A partir de"
        />
        <Input
          type="date"
          value={ate}
          onChange={(e) => aplicar({ ate: e.target.value })}
          aria-label="Até"
        />

        {temFiltro && (
          <Button
            variant="ghost"
            onClick={() => {
              setBusca("");
              router.replace("/transacoes", { scroll: false });
            }}
            className="text-text-mid gap-2"
          >
            <X className="size-4" aria-hidden />
            Limpar
          </Button>
        )}
      </div>
    </div>
  );
}
