import "server-only";
import { redirect } from "next/navigation";
import { auth } from "@/auth";

// Defensa en profundidad para páginas privadas (seguridad-mvp): los layouts de
// /dashboard y /propiedades verifican la sesión por sí mismos, de modo que un fallo o
// una omisión del proxy no sirva datos privados. Los Route Handlers conservan su
// propio `requireSession`.
export async function exigirSesionPagina() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  return session;
}
