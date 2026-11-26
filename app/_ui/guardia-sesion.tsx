import { Suspense, type ReactNode } from "react";
import { exigirSesionPagina } from "@/server/auth/sesion-pagina";

// Leer la sesión usa cookies (acceso dinámico): con Cache Components debe ocurrir bajo
// <Suspense>. El layout conserva su estructura; solo el contenido espera a la sesión.
async function Comprobacion({ children }: { children: ReactNode }) {
  await exigirSesionPagina();
  return <>{children}</>;
}

export function GuardiaSesion({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={null}>
      <Comprobacion>{children}</Comprobacion>
    </Suspense>
  );
}
