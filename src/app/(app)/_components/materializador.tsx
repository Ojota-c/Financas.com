"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { materializarAction } from "../transacoes/recorrentes/actions";

/**
 * Dispara a geração de recorrências devidas ao abrir o app — o "job" da fase 2
 * sem depender de cron externo (custo alvo: R$ 0/mês).
 *
 * Server Action num efeito, e não escrita durante o render do servidor:
 * escrever em render quebraria com o cache do Next. A corrida entre duas abas
 * é resolvida do lado do banco (a reclamação condicional em
 * `materializarRegras`); o refresh só acontece quando algo de fato nasceu.
 */
export function Materializador() {
  const router = useRouter();

  useEffect(() => {
    let cancelado = false;

    materializarAction()
      .then(({ geradas }) => {
        if (!cancelado && geradas > 0) router.refresh();
      })
      .catch(() => {
        // Falha aqui não pode derrubar o app: a próxima abertura tenta de novo.
      });

    return () => {
      cancelado = true;
    };
  }, [router]);

  return null;
}
