"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { cn } from "../_lib/cn";

const TABS = [
  { sufijo: "", etiqueta: "Resumen" },
  { sufijo: "/credito", etiqueta: "Crédito" },
  { sufijo: "/contratos", etiqueta: "Contratos" },
  { sufijo: "/movimientos", etiqueta: "Movimientos" },
  { sufijo: "/documentos", etiqueta: "Documentos" },
];

// Navegación contextual de una propiedad: enlaces estáticos hacia sus módulos.
export function PropiedadNav() {
  const { id } = useParams<{ id: string }>();
  const pathname = usePathname();
  const base = `/propiedades/${id}`;
  return (
    <nav aria-label="Secciones de la propiedad" className="mb-6 overflow-x-auto border-b border-line">
      <ul className="flex min-w-max gap-1">
        {TABS.map(({ sufijo, etiqueta }) => {
          const href = `${base}${sufijo}`;
          const activa = sufijo === "" ? pathname === base || pathname === `${base}/editar` : pathname.startsWith(href);
          return (
            <li key={etiqueta}>
              <Link
                href={href}
                aria-current={activa ? "page" : undefined}
                className={cn(
                  "-mb-px block border-b-2 px-4 py-2.5 text-sm font-medium",
                  activa ? "border-brand text-brand" : "border-transparent text-muted hover:text-ink"
                )}
              >
                {etiqueta}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

// Fallback con las mismas pestañas sin enlaces ni estado activo (ruta aún no resuelta).
export function PropiedadNavFallback() {
  return (
    <div aria-hidden className="mb-6 overflow-x-auto border-b border-line">
      <ul className="flex min-w-max gap-1">
        {TABS.map(({ etiqueta }) => (
          <li key={etiqueta} className="-mb-px block border-b-2 border-transparent px-4 py-2.5 text-sm font-medium text-muted">
            {etiqueta}
          </li>
        ))}
      </ul>
    </div>
  );
}
