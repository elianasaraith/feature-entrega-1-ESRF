import "server-only";
import * as argon2 from "argon2";
import { prisma } from "../db/client";

export type CredencialesUsuario = { id: string; email: string };

// Extraido de auth.ts para poder probarlo de forma aislada (ver tests/auth/).
export async function verifyCredentials(
  email: string,
  password: string
): Promise<CredencialesUsuario | null> {
  const usuario = await prisma.usuario.findUnique({ where: { email } });
  if (!usuario) {
    return null;
  }

  const passwordValida = await argon2.verify(usuario.passwordHash, password);
  if (!passwordValida) {
    return null;
  }

  return { id: usuario.id, email: usuario.email };
}
