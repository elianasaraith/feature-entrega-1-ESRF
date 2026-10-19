import type { PrismaClient } from "@prisma/client";
import * as argon2 from "argon2";

// Logica reutilizada por `npm run db:seed` (siembra completa) y
// `npm run db:seed:user` (solo el usuario). Nunca toca la tabla `propiedad`.
// Crea el usuario unico solo si no existe todavia, y nunca sobrescribe sus
// credenciales (ver design.md, "Seed del usuario unico: crear solo si no
// existe, nunca upsert").
export async function seedUsuario(prisma: PrismaClient) {
  const email = process.env.SEED_USER_EMAIL;
  const password = process.env.SEED_USER_PASSWORD;

  if (!email && !password) {
    return;
  }

  if (!email || !password) {
    throw new Error(
      "SEED_USER_EMAIL y SEED_USER_PASSWORD deben estar ambas presentes o ambas ausentes."
    );
  }

  const usuarioExistente = await prisma.usuario.count();
  if (usuarioExistente > 0) {
    console.log("El usuario único ya existe: no se modifican sus credenciales.");
    return;
  }

  const passwordHash = await argon2.hash(password);
  await prisma.usuario.create({ data: { email, passwordHash } });
  console.log("Usuario único creado desde las variables de entorno.");
}
