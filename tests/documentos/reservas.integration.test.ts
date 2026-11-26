import { after, test } from "node:test";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { propiedadInputSchema } from "../../server/schemas/propiedad";
import { createPropiedadService } from "../../server/services/propiedad-service";
import { createReservasPrisma } from "../../server/services/documento-reservas";
import { MAX_BYTES_PROPIEDAD, MAX_DOCUMENTOS_PROPIEDAD } from "../../server/domain/documento";
import { resolveTestDatabase } from "../setup/test-db";

// Reservas y cuotas contra PostgreSQL real (migración add_documento_subida aplicada en la
// base de PRUEBAS). Se omite sin TEST_DATABASE_URL. Cubre lo que las pruebas unitarias no
// pueden: serialización por lock advisory, reclamo atómico y transacción de registro.
const { url, skip } = resolveTestDatabase();
const prisma = skip ? (null as unknown as PrismaClient) : new PrismaClient({ datasourceUrl: url });
const props: string[] = [];
const MB = 1024 * 1024;
let n = 0;

async function propiedad() {
  const p = await createPropiedadService(prisma).crear(
    propiedadInputSchema.parse({ numeroDepartamento: `TEST-SUB-${Date.now()}-${n++}`, superficieM2: 40, valorCompraMonto: 2000, valorCompraMoneda: "UF", fechaCompra: "1989-05-10" })
  );
  props.push(p.id);
  return p.id;
}
const nueva = (propiedadId: string, tamanoBytes: number, expiraEn: Date) => ({
  propiedadId, tipo: "OTRO" as const, nombreArchivo: "a.pdf", mimeType: "application/pdf", tamanoBytes,
  claveTemporal: `tmp/propiedades/${propiedadId}/${crypto.randomUUID()}`,
  claveDefinitiva: `propiedades/${propiedadId}/${crypto.randomUUID()}`,
  expiraEn,
});
const ahora = () => new Date();
const enMinutos = (m: number) => new Date(Date.now() + m * 60_000);

after(async () => {
  if (skip) return;
  await prisma.documentoSubida.deleteMany({ where: { propiedadId: { in: props } } });
  await prisma.documento.deleteMany({ where: { propiedadId: { in: props } } });
  await prisma.propiedad.deleteMany({ where: { id: { in: props } } });
  await prisma.$disconnect();
});

test("cuota de bytes: dos reservas simultáneas que no caben juntas → solo una gana", { skip }, async () => {
  const repo = createReservasPrisma(prisma);
  const p = await propiedad();
  await prisma.documento.create({ data: { propiedadId: p, tipo: "OTRO", nombreArchivo: "x", mimeType: "application/pdf", tamanoBytes: BigInt(MAX_BYTES_PROPIEDAD - 5 * MB), storageKey: `test/${p}/grande` } });
  const r = await Promise.allSettled([repo.reservarConCuota(nueva(p, 4 * MB, enMinutos(10)), ahora()), repo.reservarConCuota(nueva(p, 4 * MB, enMinutos(10)), ahora())]);
  assert.equal(r.filter((x) => x.status === "fulfilled").length, 1);
  assert.equal(r.filter((x) => x.status === "rejected").length, 1);
});

test("cuota de documentos: 50 por propiedad con 60 solicitudes simultáneas; las vencidas no cuentan", { skip }, async () => {
  const repo = createReservasPrisma(prisma);
  const p = await propiedad();
  const r = await Promise.allSettled(Array.from({ length: 60 }, () => repo.reservarConCuota(nueva(p, 10, enMinutos(10)), ahora())));
  assert.equal(r.filter((x) => x.status === "fulfilled").length, MAX_DOCUMENTOS_PROPIEDAD);
  // Con la hora adelantada las reservas vencen y vuelven a caber.
  await repo.reservarConCuota(nueva(p, 10, enMinutos(30)), enMinutos(20));
});

