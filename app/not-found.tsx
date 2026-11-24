import { SearchX } from "lucide-react";
import { ButtonLink } from "./_ui";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-md rounded-xl border border-line bg-white p-8 text-center shadow-card">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand">
          <SearchX aria-hidden className="h-6 w-6" />
        </span>
        <p className="mt-4 text-sm font-semibold text-brand">Error 404</p>
        <h1 className="mt-1 text-xl font-semibold text-ink">Página no encontrada</h1>
        <p className="mt-2 text-sm text-muted">El recurso que buscas no existe o fue eliminado.</p>
        <div className="mt-6 flex justify-center">
          <ButtonLink href="/dashboard">Volver al dashboard</ButtonLink>
        </div>
      </div>
    </div>
  );
}
