import "server-only";
import type { PrismaClient } from "@prisma/client";
import type { AlmacenIntentos } from "./login-limiter";

// Implementación PostgreSQL del contador de intentos. `reservar` es una sola sentencia
// atómica (INSERT … ON CONFLICT DO UPDATE … RETURNING): sin lecturas previas que permitan
// un bypass por concurrencia. El reloj lo aporta la aplicación para poder probarla.
export function createLoginIntentoStore(prisma: PrismaClient): AlmacenIntentos {
  return {
    async reservar(clave, ahora, ventanaSegundos) {
      const filas = await prisma.$queryRaw<{ contador: number }[]>`
        INSERT INTO login_intento (clave, contador, ventana_inicio, actualizado_en)
        VALUES (${clave}, 1, ${ahora}::timestamptz, ${ahora}::timestamptz)
        ON CONFLICT (clave) DO UPDATE SET
          contador = CASE
            WHEN login_intento.ventana_inicio <= ${ahora}::timestamptz - (${ventanaSegundos}::int * interval '1 second')
            THEN 1 ELSE login_intento.contador + 1 END,
          ventana_inicio = CASE
            WHEN login_intento.ventana_inicio <= ${ahora}::timestamptz - (${ventanaSegundos}::int * interval '1 second')
            THEN ${ahora}::timestamptz ELSE login_intento.ventana_inicio END,
          actualizado_en = ${ahora}::timestamptz
        RETURNING contador`;
      return Number(filas[0].contador);
    },
    async reiniciar(clave) {
      await prisma.$executeRaw`DELETE FROM login_intento WHERE clave = ${clave}`;
    },
    async limpiar(antes, maximo) {
      return prisma.$executeRaw`
        DELETE FROM login_intento WHERE clave IN (
          SELECT clave FROM login_intento WHERE ventana_inicio < ${antes}::timestamptz ORDER BY ventana_inicio LIMIT ${maximo}::int)`;
    },
  };
}
