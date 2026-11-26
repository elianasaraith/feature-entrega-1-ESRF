import "server-only";
import { connection } from "next/server";
import { hoyChile } from "@/server/clock";

// «Hoy» en Chile leído durante la petición real: `connection()` marca el punto
// como dinámico, de modo que el reloj nunca se lee en el prerenderizado ni se
// cachea. Debe llamarse dentro de un límite <Suspense> (todas las páginas lo tienen).
export async function hoyActual(): Promise<string> {
  await connection();
  return hoyChile();
}
