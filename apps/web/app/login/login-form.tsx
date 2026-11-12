"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import { ArrowRight, Eye, EyeOff, LoaderCircle, LockKeyhole, Mail, TriangleAlert } from "lucide-react";

type FieldErrors = { email?: string; password?: string };

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function readError(body: unknown): { message: string; field?: "email" | "password" } {
  if (typeof body === "object" && body !== null && "error" in body) {
    const error = (body as { error: unknown }).error;
    if (typeof error === "object" && error !== null && "message" in error) {
      const { message, field } = error as { message: unknown; field?: unknown };
      return {
        message: typeof message === "string" ? message : "Não foi possível entrar.",
        field: field === "email" || field === "password" ? field : undefined,
      };
    }
  }
  return { message: "Não foi possível entrar. Tente novamente." };
}

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const errors: FieldErrors = {};
    if (!EMAIL_PATTERN.test(email.trim())) errors.email = "Informe um e-mail válido.";
    if (password.length === 0) errors.password = "Informe a senha.";
    setFieldErrors(errors);
    setFormError(null);
    if (errors.email || errors.password) return;

    setSubmitting(true);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const body: unknown = await response.json().catch(() => null);
      if (response.ok && typeof body === "object" && body !== null && "redirectTo" in body) {
        router.replace(String((body as { redirectTo: unknown }).redirectTo));
        router.refresh();
        return;
      }
      const error = readError(body);
      if (error.field) setFieldErrors({ [error.field]: error.message });
      else setFormError(error.message);
    } catch {
      setFormError("Sem conexão com o servidor. Verifique sua rede e tente novamente.");
    }
    setSubmitting(false);
  }

  return (
    <form className="flex flex-col gap-7" onSubmit={onSubmit} noValidate>
      {formError ? (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-lg bg-danger/[0.06] px-3.5 py-3 text-[13.5px]/5 text-danger-ink outline outline-1 -outline-offset-[0.5px] outline-danger/25"
        >
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          {formError}
        </div>
      ) : null}

      <div className="flex flex-col gap-[18px]">
        <Field
          id="email"
          label="E-mail corporativo"
          error={fieldErrors.email}
          icon={<Mail className="h-4 w-4 text-ink-3" aria-hidden="true" />}
        >
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="username"
            placeholder="nome.sobrenome@nexo.com.br"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            aria-invalid={fieldErrors.email ? true : undefined}
            aria-describedby={fieldErrors.email ? "email-error" : undefined}
            className="min-w-0 flex-1 bg-transparent text-[14.5px] text-ink outline-none placeholder:text-ink-3/70"
          />
        </Field>

        <Field
          id="password"
          label="Senha"
          error={fieldErrors.password}
          icon={<LockKeyhole className="h-4 w-4 text-ink-3" aria-hidden="true" />}
          aside={
            <span className="text-[13.5px] font-medium text-link" title="Ambiente de demonstração">
              Qualquer senha serve aqui
            </span>
          }
        >
          <input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            aria-invalid={fieldErrors.password ? true : undefined}
            aria-describedby={fieldErrors.password ? "password-error" : undefined}
            className="min-w-0 flex-1 bg-transparent text-[14.5px] text-ink outline-none"
          />
          <button
            type="button"
            onClick={() => setShowPassword((value) => !value)}
            className="flex h-[30px] w-[30px] items-center justify-center rounded-md text-ink-3 hover:bg-desk"
            aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </Field>
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-cta text-[15.5px] font-semibold text-white shadow-[0_1px_2px_#0062C433,0_6px_16px_#0062C426] transition hover:bg-[#0057ad] disabled:cursor-wait disabled:opacity-80"
      >
        {submitting ? (
          <>
            <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> Entrando…
          </>
        ) : (
          <>
            Entrar <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </>
        )}
      </button>

      <p className="border-t border-rule pt-4 text-[12.5px]/[18px] text-ink-3">
        Funcionários vão para o atendimento; analistas, para o console.
      </p>
    </form>
  );
}

function Field({
  id,
  label,
  error,
  icon,
  aside,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  icon: ReactNode;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <label htmlFor={id} className="text-[13.5px] font-medium text-ink">
          {label}
        </label>
        {aside}
      </div>
      <div
        className={`flex h-11 items-center gap-2.5 rounded-lg bg-paper pl-3.5 pr-2 shadow-[0_1px_2px_#1B24310A] outline -outline-offset-[0.5px] focus-within:outline-[1.5px] ${
          error ? "outline-1 outline-danger focus-within:outline-danger" : "outline-1 outline-ink/[0.12] focus-within:outline-cta"
        }`}
      >
        {icon}
        {children}
      </div>
      {error ? (
        <p id={`${id}-error`} className="text-[12.5px] text-danger-ink">
          {error}
        </p>
      ) : null}
    </div>
  );
}
