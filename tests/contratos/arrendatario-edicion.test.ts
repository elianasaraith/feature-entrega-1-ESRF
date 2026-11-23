import { test } from "node:test";
import assert from "node:assert/strict";
import { Prisma } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";
import { ConflictError, NotFoundError } from "../../server/errors";
import { arrendatarioInputSchema } from "../../server/schemas/arrendatario";
import { createArrendatarioService, RUT_DUPLICADO } from "../../server/services/arrendatario-service";

// Edición de arrendatarios con un doble de Prisma en memoria (sin base de datos).
const ID = "11111111-1111-4111-8111-111111111111";
type Fila = { id: string; nombre: string; rut: string | null; email: string | null; telefono: string | null; createdAt: Date };

function fake(filas: Fila[]) {
  const prisma = {
    arrendatario: {
      findUnique: async ({ where }: { where: { id: string } }) => filas.find((f) => f.id === where.id) ?? null,
      findUniqueOrThrow: async ({ where }: { where: { id: string } }) => filas.find((f) => f.id === where.id) as Fila,
      update: async ({ where, data }: { where: { id: string }; data: Partial<Fila> }) => {
        if (data.rut && filas.some((f) => f.id !== where.id && f.rut === data.rut)) {
          throw new Prisma.PrismaClientKnownRequestError("dup", { code: "P2002", clientVersion: "x" });
        }
        const fila = filas.find((f) => f.id === where.id) as Fila;
        Object.assign(fila, data);
        return fila;
      },
    },
  };
  return createArrendatarioService(prisma as unknown as PrismaClient);
}
const base = (): Fila => ({ id: ID, nombre: "Ana", rut: "1-9", email: null, telefono: null, createdAt: new Date() });
const entrada = (o: object) => arrendatarioInputSchema.parse({ nombre: "Ana Pérez", ...o });

test("actualiza los cuatro datos y conserva el id", async () => {
  const s = fake([base()]);
  const r = await s.actualizar(ID, entrada({ rut: "2-7", email: "a@x.cl", telefono: "123" }));
  assert.deepEqual(r, { id: ID, nombre: "Ana Pérez", rut: "2-7", email: "a@x.cl", telefono: "123" });
});

test("los opcionales vacíos quedan en null", async () => {
  const s = fake([base()]);
  const r = await s.actualizar(ID, entrada({ rut: "", email: " ", telefono: "" }));
  assert.equal(r.rut, null);
  assert.equal(r.email, null);
  assert.equal(r.telefono, null);
});

test("conservar el propio RUT no es un duplicado", async () => {
  const r = await fake([base()]).actualizar(ID, entrada({ rut: "1-9" }));
  assert.equal(r.rut, "1-9");
});

test("RUT de otro arrendatario: 409 y sin cambios", async () => {
  const otra = { ...base(), id: "22222222-2222-4222-8222-222222222222", rut: "5-5" };
  const propia = base();
  await assert.rejects(fake([propia, otra]).actualizar(ID, entrada({ rut: "5-5" })), (e) => {
    assert.ok(e instanceof ConflictError);
    assert.equal(e.message, RUT_DUPLICADO);
    return true;
  });
  assert.equal(propia.nombre, "Ana");
});

test("id inexistente o no UUID: 404", async () => {
  const s = fake([base()]);
  await assert.rejects(s.actualizar("33333333-3333-4333-8333-333333333333", entrada({})), NotFoundError);
  await assert.rejects(s.actualizar("no-uuid", entrada({})), NotFoundError);
  await assert.rejects(s.obtener("no-uuid"), NotFoundError);
});

test("el esquema rechaza nombre vacío", () => {
  assert.ok(!arrendatarioInputSchema.safeParse({ nombre: "   " }).success);
});
