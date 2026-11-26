import { spawnSync } from "node:child_process";
import { destinoDe, resolveTestDatabase } from "../tests/setup/test-db";

// Aplica las migraciones SOLO a TEST_DATABASE_URL (`npm run test:e2e:db`). Carga .env
// sin sobrescribir el entorno, valida el destino con la misma guarda que las pruebas
// de integración y, solo si es una base de pruebas autorizada, fuerza DATABASE_URL y
// DIRECT_URL a ese valor. Nunca imprime la URL ni credenciales.
try {
  process.loadEnvFile(".env");
} catch {
  // Sin .env: se usan las variables del entorno.
}

function abortar(motivo: string): never {
  console.error(`test:e2e:db abortado: ${motivo}`);
  process.exit(1);
}

const { url, skip } = resolveTestDatabase();
if (!url) abortar("TEST_DATABASE_URL no está definida (ni en el entorno ni en .env).");
if (skip) abortar(skip);

const destino = destinoDe(url);
if (!destino || !/test|e2e/i.test(destino.database)) {
  abortar("el nombre de la base de TEST_DATABASE_URL debe contener «test» o «e2e».");
}

console.log(`Aplicando migraciones a la base de pruebas «${destino.database}» (${destino.host}).`);
const resultado = spawnSync("npx", ["prisma", "migrate", "deploy"], {
  stdio: "inherit",
  env: { ...process.env, DATABASE_URL: url, DIRECT_URL: url },
});
process.exit(resultado.status ?? 1);
