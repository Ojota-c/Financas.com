"use client";

import { useState } from "react";

import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Conta } from "@/lib/db/queries/accounts";
import type { CategoriaEmArvore } from "@/lib/db/queries/categories";

import { LancamentoForm } from "./lancamento-form";
import { TransferenciaForm } from "./transferencia-form";

type Modo = "expense" | "income" | "transfer";

/**
 * Bottom sheet, como manda a §7 — e não modal centrado: no celular o polegar
 * alcança a base da tela, não o meio.
 *
 * Despesa é o modo inicial porque é o lançamento que a pessoa faz dez vezes por
 * semana; receita, umas duas por mês. Trocar de aba REMONTA o formulário (a
 * `key`), o que zera o estado de propósito: valor digitado numa despesa não
 * deve reaparecer como receita.
 */
export function NovoLancamentoSheet({
  contas,
  categorias,
  variante = "botao",
}: {
  contas: Conta[];
  categorias: CategoriaEmArvore[];
  /** "fab" é o botão redondo da barra inferior; "botao" é o do topo da página. */
  variante?: "botao" | "fab";
}) {
  const [aberto, setAberto] = useState(false);
  const [modo, setModo] = useState<Modo>("expense");

  return (
    <Sheet open={aberto} onOpenChange={setAberto}>
      {/* O gatilho nasce aqui dentro, no cliente: `asChild` clona o filho, e um
          elemento criado num Server Component chega já renderizado e faz o Slot
          do Radix estourar. */}
      <SheetTrigger asChild>
        {variante === "fab" ? (
          <button
            aria-label="Novo lançamento"
            className="brand-gradient text-bg shadow-glow grid size-12 place-items-center rounded-full"
          >
            <Plus className="size-6" aria-hidden />
          </button>
        ) : (
          <Button className="gap-2">
            <Plus className="size-4" aria-hidden />
            Novo lançamento
          </Button>
        )}
      </SheetTrigger>

      <SheetContent
        side="bottom"
        className="mx-auto max-h-[92dvh] gap-0 overflow-y-auto rounded-t-xl sm:max-w-lg"
      >
        <SheetHeader className="pb-2">
          <SheetTitle>Novo lançamento</SheetTitle>
          <SheetDescription className="sr-only">
            Registre uma despesa, uma receita ou uma transferência entre contas.
          </SheetDescription>
        </SheetHeader>

        <div className="grid gap-4 px-4 pb-6">
          <Tabs value={modo} onValueChange={(valor) => setModo(valor as Modo)}>
            <TabsList className="w-full">
              <TabsTrigger value="expense" className="flex-1">
                Despesa
              </TabsTrigger>
              <TabsTrigger value="income" className="flex-1">
                Receita
              </TabsTrigger>
              <TabsTrigger value="transfer" className="flex-1">
                Transferência
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {contas.length === 0 ? (
            <p className="text-text-mid py-8 text-center text-sm">
              Cadastre uma conta antes de lançar.
            </p>
          ) : modo === "transfer" ? (
            <TransferenciaForm
              contas={contas}
              aoConcluir={() => setAberto(false)}
            />
          ) : (
            <LancamentoForm
              key={modo}
              tipo={modo}
              contas={contas}
              categorias={categorias}
              aoConcluir={() => setAberto(false)}
            />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
