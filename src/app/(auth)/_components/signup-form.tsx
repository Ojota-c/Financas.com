"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { MailCheck } from "lucide-react";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import {
  signupSchema,
  type SignupInput,
  type SignupValues,
} from "@/lib/validators/auth";
import { signUpWithPassword } from "../actions";
import { Field } from "./field";

export function SignupForm({ next }: { next?: string | undefined }) {
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const [emailEnviadoPara, setEmailEnviadoPara] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignupInput, unknown, SignupValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      fullName: "",
      email: "",
      password: "",
      passwordConfirm: "",
    },
  });

  function onSubmit(values: SignupValues) {
    setServerError(null);
    startTransition(async () => {
      const result = await signUpWithPassword(values, next);
      if ("error" in result) {
        setServerError(result.error);
        return;
      }
      setEmailEnviadoPara(values.email);
    });
  }

  // Confirmação de e-mail é obrigatória: não existe sessão até o usuário
  // clicar no link, então a tela precisa dizer isso em vez de "sucesso".
  if (emailEnviadoPara) {
    return (
      <div className="grid gap-3 text-center">
        <MailCheck className="text-brand mx-auto size-8" aria-hidden />
        <p className="text-base font-medium">Confirme seu e-mail</p>
        {/* O "abra neste mesmo navegador" saiu junto com o Supabase: o fluxo
            PKCE guardava o verificador num cookie do navegador de origem. O
            link do Better Auth é um token assinado, então abre em qualquer
            aparelho — que é justamente o que o convite por e-mail precisa. */}
        <p className="text-text-mid text-sm">
          Enviamos um link para{" "}
          <strong className="text-text">{emailEnviadoPara}</strong>. Abra a
          mensagem em qualquer aparelho para ativar a conta.
        </p>
        {/* Redação neutra de propósito: o cadastro responde igual para e-mail
            novo e para e-mail já registrado, senão a tela vira um oráculo de
            quem tem conta aqui. Quem já tem conta não recebe link nenhum. */}
        <p className="text-text-dim text-xs">
          Se este e-mail ainda não tiver conta, o link chega em instantes.
          Confira o spam antes de tentar de novo.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4" noValidate>
      <Field
        label="Nome"
        autoComplete="name"
        placeholder="Como quer ser chamado"
        error={errors.fullName?.message}
        {...register("fullName")}
      />
      <Field
        label="E-mail"
        type="email"
        autoComplete="email"
        placeholder="voce@email.com"
        error={errors.email?.message}
        {...register("email")}
      />
      <Field
        label="Senha"
        type="password"
        autoComplete="new-password"
        placeholder="Mínimo de 8 caracteres"
        error={errors.password?.message}
        {...register("password")}
      />
      <Field
        label="Repita a senha"
        type="password"
        autoComplete="new-password"
        placeholder="••••••••"
        error={errors.passwordConfirm?.message}
        {...register("passwordConfirm")}
      />

      {serverError && (
        <p
          role="alert"
          className="border-negative/30 bg-negative/10 text-negative rounded-md border px-3 py-2 text-xs"
        >
          {serverError}
        </p>
      )}

      <Button
        type="submit"
        size="lg"
        disabled={isPending}
        className="shadow-glow h-11 w-full rounded-md font-semibold"
      >
        {isPending ? "Criando conta…" : "Criar conta"}
      </Button>
    </form>
  );
}
