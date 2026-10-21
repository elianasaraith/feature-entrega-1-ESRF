import type { NextAuthConfig } from "next-auth";

// Configuracion ligera de Auth.js: sin Prisma ni Argon2id, sin el proveedor de
// credenciales. Es la que usa proxy.ts (ver design.md: separacion en dos
// archivos para no cargar Prisma/Argon2id en cada solicitud a una ruta
// protegida, no por incompatibilidad de runtime -- proxy.ts corre en Node.js).
export const authConfig: NextAuthConfig = {
  pages: {
    signIn: "/login",
  },
  providers: [],
  callbacks: {
    authorized({ auth, request }) {
      if (auth?.user) return true;
      // La API responde 401 JSON en lugar de redirigir a /login (T01).
      // /api/auth/* ya queda fuera del matcher de proxy.ts.
      if (request.nextUrl.pathname.startsWith("/api/")) {
        return Response.json({ error: "No autenticado" }, { status: 401 });
      }
      return false;
    },
  },
};
