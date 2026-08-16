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
import type { Conta } from "@/lib/db/queries/accounts";
import type { CategoriaEmArvore } from "@/lib/db/queries/categories";

import { RegraForm } from "./regra-form";

export function NovaRegraSheet({
  contas,
  categorias,
}: {
  contas: Conta[];
  categorias: CategoriaEmArvore[];
}) {
  const [aberto, setAberto] = useState(false);

  return (
    <Sheet open={aberto} onOpenChange={setAberto}>
      <SheetTrigger asChild>
        <Button className="gap-2">
          <Plus className="size-4" aria-hidden />
          Nova recorrência
        </Button>
      </SheetTrigger>

      <SheetContent
        side="bottom"
        className="mx-auto max-h-[92dvh] gap-0 overflow-y-auto rounded-t-xl sm:max-w-lg"
      >
        <SheetHeader className="pb-2">
          <SheetTitle>Nova recorrência</SheetTitle>
          <SheetDescription className="sr-only">
            Crie uma regra que gera lançamentos sozinha: aluguel, salário,
            assinatura.
          </SheetDescription>
        </SheetHeader>

        <div className="grid gap-4 px-4 pb-6">
          <RegraForm
            contas={contas}
            categorias={categorias}
            aoConcluir={() => setAberto(false)}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
