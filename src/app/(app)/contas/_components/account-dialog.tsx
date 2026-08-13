"use client";

import { useState, useTransition } from "react";

import { Plus } from "lucide-react";

import { MoneyInput } from "@/components/finance/money-input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Conta } from "@/lib/db/queries/accounts";
import {
  ROTULO_DO_TIPO_DE_CONTA,
  TIPOS_DE_CONTA,
} from "@/lib/validators/finance";

import { atualizarContaAction, criarContaAction } from "../actions";

type Props = {
  /** Ausente = criação. Presente = edição. */
  conta?: Conta;
  children?: React.ReactNode;
};

export function AccountDialog({ conta, children }: Props) {
  const [aberto, setAberto] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  const [name, setName] = useState(conta?.name ?? "");
  const [type, setType] = useState<string>(conta?.type ?? "checking");
  const [institution, setInstitution] = useState(conta?.institution ?? "");
  const [initialBalance, setInitialBalance] = useState(
    conta?.initialBalanceCents ?? 0,
  );
  const [creditLimit, setCreditLimit] = useState(conta?.creditLimitCents ?? 0);
  const [closingDay, setClosingDay] = useState(conta?.closingDay ?? "");
  const [dueDay, setDueDay] = useState(conta?.dueDay ?? "");

  const ehCartao = type === "credit_card";

  function enviar(evento: React.FormEvent) {
    evento.preventDefault();
    setErro(null);

    const valores = {
      name,
      type: type as (typeof TIPOS_DE_CONTA)[number],
      institution,
      initialBalance,
      // Os campos de cartão só viajam quando o tipo é cartão — o schema recusa
      // o contrário, e é o mesmo espelho do CHECK do banco.
      ...(ehCartao
        ? {
            creditLimit,
            closingDay: closingDay === "" ? undefined : Number(closingDay),
            dueDay: dueDay === "" ? undefined : Number(dueDay),
          }
        : {}),
    };

    iniciar(async () => {
      const resultado = conta
        ? await atualizarContaAction(conta.id, valores)
        : await criarContaAction(valores);

      if ("error" in resultado) {
        setErro(resultado.error);
        return;
      }

      setAberto(false);
      if (!conta) {
        setName("");
        setInitialBalance(0);
        setInstitution("");
      }
    });
  }

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger asChild>
        {children ?? (
          <Button className="gap-2">
            <Plus className="size-4" aria-hidden />
            Nova conta
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{conta ? "Editar conta" : "Nova conta"}</DialogTitle>
          <DialogDescription>
            {conta
              ? "O saldo se recalcula a partir do extrato."
              : "O saldo inicial é o que já existe na conta hoje."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={enviar} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="conta-nome">Nome</Label>
            <Input
              id="conta-nome"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nubank"
              required
              maxLength={60}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="conta-tipo">Tipo</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger id="conta-tipo">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIPOS_DE_CONTA.map((valor) => (
                  <SelectItem key={valor} value={valor}>
                    {ROTULO_DO_TIPO_DE_CONTA[valor]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="conta-saldo">Saldo inicial</Label>
            <MoneyInput
              id="conta-saldo"
              valueCents={initialBalance}
              onChangeCents={setInitialBalance}
              allowNegative
            />
          </div>

          {ehCartao && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2 sm:col-span-2">
                <Label htmlFor="conta-limite">Limite</Label>
                <MoneyInput
                  id="conta-limite"
                  valueCents={creditLimit}
                  onChangeCents={setCreditLimit}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="conta-fechamento">Fechamento</Label>
                <Input
                  id="conta-fechamento"
                  type="number"
                  min={1}
                  max={31}
                  value={closingDay}
                  onChange={(e) => setClosingDay(e.target.value)}
                  placeholder="28"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="conta-vencimento">Vencimento</Label>
                <Input
                  id="conta-vencimento"
                  type="number"
                  min={1}
                  max={31}
                  value={dueDay}
                  onChange={(e) => setDueDay(e.target.value)}
                  placeholder="5"
                />
              </div>
            </div>
          )}

          <div className="grid gap-2">
            <Label htmlFor="conta-instituicao">Instituição (opcional)</Label>
            <Input
              id="conta-instituicao"
              value={institution}
              onChange={(e) => setInstitution(e.target.value)}
              placeholder="Nu Pagamentos"
              maxLength={60}
            />
          </div>

          {erro && (
            <p role="alert" className="text-negative text-sm">
              {erro}
            </p>
          )}

          <DialogFooter>
            <Button type="submit" disabled={pendente}>
              {pendente ? "Salvando…" : conta ? "Salvar" : "Criar conta"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
