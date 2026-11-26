import type { NextAuthConfig } from "next-auth";
import {
  esOrigenPermitido,
  excedeLimiteDeCuerpo,
  origenesConfiables,
  requiereVerificacionDeOrigen,
} from "./server/http/origen";

// Duracion de la sesion: 8 horas ABSOLUTAS desde el inicio de sesion. Auth.js vuelve a
// firmar el JWT al leer la sesion (renovacion deslizante), por eso el limite real lo
// impone `authTime` en el callback `jwt`, no solo `maxAge`.
export const SESION_SEGUNDOS = 8 * 60 * 60;

declare module "@auth/core/jwt" {
  interface JWT {
    authTime?: number;
  }
}

// Configuracion ligera de Auth.js: sin Prisma ni Argon2id, sin el proveedor de
// credenciales. Es la que usa proxy.ts (ver design.md: separacion en dos
// archivos para no cargar Prisma/Argon2id en cada solicitud a una ruta
// protegida, no por incompatibilidad de runtime -- proxy.ts corre en Node.js).
export const authConfig: NextAuthConfig = {
  pages: {
    signIn: "/login",
  },
  session: { strategy: "jwt", maxAge: SESION_SEGUNDOS },
  providers: [],
  callbacks: {
    // Devolver null invalida la sesion y Auth.js borra la cookie. Un token sin `authTime`
    // (emitido antes de este cambio) se INVALIDA: Auth.js reinicia `iat` en cada lectura
    // de la sesion, asi que medirlo por `iat` lo haria renovable sin limite. Obliga a
    // iniciar sesion de nuevo una vez.
    jwt({ token, user }) {
      const ahora = Math.floor(Date.now() / 1000);
      if (user) token.authTime = ahora;
      if (typeof token.authTime !== "number" || ahora - token.authTime > SESION_SEGUNDOS) return null;
      return token;
    },
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;
      const esApi = pathname.startsWith("/api/");
      // 1) CSRF: toda mutacion (API y paginas) debe venir de un origen confiable. /api/auth/*
      // queda fuera: Auth.js conserva sus propios mecanismos.
      if (
        requiereVerificacionDeOrigen(request.method, pathname) &&
        !esOrigenPermitido(
          { origin: request.headers.get("origin"), secFetchSite: request.headers.get("sec-fetch-site") },
          origenesConfiables()
        )
      ) {
        return Response.json({ error: "Origen no permitido" }, { status: 403 });
      }
      // 2) Tamano de cuerpo declarado de la API.
      if (esApi && excedeLimiteDeCuerpo(request.headers.get("content-length"))) {
        return Response.json({ error: "Solicitud demasiado grande" }, { status: 413 });
      }
      // 3) Sesion.
      if (auth?.user) return true;
      // La API responde 401 JSON en lugar de redirigir a /login (T01).
      // /api/auth/* ya queda fuera del matcher de proxy.ts.
      if (esApi) {
        return Response.json({ error: "No autenticado" }, { status: 401 });
      }
      return false;
    },
  },
};