test("reclamar: con 10 confirmaciones simultáneas solo una gana; la abandonada se reclama tras 60 s", { skip }, async () => {
  const repo = createReservasPrisma(prisma);
  const p = await propiedad();
  const reserva = await repo.reservarConCuota(nueva(p, 10, enMinutos(10)), ahora());
  const r = await Promise.all(Array.from({ length: 10 }, () => repo.reclamar(reserva.id, ahora())));
  assert.equal(r.filter(Boolean).length, 1);
  assert.equal(await repo.reclamar(reserva.id, enMinutos(0.5)), null, "reclamada hace menos de 60 s");
  assert.ok(await repo.reclamar(reserva.id, enMinutos(2)), "abandonada: se puede reclamar de nuevo");
  await repo.liberar(reserva.id);
  assert.equal((await repo.obtener(reserva.id))?.estado, "PENDIENTE");
  assert.equal(await repo.reclamar(reserva.id, enMinutos(11)), null, "vencida");
});

test("completar inserta el documento y cierra la reserva en una transacción; la clave definitiva queda referenciada", { skip }, async () => {
  const repo = createReservasPrisma(prisma);
  const p = await propiedad();
  const reserva = await repo.reservarConCuota(nueva(p, 10, enMinutos(10)), ahora());
  const claimed = await repo.reclamar(reserva.id, ahora());
  assert.ok(claimed);
  const doc = await repo.completar(claimed, { propiedadId: p, tipo: "OTRO", nombreArchivo: "a.pdf", mimeType: "application/pdf", tamanoBytes: 10, storageKey: reserva.claveDefinitiva, vinculo: {} });
  const fin = await repo.obtener(reserva.id);
  assert.equal(fin?.estado, "COMPLETADA");
  assert.equal(fin?.documentoId, doc.id);
  assert.equal(await repo.claveDefinitivaReferenciada(reserva.claveDefinitiva), true);
  // Un segundo documento con la misma clave definitiva viola la unicidad: la transacción revierte.
  const otra = await repo.reservarConCuota(nueva(p, 10, enMinutos(10)), ahora());
  await assert.rejects(repo.completar(otra, { propiedadId: p, tipo: "OTRO", nombreArchivo: "b", mimeType: "application/pdf", tamanoBytes: 10, storageKey: reserva.claveDefinitiva, vinculo: {} }));
  assert.equal((await repo.obtener(otra.id))?.estado, "PENDIENTE");
});

test("reclamarVencidas reclama de forma atómica y no toca confirmaciones recientes; eliminar respeta las completadas", { skip }, async () => {
  const repo = createReservasPrisma(prisma);
  const p = await propiedad();
  const vencida = await repo.reservarConCuota(nueva(p, 10, new Date(Date.now() - 3600_000)), new Date(Date.now() - 7200_000));
  const enCurso = await repo.reservarConCuota(nueva(p, 10, new Date(Date.now() - 3600_000)), new Date(Date.now() - 7200_000));
  await prisma.documentoSubida.update({ where: { id: enCurso.id }, data: { estado: "EN_PROCESO", reclamadaEn: ahora() } });
  const antes = new Date(Date.now() - 300_000);
  const propias = (await repo.reclamarVencidas(antes, ahora(), 20)).filter((r) => r.propiedadId === p);
  assert.deepEqual(propias.map((r) => r.id), [vencida.id]);
  assert.equal((await repo.obtener(vencida.id))?.estado, "EXPIRADA");
  assert.equal((await repo.obtener(enCurso.id))?.estado, "EN_PROCESO");
  await repo.eliminar([vencida.id, enCurso.id]);
  assert.equal(await repo.obtener(vencida.id), null);
});

test("la base rechaza tamaño no positivo y claves temporal y definitiva iguales", { skip }, async () => {
  const p = await propiedad();
  const base = { propiedadId: p, tipo: "OTRO" as const, nombreArchivo: "a", mimeType: "application/pdf", expiraEn: enMinutos(5) };
  await assert.rejects(prisma.documentoSubida.create({ data: { ...base, tamanoBytes: BigInt(0), claveTemporal: `t/${p}/1`, claveDefinitiva: `d/${p}/1` } }));
  await assert.rejects(prisma.documentoSubida.create({ data: { ...base, tamanoBytes: BigInt(1), claveTemporal: `t/${p}/2`, claveDefinitiva: `t/${p}/2` } }));
});
