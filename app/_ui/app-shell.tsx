"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useEffect, useState, type ReactNode } from "react";
import { signOut } from "next-auth/react";
import { Building2, LayoutDashboard, LogOut, Menu, X } from "lucide-react";
import { cn } from "../_lib/cn";

const SECCIONES = [
  { href: "/dashboard", etiqueta: "Dashboard", icono: LayoutDashboard },
  { href: "/propiedades", etiqueta: "Propiedades", icono: Building2 },
];

function Marca() {
  return (
    <Link href="/dashboard" className="flex items-center gap-2.5 rounded-lg px-1 py-1">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand text-white">
        <Building2 aria-hidden className="h-4 w-4" />
      </span>
      <span className="text-lg font-semibold tracking-tight text-white">RealtyTrack</span>
    </Link>
  );
}

// Presentacional: recibe la ruta activa. usePathname() se lee en NavegacionActiva,
// bajo <Suspense>, para no consumir la URL durante el prerenderizado.
function Navegacion({ onNavegar, pathname }: { onNavegar?: () => void; pathname: string }) {
  const [cerrando, setCerrando] = useState(false);
  return (
    <div className="flex h-full flex-col">
      <div className="px-4 pb-6 pt-5">
        <Marca />
      </div>
      <nav aria-label="Principal" className="flex-1 space-y-1 px-3">
        {SECCIONES.map(({ href, etiqueta, icono: Icono }) => {
          const activa = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              onClick={onNavegar}
              aria-current={activa ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                activa ? "bg-white/10 text-white" : "text-slate-300 hover:bg-white/5 hover:text-white"
              )}
            >
              <Icono aria-hidden className="h-4 w-4" />
              {etiqueta}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-white/10 p-3">
        <button
          type="button"
          disabled={cerrando}
          onClick={() => {
            setCerrando(true);
            signOut({ callbackUrl: "/login" });
          }}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-300 transition-colors hover:bg-white/5 hover:text-white disabled:opacity-60"
        >
          <LogOut aria-hidden className="h-4 w-4" />
          {cerrando ? "Cerrando sesión…" : "Cerrar sesión"}
        </button>
      </div>
    </div>
  );
}

function NavegacionActiva({ onNavegar }: { onNavegar?: () => void }) {
  return <Navegacion onNavegar={onNavegar} pathname={usePathname()} />;
}

// Mismo marcado sin sección activa: evita saltos visuales mientras resuelve la ruta.
function NavegacionConFallback({ onNavegar }: { onNavegar?: () => void }) {
  return (
    <Suspense fallback={<Navegacion onNavegar={onNavegar} pathname="" />}>
      <NavegacionActiva onNavegar={onNavegar} />
    </Suspense>
  );
}

// Layout autenticado: sidebar fijo en escritorio y menú desplegable en móvil.
export function AppShell({ children }: { children: ReactNode }) {
  const [abierto, setAbierto] = useState(false);
  useEffect(() => {
    if (!abierto) return;
    const alTecla = (e: KeyboardEvent) => e.key === "Escape" && setAbierto(false);
    window.addEventListener("keydown", alTecla);
    return () => window.removeEventListener("keydown", alTecla);
  }, [abierto]);

  return (
    <div className="min-h-screen lg:pl-64">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 bg-navy lg:block">
        <NavegacionConFallback />
      </aside>

      <header className="sticky top-0 z-20 flex items-center justify-between bg-navy px-4 py-3 lg:hidden">
        <Marca />
        <button
          type="button"
          aria-label="Abrir menú"
          aria-expanded={abierto}
          aria-controls="menu-movil"
          onClick={() => setAbierto(true)}
          className="rounded-lg p-2 text-white hover:bg-white/10"
        >
          <Menu aria-hidden className="h-5 w-5" />
        </button>
      </header>

      {abierto && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-ink/50" onClick={() => setAbierto(false)} aria-hidden />
          <div id="menu-movil" role="dialog" aria-modal="true" aria-label="Menú" className="absolute inset-y-0 left-0 w-72 max-w-[85%] bg-navy shadow-xl">
            <button
              type="button"
              aria-label="Cerrar menú"
              onClick={() => setAbierto(false)}
              className="absolute right-3 top-4 rounded-lg p-2 text-white hover:bg-white/10"
            >
              <X aria-hidden className="h-5 w-5" />
            </button>
            <NavegacionConFallback onNavegar={() => setAbierto(false)} />
          </div>
        </div>
      )}

      <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
    </div>
  );
}
