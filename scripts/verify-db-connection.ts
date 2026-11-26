import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.$queryRaw`SELECT 1`;
  console.log("Conexión Prisma↔PostgreSQL verificada correctamente.");
}

main()
  .catch((error) => {
    console.error("No se pudo verificar la conexión Prisma↔PostgreSQL:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
