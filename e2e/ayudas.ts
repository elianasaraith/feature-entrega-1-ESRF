import { expect, type Page } from "@playwright/test";
import { USUARIO } from "./datos";

// Cada escenario inicia sesión y crea su propia propiedad (número de departamento
// único), por lo que no depende de otros escenarios ni del orden de ejecución.
export async function iniciarSesion(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Correo electrónico").fill(USUARIO.email);
  await page.getByLabel("Contraseña").fill(USUARIO.password);
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

// Propiedad de 3000 UF; devuelve su id.
export async function crearPropiedad(page: Page, departamento: string): Promise<string> {
  await page.goto("/propiedades/nueva");
  await page.getByLabel("Número de departamento").fill(departamento);
  await page.getByLabel("Superficie").fill("55");
  await page.getByLabel("Valor de compra").fill("3000");
  await page.getByLabel("Fecha de compra").fill("2020-01-15");
  await page.getByRole("button", { name: "Guardar" }).click();
  await page.waitForURL(/\/propiedades\/(?!nueva)[^/]+$/);
  const id = new URL(page.url()).pathname.split("/").pop() ?? "";
  expect(id).not.toBe("");
  return id;
}
