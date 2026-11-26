"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Building2 } from "lucide-react";
import { Alert, Button, FormField, Input } from "../../_ui";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;
    setError(null);
    setIsSubmitting(true);

    try {
      const result = await signIn("credentials", { email, password, redirect: false });
      if (result?.error) {
        setError("Email o contraseña incorrectos, o demasiados intentos. Inténtalo de nuevo más tarde.");
        return;
      }
      router.push("/dashboard");
    } catch {
      setError("No se pudo conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <aside className="flex flex-col justify-between bg-navy px-8 py-8 text-white lg:w-2/5 lg:px-14 lg:py-14">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand">
            <Building2 aria-hidden className="h-5 w-5" />
          </span>
          <span className="text-xl font-semibold tracking-tight">RealtyTrack</span>
        </div>
        <div className="my-10 hidden lg:block">
          <h2 className="text-3xl font-semibold leading-tight">Tu patrimonio inmobiliario, en un solo lugar.</h2>
          <p className="mt-4 max-w-sm text-slate-300">
            Propiedades, créditos hipotecarios, arriendos y flujo financiero mensual, con valores en CLP y UF.
          </p>
        </div>
        <p className="hidden text-xs text-slate-400 lg:block">Gestión de cartera inmobiliaria en Chile</p>
      </aside>

      <main className="flex flex-1 items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-sm">
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Iniciar sesión</h1>
          <p className="mt-1 text-sm text-muted">Ingresa con tu correo y contraseña.</p>
          <form onSubmit={handleSubmit} noValidate={false} className="mt-6 space-y-4">
            <FormField etiqueta="Correo electrónico">
              <Input id="email" name="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </FormField>
            <FormField etiqueta="Contraseña">
              <Input id="password" name="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
            </FormField>
            {error && <Alert tono="error">{error}</Alert>}
            <Button type="submit" cargando={isSubmitting} className="w-full">
              {isSubmitting ? "Ingresando…" : "Ingresar"}
            </Button>
          </form>
        </div>
      </main>
    </div>
  );
}
