import "server-only";
import type { Session } from "next-auth";
import { auth } from "@/auth";

// Defensa en profundidad para Route Handlers (architecture.md §8.2): un
// handler lo invoca antes de delegar al servicio. No esta conectado a ningun
// endpoint todavia -- eso es alcance de T01.
//
// `await auth()` sin argumentos es la forma documentada y recomendada por
// Auth.js v5 dentro de Server Components y Route Handlers (ambos corren en
// el contexto de peticion de Next.js que usa next/headers internamente).
// Pasar un Request explicito invoca en cambio la rama de "middleware" de
// next-auth, que espera un NextRequest con `.nextUrl` y genera redirects --
// no es apta para este helper (se descubrio al escribir la prueba 9.5; ver
// design.md). Por eso este helper, igual que el logout (9.6), no se puede
// invocar de forma aislada fuera del runtime de Next.js: se verifica cuando
// T01 lo conecte a un Route Handler real.
export async function requireSession(): Promise<Session | Response> {
  const session = await auth();
  if (!session?.user) {
    return new Response(JSON.stringify({ error: "No autenticado" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }
  return session;
}
