"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ThemeToggle } from "@/components/theme-toggle";
import type { AccentColor } from "@/db/schema";
import { authClient } from "@/lib/auth-client";

interface AuthScreenProps {
  inviteRequired: boolean;
  googleEnabled: boolean;
}

const ACCENT_OPTIONS: Array<{ value: AccentColor; label: string; cssVar: string }> = [
  { value: "teal", label: "Turquesa", cssVar: "var(--accent-teal)" },
  { value: "orange", label: "Naranja", cssVar: "var(--accent-orange)" },
  { value: "cobalt", label: "Azul", cssVar: "var(--accent-cobalt)" },
  { value: "berry", label: "Frambuesa", cssVar: "var(--accent-berry)" },
];

export function AuthScreen({ inviteRequired, googleEnabled }: AuthScreenProps) {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [accentColor, setAccentColor] = useState<AccentColor>("teal");
  const [inviteCode, setInviteCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  async function handleGoogleSignIn() {
    setError(null);
    setGoogleLoading(true);
    try {
      const res = await authClient.signIn.social({
        provider: "google",
        callbackURL: "/",
      });
      if (res?.error) {
        setError(res.error.message || "No se pudo iniciar sesión con Google");
        setGoogleLoading(false);
      }
    } catch {
      setError("Error de conexión con Google. Intentá de nuevo.");
      setGoogleLoading(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      if (mode === "login") {
        const res = await authClient.signIn.email({
          email: email.trim(),
          password,
        });
        if (res.error) {
          setError(res.error.message || "Email o contraseña incorrectos");
          setSubmitting(false);
          return;
        }
      } else {
        const res = await fetch("/api/auth/sign-up/email", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(inviteRequired && inviteCode.trim()
              ? { "x-invite-code": inviteCode.trim() }
              : {}),
          },
          body: JSON.stringify({
            name: name.trim(),
            email: email.trim(),
            password,
            accentColor,
          }),
        });

        if (!res.ok) {
          const data = (await res.json().catch(() => null)) as { message?: string } | null;
          setError(data?.message || "No se pudo crear la cuenta");
          setSubmitting(false);
          return;
        }
      }

      router.refresh();
    } catch {
      setError("Error de conexión. Intentá de nuevo.");
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[460px] flex-col justify-center px-4 py-8">
      <div className="mb-5 flex items-center justify-between gap-3">
        <h1 className="font-display m-0 text-[28px] leading-tight font-bold tracking-tight">
          ¿Dónde comemos?
        </h1>
        <ThemeToggle />
      </div>

      <section className="zine-roulette mb-5 p-4">
        <div className="font-display text-[17px] font-bold">
          Tu guía compartida de salidas
        </div>
        <p className="mt-1 mb-0 text-[13px]" style={{ color: "var(--highlight-muted)" }}>
          Cada uno entra con su cuenta para puntuar del 1 al 10, dejar reseñas y sortear pendientes.
        </p>
      </section>

      <div className="zine-modal p-5">
        {googleEnabled && (
          <>
            <button
              type="button"
              disabled={googleLoading || submitting}
              onClick={handleGoogleSignIn}
              className="pressable mb-4 flex w-full items-center justify-center gap-2.5 rounded-xl border-2 px-4 py-3 text-[14px] font-bold disabled:opacity-60"
              style={{
                borderColor: "var(--border)",
                backgroundColor: "var(--bg)",
                color: "var(--fg)",
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="#4285F4"
                  d="M23.49 12.27c0-.79-.07-1.54-.2-2.27H12v4.3h6.45a5.52 5.52 0 0 1-2.39 3.62v3h3.87c2.26-2.08 3.56-5.15 3.56-8.65Z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.24 0 5.95-1.07 7.93-2.91l-3.87-3c-1.07.72-2.45 1.15-4.06 1.15-3.12 0-5.77-2.11-6.71-4.95H1.29v3.1A12 12 0 0 0 12 24Z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.29 14.29A7.22 7.22 0 0 1 4.91 12c0-.79.14-1.56.38-2.29V6.61H1.29A12 12 0 0 0 0 12c0 1.94.46 3.77 1.29 5.39l4-3.1Z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.77c1.76 0 3.34.61 4.58 1.8l3.44-3.44C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.29 6.61l4 3.1C6.23 6.88 8.88 4.77 12 4.77Z"
                />
              </svg>
              {googleLoading ? "Conectando con Google..." : "Continuar con Google"}
            </button>

            <div className="mb-4 flex items-center gap-3 text-[12px] font-semibold" style={{ color: "var(--fg-muted)" }}>
              <span className="h-px flex-1" style={{ backgroundColor: "var(--border-soft)" }} />
              <span>o con email</span>
              <span className="h-px flex-1" style={{ backgroundColor: "var(--border-soft)" }} />
            </div>
          </>
        )}

        <div className="mb-5 grid grid-cols-2 gap-2" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={mode === "login"}
            onClick={() => {
              setMode("login");
              setError(null);
            }}
            className="pressable rounded-xl border-2 px-3 py-2 text-[13px] font-bold"
            style={{
              borderColor: "var(--border)",
              backgroundColor: mode === "login" ? "var(--fg)" : "var(--surface)",
              color: mode === "login" ? "var(--bg)" : "var(--fg)",
            }}
          >
            Entrar
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "signup"}
            onClick={() => {
              setMode("signup");
              setError(null);
            }}
            className="pressable rounded-xl border-2 px-3 py-2 text-[13px] font-bold"
            style={{
              borderColor: "var(--border)",
              backgroundColor: mode === "signup" ? "var(--fg)" : "var(--surface)",
              color: mode === "signup" ? "var(--bg)" : "var(--fg)",
            }}
          >
            Crear cuenta
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
          {mode === "signup" && (
            <div className="flex flex-col gap-1.5">
              <label htmlFor="auth-name" className="text-[12px] font-semibold" style={{ color: "var(--fg-muted)" }}>
                Tu nombre
              </label>
              <input
                id="auth-name"
                type="text"
                required
                autoComplete="given-name"
                placeholder="Ej. Fer o Juli"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="zine-input"
              />
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label htmlFor="auth-email" className="text-[12px] font-semibold" style={{ color: "var(--fg-muted)" }}>
              Email
            </label>
            <input
              id="auth-email"
              type="email"
              required
              autoComplete="email"
              autoCapitalize="none"
              autoCorrect="off"
              placeholder="nombre@ejemplo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="zine-input"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="auth-password" className="text-[12px] font-semibold" style={{ color: "var(--fg-muted)" }}>
              Contraseña {mode === "signup" ? "(mínimo 8 caracteres)" : ""}
            </label>
            <input
              id="auth-password"
              type="password"
              required
              minLength={8}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="zine-input"
            />
          </div>

          {mode === "signup" && (
            <div className="flex flex-col gap-1.5">
              <span className="text-[12px] font-semibold" style={{ color: "var(--fg-muted)" }}>
                Color de tus puntajes
              </span>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {ACCENT_OPTIONS.map((opt) => {
                  const selected = accentColor === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setAccentColor(opt.value)}
                      aria-pressed={selected}
                      className="pressable flex items-center justify-center gap-2 rounded-xl border-2 px-2.5 py-2 text-[12px] font-bold"
                      style={{
                        borderColor: selected ? opt.cssVar : "var(--border-soft)",
                        backgroundColor: "var(--bg)",
                      }}
                    >
                      <span
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: opt.cssVar }}
                      />
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {mode === "signup" && inviteRequired && (
            <div className="flex flex-col gap-1.5">
              <label htmlFor="auth-invite" className="text-[12px] font-semibold" style={{ color: "var(--fg-muted)" }}>
                Código de invitación
              </label>
              <input
                id="auth-invite"
                type="text"
                required
                autoCapitalize="none"
                autoCorrect="off"
                placeholder="Clave compartida"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                className="zine-input"
              />
            </div>
          )}

          {error && (
            <p
              role="alert"
              className="m-0 rounded-xl px-3 py-2 text-[13px] font-semibold"
              style={{ backgroundColor: "var(--danger-soft)", color: "var(--danger)" }}
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="pressable mt-1 w-full rounded-xl px-4 py-3 text-[14px] font-bold disabled:opacity-60"
            style={{
              backgroundColor: "var(--fg)",
              color: "var(--bg)",
            }}
          >
            {submitting
              ? "Ingresando..."
              : mode === "login"
                ? "Entrar a la lista"
                : "Crear mi cuenta"}
          </button>
        </form>
      </div>
    </main>
  );
}
