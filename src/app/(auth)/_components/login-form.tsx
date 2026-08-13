"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import {
  loginSchema,
  type LoginInput,
  type LoginValues,
} from "@/lib/validators/auth";
import { signInWithPassword } from "../actions";
import { Field } from "./field";

export function LoginForm({ next }: { next?: string | undefined }) {
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput, unknown, LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  function onSubmit(values: LoginValues) {
    setServerError(null);
    startTransition(async () => {
      const result = await signInWithPassword(values, next);
      if ("error" in result) setServerError(result.error);
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4" noValidate>
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
        autoComplete="current-password"
        placeholder="••••••••"
        error={errors.password?.message}
        {...register("password")}
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
        {isPending ? "Entrando…" : "Entrar"}
      </Button>
    </form>
  );
}
