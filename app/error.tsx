"use client";

import { AlertCircle } from "lucide-react";
import { Button, ButtonLink } from "./_ui";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-md rounded-xl border border-line bg-white p-8 text-center shadow-card">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-negative-50 text-negative">
          <AlertCircle aria-hidden className="h-6 w-6" />
        </span>
        <h1 className="mt-4 text-xl font-semibold text-ink">Algo salió mal</h1>
        <p className="mt-2 text-sm text-muted">No pudimos completar la operación. Puedes reintentar o volver al dashboard.</p>
        <div className="mt-6 flex justify-center gap-2">
          <Button onClick={reset}>Reintentar</Button>
          <ButtonLink href="/dashboard" variante="secondary">Ir al dashboard</ButtonLink>
        </div>
      </div>
    </div>
  );
}
