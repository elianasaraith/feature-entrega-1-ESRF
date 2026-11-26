// Datos ficticios de la prueba E2E: ninguna credencial ni dato personal es real.
export const PUERTO = 3100;
export const BASE_URL = `http://localhost:${PUERTO}`;

export const USUARIO = {
  email: process.env.E2E_USER_EMAIL ?? "e2e@realtytrack.test",
  password: process.env.E2E_USER_PASSWORD ?? "e2e-Contrasena-Ficticia-1",
};

// Secreto de Auth.js solo para el servidor levantado por Playwright.
export const AUTH_SECRET_E2E = "e2e-secreto-ficticio-solo-para-pruebas-0123456789";

// «Hoy» en Chile (YYYY-MM-DD), como lo calcula el servidor.
export function hoyChile(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago" }).format(new Date());
}
