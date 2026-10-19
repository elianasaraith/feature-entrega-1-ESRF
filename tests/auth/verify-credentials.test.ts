import { test } from "node:test";
import assert from "node:assert/strict";
import * as argon2 from "argon2";
import { prisma } from "../../server/db/client";
import { verifyCredentials } from "../../server/auth/verify-credentials";

// Requiere PostgreSQL real con la migracion de `usuario` aplicada (igual que
// npm run db:verify). Crea y limpia su propio registro de prueba, sin tocar
// ningun usuario sembrado por `npm run db:seed`.
const TEST_EMAIL = "test-verify-credentials@example.invalid";
const TEST_PASSWORD = "contraseña-de-prueba-123";

test("credenciales válidas devuelven el usuario", async () => {
  const passwordHash = await argon2.hash(TEST_PASSWORD);
  await prisma.usuario.create({ data: { email: TEST_EMAIL, passwordHash } });

  try {
    const resultado = await verifyCredentials(TEST_EMAIL, TEST_PASSWORD);
    assert.notEqual(resultado, null);
    assert.equal(resultado?.email, TEST_EMAIL);
  } finally {
    await prisma.usuario.deleteMany({ where: { email: TEST_EMAIL } });
  }
});

test("credenciales inválidas devuelven null", async () => {
  const passwordHash = await argon2.hash(TEST_PASSWORD);
  await prisma.usuario.create({ data: { email: TEST_EMAIL, passwordHash } });

  try {
    const resultado = await verifyCredentials(TEST_EMAIL, "contraseña-incorrecta");
    assert.equal(resultado, null);
  } finally {
    await prisma.usuario.deleteMany({ where: { email: TEST_EMAIL } });
  }
});

test("email inexistente devuelve null", async () => {
  const resultado = await verifyCredentials("no-existe@example.invalid", TEST_PASSWORD);
  assert.equal(resultado, null);
});
