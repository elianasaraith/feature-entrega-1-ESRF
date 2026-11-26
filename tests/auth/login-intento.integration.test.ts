import { after, test } from "node:test";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { createLoginIntentoStore } from "../../server/auth/login-intento-store";
import { LIMITE_CUENTA, VENTANA_SEGUNDOS, createLimitador } from "../../server/auth/login-limiter";
import { resolveTestDatabase } from "../setup/test-db";

// Contador de intentos contra PostgreSQL real (migración add_login_intento aplicada en la
// base de PRUEBAS). Se omite sin TEST_DATABASE_URL. Verifica la atomicidad de la sentencia
// INSERT … ON CONFLICT que impide el bypass por solicitudes concurrentes.
const { url, skip } = resolveTestDatabase();
const prisma = skip ? (null as unknown as PrismaClient) : new PrismaClient({ datasourceUrl: url });
const PREFIJO = `test-${Date.now()}-`;

after(async () => {
  if (skip) return;
  await prisma.$executeRaw`DELETE FROM login_intento WHERE clave LIKE ${PREFIJO + "%"}`;
  await prisma.$disconnect();
});

test("50 reservas simultáneas de la misma clave reciben contadores distintos 1..50", { skip }, async () => {
  const almacen = createLoginIntentoStore(prisma);
  const ahora = new Date();
  const contadores = await Promise.all(Array.from({ length: 50 }, () => almacen.reservar(`${PREFIJO}a`, ahora, VENTANA_SEGUNDOS)));
  assert.deepEqual([...contadores].sort((x, y) => x - y), Array.from({ length: 50 }, (_, i) => i + 1));
});

test("el límite por cuenta se respeta con intentos concurrentes (como máximo 5 pasan)", { skip }, async () => {
  const limitador = createLimitador({ almacen: createLoginIntentoStore(prisma), sal: `${PREFIJO}sal` });
  const permitidos = await Promise.all(Array.from({ length: 50 }, () => limitador.reservarCuenta("cuenta-concurrente")));
  assert.equal(permitidos.filter(Boolean).length, LIMITE_CUENTA);
  await prisma.$executeRaw`DELETE FROM login_intento WHERE clave LIKE 'cuenta:%' AND actualizado_en > now() - interval '1 minute'`;
});

test("la ventana vence: el contador vuelve a 1; reiniciar elimina la fila; limpiar está acotado", { skip }, async () => {
  const almacen = createLoginIntentoStore(prisma);
  const t0 = new Date("2026-01-01T00:00:00Z");
  assert.equal(await almacen.reservar(`${PREFIJO}b`, t0, VENTANA_SEGUNDOS), 1);
  assert.equal(await almacen.reservar(`${PREFIJO}b`, new Date(t0.getTime() + 60_000), VENTANA_SEGUNDOS), 2);
  assert.equal(await almacen.reservar(`${PREFIJO}b`, new Date(t0.getTime() + (VENTANA_SEGUNDOS + 1) * 1000), VENTANA_SEGUNDOS), 1);
  await almacen.reiniciar(`${PREFIJO}b`);
  assert.equal(await almacen.reservar(`${PREFIJO}b`, t0, VENTANA_SEGUNDOS), 1);
  for (let i = 0; i < 5; i++) await almacen.reservar(`${PREFIJO}viejo-${i}`, t0, VENTANA_SEGUNDOS);
  assert.equal(await almacen.limpiar(new Date("2026-06-01T00:00:00Z"), 3), 3);
});

test("la tabla rechaza contadores negativos", { skip }, async () => {
  await assert.rejects(prisma.$executeRaw`INSERT INTO login_intento (clave, contador, ventana_inicio) VALUES (${PREFIJO + "neg"}, -1, now())`);
});
