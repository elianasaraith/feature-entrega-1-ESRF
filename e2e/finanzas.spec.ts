import { expect, test } from "@playwright/test";
import { crearPropiedad, iniciarSesion } from "./ayudas";

// Mes fijo en el pasado, distinto del de los demás escenarios, para que las cifras
// del dashboard sean exactas aunque la base contenga datos de otros escenarios.
const MES = "2025-03";

test("gestión financiera: gasto, listado, dashboard exacto y navegación de períodos", async ({ page }) => {
  await iniciarSesion(page);
  const id = await crearPropiedad(page, "E2E-301");

  await test.step("registrar un gasto y verlo en el listado", async () => {
    await page.goto(`/propiedades/${id}/movimientos?mes=${MES}`);
    await page.getByRole("button", { name: "Registrar movimiento" }).click();
    await page.getByRole("textbox", { name: "Fecha", exact: true }).fill(`${MES}-10`);
    await page.getByRole("textbox", { name: "Monto (CLP)" }).fill("120000");
    await page.getByRole("textbox", { name: "Descripción" }).fill("Reparación ficticia E2E");
    await page.getByRole("button", { name: "Guardar" }).click();
    const fila = page.getByRole("row").filter({ hasText: "Reparación ficticia E2E" });
    await expect(fila).toContainText("$120.000");
    await page.reload();
    await expect(page.getByRole("row").filter({ hasText: "Reparación ficticia E2E" })).toContainText("$120.000");
  });

  // Elementos visibles de la página activa (las ya visitadas quedan ocultas en el DOM).
  const encabezado = page.locator("header").filter({ has: page.getByRole("heading", { name: "Dashboard financiero" }) });
  const resumen = page.getByRole("region", { name: "Resumen del mes" });
  const selector = page.getByRole("textbox", { name: "Mes", exact: true });

  await test.step("dashboard del mes con egresos y flujo neto exactos", async () => {
    await page.goto(`/dashboard?mes=${MES}`);
    await expect(encabezado).toContainText("marzo 2025");
    await expect(selector).toHaveValue(MES);
    await expect(resumen).toContainText(/Ingresos recibidos\s*\$0/);
    await expect(resumen).toContainText(/Egresos\s*\$120\.000/);
    await expect(resumen).toContainText(/Flujo neto\s*-\$120\.000/);
  });

  await test.step("navegar entre períodos mantiene selector, encabezado y datos sincronizados", async () => {
    await page.getByRole("link", { name: "Mes siguiente" }).click();
    await expect(page).toHaveURL(/mes=2025-04/);
    await expect(selector).toHaveValue("2025-04");
    await expect(encabezado).toContainText("abril 2025");
    await expect(resumen).toContainText(/Egresos\s*\$0/);
    await expect(resumen).toContainText(/Flujo neto\s*\$0/);

    await page.getByRole("link", { name: "Mes anterior" }).click();
    await expect(page).toHaveURL(/mes=2025-03/);
    await expect(selector).toHaveValue(MES);
    await expect(encabezado).toContainText("marzo 2025");
    await expect(resumen).toContainText(/Egresos\s*\$120\.000/);
    await expect(resumen).toContainText(/Flujo neto\s*-\$120\.000/);
  });
});
