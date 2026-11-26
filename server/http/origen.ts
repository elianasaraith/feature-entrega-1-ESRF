// Verificación de origen (CSRF) y límite de tamaño para las mutaciones (seguridad-mvp,
// design.md D8). Funciones puras, sin dependencias de Next: las usa el proxy y las pruebas.
export const METODOS_MUTANTES: ReadonlySet<string> = new Set(["POST", "PUT", "PATCH", "DELETE"]);
export const CUERPO_MAXIMO_BYTES = 1024 * 1024; // 1 MiB; las rutas de documentos no transportan el binario

// Orígenes confiables de `APP_ORIGINS` (lista separada por comas, p. ej.
// "https://realtytrack.vercel.app"). Fuera de producción, si no se define, se acepta
// solo http://localhost:3000. En producción sin APP_ORIGINS la lista queda vacía y toda
// mutación se rechaza (cierre por defecto).
export function origenesConfiables(env: Record<string, string | undefined> = process.env): string[] {
  const lista: string[] = [];
  for (const crudo of (env.APP_ORIGINS ?? "").split(",")) {
    const texto = crudo.trim();
    if (!texto) continue;
    try {
      lista.push(new URL(texto).origin);
    } catch {
      // Un valor inválido se ignora: nunca amplía lo permitido.
    }
  }
  if (lista.length === 0 && env.NODE_ENV !== "production") return ["http://localhost:3000"];
  return lista;
}

// `Origin` debe estar en la lista; sin `Origin` solo se acepta `Sec-Fetch-Site: same-origin`.
export function esOrigenPermitido(
  cabeceras: { origin: string | null; secFetchSite: string | null },
  permitidos: readonly string[]
): boolean {
  if (cabeceras.origin !== null) return permitidos.includes(cabeceras.origin);
  return cabeceras.secFetchSite === "same-origin";
}

// Mutaciones a rutas interceptadas por el proxy, salvo `/api/auth/*` (Auth.js aplica su
// propio CSRF: token + comprobación de origen).
export function requiereVerificacionDeOrigen(metodo: string, pathname: string): boolean {
  return METODOS_MUTANTES.has(metodo.toUpperCase()) && !pathname.startsWith("/api/auth/");
}

export function excedeLimiteDeCuerpo(contentLength: string | null): boolean {
  if (contentLength === null) return false;
  const bytes = Number(contentLength);
  return Number.isFinite(bytes) && bytes > CUERPO_MAXIMO_BYTES;
}
