import { expect, test } from "@playwright/test";
import { crearPropiedad, iniciarSesion } from "./ayudas";

// Con Cache Components, las páginas ya visitadas permanecen ocultas en el DOM. Los
// campos se buscan por rol y nombre accesible, que solo consideran elementos visibles.
test("gestión hipotecaria: crédito con pie, edición y dividendo mensual", async ({ page }) => {
  await iniciarSesion(page);
  const id = await crearPropiedad(page, "E2E-201"); // 3000 UF

  await test.step("registrar el crédito con 20 % de pie", async () => {
    await page.goto(`/propiedades/${id}/credito/nuevo`);
    await page.getByRole("textbox", { name: "Banco" }).fill("Banco Ficticio E2E");
    await page.getByRole("textbox", { name: "Cuota contractual (UF)" }).fill("20");
    await page.getByRole("textbox", { name: "Tasa de interés anual (%)" }).fill("4.5");
    await page.getByRole("spinbutton", { name: "Número total de cuotas" }).fill("240");
    await page.getByRole("spinbutton", { name: "Día de vencimiento" }).fill("10");
    await page.getByRole("textbox", { name: "Porcentaje de pie" }).fill("20");
    await page.getByRole("button", { name: "Guardar" }).click();
    await expect(page).toHaveURL(new RegExp(`/propiedades/${id}/credito$`));
    await expect(page.getByText(/Pie · 20 %/)).toBeVisible();
    await expect(page.getByText(/Monto estimado del pie:\s*600 UF/)).toBeVisible();
  });

  await test.step("editar el crédito (pie 25 %) y comprobar la persistencia", async () => {
    await page.getByRole("link", { name: "Editar", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/propiedades/${id}/credito/editar$`));
    await expect(page.getByRole("heading", { name: /Editar crédito/ })).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Banco" })).toHaveValue("Banco Ficticio E2E");
    await page.getByRole("textbox", { name: "Banco" }).fill("Banco Ficticio E2E Editado");
    await page.getByRole("textbox", { name: "Porcentaje de pie" }).fill("25");
    await page.getByRole("button", { name: "Guardar" }).click();
    await expect(page).toHaveURL(new RegExp(`/propiedades/${id}/credito$`));
    await page.reload();
    await expect(page.getByText("Banco Ficticio E2E Editado")).toBeVisible();
    await expect(page.getByText(/Pie · 25 %/)).toBeVisible();
    await expect(page.getByText(/Monto estimado del pie:\s*750 UF/)).toBeVisible();
  });

  await test.step("registrar un dividendo mensual y verlo en el registro", async () => {
    await page.goto(`/propiedades/${id}/credito/registro-mensual/nuevo`);
    await expect(page.getByRole("textbox", { name: "Período" })).toBeVisible();
    await page.getByRole("textbox", { name: "Período" }).fill("2025-06");
    await page.getByRole("textbox", { name: "Dividendo pagado" }).fill("350000");
    await page.getByRole("textbox", { name: "Fecha de pago del dividendo" }).fill("2025-06-10");
    await page.getByRole("textbox", { name: "Saldo pendiente informado" }).fill("2500.5");
    await page.getByRole("button", { name: "Guardar" }).click();
    await expect(page).toHaveURL(new RegExp(`/credito/registro-mensual$`));
    await page.reload();
    const fila = page.getByRole("row").filter({ hasText: "2025-06" });
    await expect(fila).toContainText("$350.000");
    await expect(fila).toContainText("2.500,5");
  });
});
