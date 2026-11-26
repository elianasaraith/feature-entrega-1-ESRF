import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authConfig } from "./auth.config";
import { autenticarConLimite } from "./server/auth/verify-credentials";

// Configuracion completa de Auth.js: extiende la ligera (auth.config.ts) con
// el proveedor de credenciales, que es el unico lugar que toca Prisma y
// Argon2id. La duracion de la sesion (8 h absolutas) vive en auth.config.ts
// para que la apliquen tambien el proxy y los callbacks. El acceso pasa por
// `autenticarConLimite` (limite persistente de intentos por IP y cuenta).
export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: {},
        password: {},
      },
      async authorize(credentials, request) {
        const email = typeof credentials?.email === "string" ? credentials.email : null;
        const password = typeof credentials?.password === "string" ? credentials.password : null;
        if (!email || !password) {
          return null;
        }

        return autenticarConLimite(email, password, request.headers);
      },
    }),
  ],
});
