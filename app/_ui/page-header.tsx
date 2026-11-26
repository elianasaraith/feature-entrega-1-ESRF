import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";

export type Miga = { etiqueta: string; href?: string };

export function Breadcrumbs({ migas }: { migas: Miga[] }) {
  return (
    <nav aria-label="Ruta de navegación" className="mb-2">
      <ol className="flex flex-wrap items-center gap-1 text-xs text-muted">
        {migas.map((m, i) => (
          <li key={`${m.etiqueta}-${i}`} className="flex items-center gap-1">
            {i > 0 && <ChevronRight aria-hidden className="h-3 w-3" />}
            {m.href ? (
              <Link href={m.href} className="rounded hover:text-brand hover:underline">
                {m.etiqueta}
              </Link>
            ) : (
              <span aria-current="page" className="font-medium text-ink">
                {m.etiqueta}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function PageHeader({
  titulo,
  descripcion,
  migas,
  acciones,
}: {
  titulo: string;
  descripcion?: ReactNode;
  migas?: Miga[];
  acciones?: ReactNode;
}) {
  return (
    <header className="mb-6">
      {migas && migas.length > 0 && <Breadcrumbs migas={migas} />}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-ink">{titulo}</h1>
          {descripcion && <p className="mt-1 text-sm text-muted">{descripcion}</p>}
        </div>
        {acciones && <div className="flex flex-wrap items-center gap-2">{acciones}</div>}
      </div>
    </header>
  );
}

// Lista de pares etiqueta/valor para fichas de detalle.
export function DatosLista({ filas }: { filas: [string, ReactNode][] }) {
  return (
    <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
      {filas.map(([etiqueta, valor]) => (
        <div key={etiqueta} className="min-w-0">
          <dt className="text-xs font-medium uppercase tracking-wide text-muted">{etiqueta}</dt>
          <dd className="mt-1 break-words text-sm text-ink">{valor}</dd>
        </div>
      ))}
    </dl>
  );
}
