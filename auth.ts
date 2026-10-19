import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authConfig } from "./auth.config";
import { verifyCredentials } from "./server/auth/verify-credentials";

// Configuracion completa de Auth.js: extiende la ligera (auth.config.ts) con
// el proveedor de credenciales, que es el unico lugar que toca Prisma y
// Argon2id. No se fija ningun `maxAge` -- se usa la duracion de sesion por
// defecto de next-auth v5 (ver design.md).
export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: {},
        password: {},
      },
      async authorize(credentials) {
        const email = typeof credentials?.email === "string" ? credentials.email : null;
        const password = typeof credentials?.password === "string" ? credentials.password : null;
        if (!email || !password) {
          return null;
        }

        return verifyCredentials(email, password);
      },
    }),
  ],
});
