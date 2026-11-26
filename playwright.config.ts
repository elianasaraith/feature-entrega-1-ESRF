import { defineConfig, devices } from "@playwright/test";
import { AUTH_SECRET_E2E, BASE_URL, PUERTO } from "./e2e/datos";

// Carga .env sin sobrescribir variables ya definidas (por ejemplo TEST_DATABASE_URL).
try {
  process.loadEnvFile(".env");
} catch {
  // Sin .env: se usan las variables del entorno.
}

const urlPruebas = process.env.TEST_DATABASE_URL ?? "";

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  // `next dev` compila cada ruta la primera vez que se visita: margen para los escenarios largos.
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: BASE_URL,
    actionTimeout: 30_000,
    navigationTimeout: 60_000,
    locale: "es-CL",
    timezoneId: "America/Santiago",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  // Servidor real de la aplicación, apuntando solo a la base de pruebas.
  webServer: [
    // Proveedor de UF simulado (sin red): ver e2e/uf-stub.mjs.
    { command: "node e2e/uf-stub.mjs", port: 3101, reuseExistingServer: false, timeout: 30_000 },
    {
      command: `npx next dev --port ${PUERTO}`,
      url: `${BASE_URL}/login`,
      reuseExistingServer: false,
      timeout: 180_000,
      env: {
        DATABASE_URL: urlPruebas,
        DIRECT_URL: urlPruebas,
        AUTH_SECRET: AUTH_SECRET_E2E,
        AUTH_URL: BASE_URL,
        AUTH_TRUST_HOST: "true",
        APP_ORIGINS: BASE_URL,
        VERCEL: "",
        UF_API_BASE_URL: "http://127.0.0.1:3101/api/uf",
      },
    },
  ],
});
