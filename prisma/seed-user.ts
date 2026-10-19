import { PrismaClient } from "@prisma/client";
import { seedUsuario } from "./seed-usuario";

// Entrypoint de `npm run db:seed:user`: siembra unicamente el usuario unico,
// sin leer ni modificar la tabla `propiedad` en ningun caso.
const prisma = new PrismaClient();

seedUsuario(prisma)
  .catch((error) => {
    console.error("Error ejecutando el seed del usuario:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
