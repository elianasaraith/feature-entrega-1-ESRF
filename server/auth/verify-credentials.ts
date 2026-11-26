import "server-only";
import * as argon2 from "argon2";
import { prisma } from "../db/client";
import { createAutenticador, createHashRelleno, normalizarEmail, type CredencialesUsuario } from "./autenticar";
import { createLimitador, obtenerIp } from "./login-limiter";
import { createLoginIntentoStore } from "./login-intento-store";

export type { CredencialesUsuario } from "./autenticar";

const hashRelleno = createHashRelleno((secreto) => argon2.hash(secreto, { type: argon2.argon2id }));

const buscarUsuario = (emailNormalizado: string) =>
  prisma.usuario.findFirst({ where: { email: { equals: emailNormalizado, mode: "insensitive" } } });

// Verificación sin límite de intentos (extraída de auth.ts para probarla aislada, ver
// tests/auth/). Normaliza el email y verifica Argon2id también cuando el usuario no
// existe. El acceso real pasa por `autenticarConLimite`.
export async function verifyCredentials(email: string, password: string): Promise<CredencialesUsuario | null> {
  const emailNormalizado = normalizarEmail(email);
  const usuario = emailNormalizado ? await buscarUsuario(emailNormalizado) : null;
  const valida = await argon2.verify(usuario?.passwordHash ?? (await hashRelleno()), password);
  return usuario && valida ? { id: usuario.id, email: usuario.email } : null;
}

// Acceso real: reserva atómica de intentos por IP y cuenta antes de verificar (T12 + seguridad-mvp).
export async function autenticarConLimite(
  email: string,
  password: string,
  headers: { get(nombre: string): string | null }
): Promise<CredencialesUsuario | null> {
  // Sal del HMAC de las claves del contador: AUTH_SECRET. Sin él en producción se cierra
  // el acceso (Auth.js tampoco puede firmar sesiones); en desarrollo se usa una constante.
  const sal = process.env.AUTH_SECRET || (process.env.NODE_ENV === "production" ? null : "sin-auth-secret");
  if (!sal) {
    console.error("Acceso denegado: AUTH_SECRET no está definido");
    return null;
  }
  const autenticar = createAutenticador({
    limitador: createLimitador({
      almacen: createLoginIntentoStore(prisma),
      sal,
    }),
    buscarUsuario,
    verificar: (hash, contrasena) => argon2.verify(hash, contrasena),
    hashRelleno,
  });
  return autenticar(email, password, obtenerIp(headers));
}
