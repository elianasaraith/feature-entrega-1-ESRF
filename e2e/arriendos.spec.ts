import { expect, test, type Page } from "@playwright/test";
import { crearPropiedad, iniciarSesion } from "./ayudas";

const ARRENDATARIO = "Arrendatario Ficticio E2E-5";
const ARRENDATARIO_EDITADO = "Arrendatario Ficticio Editado";

// Tarjeta de un período en la página de pagos: el contenedor más cercano a su
// encabezado que contiene el bloque «Esperado».
const tarjetaPago = (page: Page, periodo: string) =>
  page.getByRole("heading", { name: periodo, exact: true }).locator("xpath=ancestor::div[.//dl][1]");

// Con Cache Components, las páginas ya visitadas permanecen ocultas en el DOM. Los
// campos se buscan por rol y nombre accesible, que solo consideran elementos visibles.
test("gestión de arriendos: arrendatario, reajuste y pagos esperados por vigencia", async ({ page }) => {
  await iniciarSesion(page);
  const id = await crearPropiedad(page, "E2E-401");
  const lista = `/propiedades/${id}/contratos`;
  const contrato = (nombre: string) => page.getByRole("listitem").filter({ hasText: nombre });

  await test.step("crear el contrato (400.000 CLP, 2025) con un arrendatario", async () => {
    await page.goto(`${lista}/nuevo`);
    await page.getByRole("radio", { name: "Nuevo" }).check();
    await page.getByRole("textbox", { name: "Nombre del arrendatario" }).fill(ARRENDATARIO);
    await page.getByRole("textbox", { name: "Fecha de inicio" }).fill("2025-01-01");
    await page.getByRole("textbox", { name: "Fecha de término" }).fill("2025-12-31");
    await page.getByRole("spinbutton", { name: "Día esperado de pago" }).fill("5");
    await page.getByRole("textbox", { name: "Monto mensual inicial" }).fill("400000");
    await page.getByRole("button", { name: "Guardar" }).click();
    await expect(page).toHaveURL(new RegExp(`${lista}$`));
    await expect(contrato(ARRENDATARIO)).toBeVisible();
  });

  await test.step("editar el arrendatario y comprobar la persistencia", async () => {
    await page.getByRole("link", { name: "Editar arrendatario" }).click();
    await expect(page.getByRole("heading", { name: "Editar arrendatario" })).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Nombre", exact: true })).toHaveValue(ARRENDATARIO);
    await page.getByRole("textbox", { name: "Nombre", exact: true }).fill(ARRENDATARIO_EDITADO);
    await page.getByRole("textbox", { name: "Teléfono (opcional)" }).fill("+56 9 0000 0000");
    await page.getByRole("button", { name: "Guardar" }).click();
    await expect(page).toHaveURL(new RegExp(`${lista}$`));
    await page.reload();
    await expect(contrato(ARRENDATARIO_EDITADO)).toBeVisible();
    await page.getByRole("link", { name: "Editar arrendatario" }).click();
    await expect(page.getByRole("heading", { name: "Editar arrendatario" })).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Nombre", exact: true })).toHaveValue(ARRENDATARIO_EDITADO);
    await expect(page.getByRole("textbox", { name: "Teléfono (opcional)" })).toHaveValue("+56 9 0000 0000");
  });

  await test.step("registrar un reajuste a 450.000 desde 2025-07", async () => {
    await page.goto(lista);
    await page.getByRole("link", { name: "Montos" }).click();
    await expect(page.getByRole("heading", { name: "Montos y reajustes" })).toBeVisible();
    await page.getByRole("textbox", { name: "Rige desde" }).fill("2025-07");
    await page.getByRole("textbox", { name: "Monto mensual (CLP)" }).fill("450000");
    await page.getByRole("button", { name: "Guardar" }).click();
    await expect(page.getByRole("row").filter({ hasText: "2025-07" })).toContainText("$450.000");
    await expect(page.getByRole("row").filter({ hasText: "2025-01" })).toContainText("$400.000");
  });

  await test.step("sincronizar pagos y verificar los montos esperados por vigencia", async () => {
    await page.getByRole("button", { name: "Sincronizar pagos esperados" }).click();
    await expect(page.getByText("Pagos esperados creados: 12")).toBeVisible();
    await page.goto(lista);
    await page.getByRole("link", { name: "Pagos" }).click();
    for (const periodo of ["2025-01", "2025-06"]) {
      await expect(tarjetaPago(page, periodo)).toContainText(/Esperado\s*\$400\.000/);
    }
    for (const periodo of ["2025-07", "2025-12"]) {
      await expect(tarjetaPago(page, periodo)).toContainText(/Esperado\s*\$450\.000/);
    }
  });
});
