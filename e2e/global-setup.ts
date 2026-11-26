import { PrismaClient } from "@prisma/client";
import { seedUsuario } from "../prisma/seed-usuario";
import { destinoDe, resolveTestDatabase } from "../tests/setup/test-db";
import { USUARIO } from "./datos";

// Deja la base de pruebas en estado conocido: vacía las tablas de dominio (incluye
// `login_intento`, por lo que el límite de intentos no genera fallos intermitentes) y
// siembra el usuario ficticio. Nunca usa DATABASE_URL: solo TEST_DATABASE_URL, y solo
// si es una base distinta de la de desarrollo y su nombre indica que es de pruebas.
export default async function globalSetup() {
  const { url, skip } = resolveTestDatabase();
  if (!url || skip) {
    throw new Error(`E2E abortado: ${skip || "TEST_DATABASE_URL no definida"}.`);
  }
  const nombre = destinoDe(url)?.database ?? "";
  if (!/test|e2e/i.test(nombre)) {
    throw new Error("E2E abortado: el nombre de la base de TEST_DATABASE_URL debe contener «test» o «e2e».");
  }

  const prisma = new PrismaClient({ datasourceUrl: url });
  try {
    const tablas = await prisma.$queryRaw<{ tablename: string }[]>`
      SELECT tablename FROM pg_tables
      WHERE schemaname = current_schema() AND tablename <> '_prisma_migrations'`;
    if (tablas.length === 0) {
      throw new Error("La base de pruebas no tiene tablas: aplique las migraciones (npm run test:e2e:db).");
    }
    const lista = tablas.map((t) => `"${t.tablename.replaceAll('"', '""')}"`).join(", ");
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${lista} RESTART IDENTITY CASCADE`);

    process.env.SEED_USER_EMAIL = USUARIO.email;
    process.env.SEED_USER_PASSWORD = USUARIO.password;
    await seedUsuario(prisma);
  } finally {
    await prisma.$disconnect();
  }
}
