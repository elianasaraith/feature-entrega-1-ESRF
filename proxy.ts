import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

// Next.js 16 busca especificamente un export nombrado `proxy` (o `default`)
// en este archivo -- nunca `middleware` (confirmado en el codigo instalado
// de next: node_modules/next/dist/build/templates/middleware.js). `proxy.ts`
// siempre corre en Node.js runtime, nunca en Edge (confirmado en
// node_modules/next/dist/build/analysis/get-page-static-info.js).
//
// El export debe ser `export const proxy = ...` con un identificador simple:
// la comprobacion de `next build` (get-page-static-info.js) no reconoce un
// export por desestructuracion (`export const { auth: proxy } = ...`) y falla
// con "must export a function".
const { auth } = NextAuth(authConfig);
export const proxy = auth;

export const config = {
  matcher: ["/((?!login|api/auth|_next/static|_next/image|favicon.ico).*)"],
};
