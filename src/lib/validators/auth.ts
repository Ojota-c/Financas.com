import { z } from "zod";

/**
 * Schema único: o formulário (React Hook Form) e a Server Action validam com
 * o mesmo objeto. Validar em dois lugares com regras diferentes é como não
 * validar em nenhum.
 */

export const emailField = z
  .string()
  .min(1, "Informe seu e-mail")
  .pipe(z.email("E-mail inválido"))
  .transform((value) => value.trim().toLowerCase());

/** 8 é o mínimo do Supabase Auth; abaixo disso o erro só apareceria no servidor. */
export const passwordField = z
  .string()
  .min(8, "A senha precisa ter ao menos 8 caracteres")
  .max(72, "A senha pode ter no máximo 72 caracteres");

export const loginSchema = z.object({
  email: emailField,
  password: z.string().min(1, "Informe sua senha"),
});

export const signupSchema = z
  .object({
    fullName: z
      .string()
      .min(2, "Informe seu nome")
      .max(80, "Nome muito longo")
      .transform((value) => value.trim()),
    email: emailField,
    password: passwordField,
    passwordConfirm: z.string().min(1, "Repita a senha"),
  })
  .refine((data) => data.password === data.passwordConfirm, {
    message: "As senhas não conferem",
    path: ["passwordConfirm"],
  });

export type LoginInput = z.input<typeof loginSchema>;
export type LoginValues = z.output<typeof loginSchema>;
export type SignupInput = z.input<typeof signupSchema>;
export type SignupValues = z.output<typeof signupSchema>;
