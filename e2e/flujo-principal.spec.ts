import { expect, test } from "@playwright/test";
import { hoyChile, USUARIO } from "./datos";

const DEPARTAMENTO = "E2E-101";
const ARRENDATARIO = "Arrendatario Ficticio E2E";
const MONTO_CLP = 500000;
const MONTO_TEXTO = "$500.000";

test("rechaza credenciales inválidas", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Correo electrónico").fill(USUARIO.email);
  await page.getByLabel("Contraseña").fill("contrasena-incorrecta");
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect(page.getByText("Email o contraseña incorrectos")).toBeVisible();
  await expect(page).toHaveURL(/\/login/);
});

test("flujo principal: propiedad, contrato, pago, dashboard y cierre de sesión", async ({ page }) => {
  const hoy = hoyChile();
  const inicioContrato = `${hoy.slice(0, 7)}-01`;
  const terminoContrato = `${Number(hoy.slice(0, 4)) + 1}-${hoy.slice(5, 7)}-01`;

  await test.step("login con credenciales válidas", async () => {
    await page.goto("/login");
    await page.getByLabel("Correo electrónico").fill(USUARIO.email);
    await page.getByLabel("Contraseña").fill(USUARIO.password);
    await page.getByRole("button", { name: "Ingresar" }).click();
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByRole("heading", { name: "Dashboard financiero" })).toBeVisible();
  });

  let propiedadId = "";
  await test.step("crear una propiedad", async () => {
    await page.goto("/propiedades/nueva");
    await page.getByLabel("Número de departamento").fill(DEPARTAMENTO);
    await page.getByLabel("Superficie").fill("55");
    await page.getByLabel("Valor de compra").fill("3000");
    await page.getByLabel("Fecha de compra").fill("2020-01-15");
    await page.getByRole("button", { name: "Guardar" }).click();
    await page.waitForURL(/\/propiedades\/(?!nueva)[^/]+$/);
    propiedadId = new URL(page.url()).pathname.split("/").pop() ?? "";
    expect(propiedadId).not.toBe("");
    await expect(page.getByText(DEPARTAMENTO).first()).toBeVisible();
  });

  await test.step("crear un contrato con arrendatario nuevo", async () => {
    await page.goto(`/propiedades/${propiedadId}/contratos/nuevo`);
    // Los arrendatarios no pertenecen a una propiedad: si ya existen otros, el formulario
    // arranca en «Existente». Se elige «Nuevo» explícitamente.
    await page.getByRole("radio", { name: "Nuevo" }).check();
    await page.getByLabel("Nombre del arrendatario").fill(ARRENDATARIO);
    await page.getByLabel("Fecha de inicio").fill(inicioContrato);
    await page.getByLabel("Fecha de término").fill(terminoContrato);
    await page.getByLabel("Día esperado de pago").fill("5");
    await page.getByLabel("Monto mensual inicial").fill(String(MONTO_CLP));
    await page.getByRole("button", { name: "Guardar" }).click();
    await expect(page).toHaveURL(new RegExp(`/propiedades/${propiedadId}/contratos$`));
    await expect(page.getByText(ARRENDATARIO).first()).toBeVisible();
  });

  await test.step("sincronizar los pagos esperados del contrato", async () => {
    await page.getByRole("link", { name: "Montos" }).click();
    await page.getByRole("button", { name: "Sincronizar pagos esperados" }).click();
    await expect(page.getByText("Pagos esperados creados: 1")).toBeVisible();
  });

  await test.step("registrar el pago de arriendo", async () => {
    await page.goto(`/propiedades/${propiedadId}/contratos`);
    await page.getByRole("link", { name: "Pagos" }).click();
    await expect(page.getByText("Pendiente", { exact: true }).or(page.getByText("Vencido", { exact: true }))).toBeVisible();
    await page.getByRole("button", { name: "Registrar abono" }).click();
    await page.getByLabel("Monto (CLP)").fill(String(MONTO_CLP));
    await page.getByLabel("Medio").fill("Transferencia");
    await page.getByRole("button", { name: "Guardar" }).click();
    await expect(page.getByText("Pagado", { exact: true })).toBeVisible();
    await expect(page.getByText(MONTO_TEXTO).first()).toBeVisible();
  });

  await test.step("verificar el ingreso en el dashboard financiero", async () => {
    await page.goto("/dashboard");
    const resumen = page.getByRole("region", { name: "Resumen del mes" });
    await expect(resumen).toContainText(new RegExp(`Ingresos recibidos\\s*\\${MONTO_TEXTO}`));
    await expect(resumen).toContainText(new RegExp(`Flujo neto\\s*\\${MONTO_TEXTO}`));
  });

  await test.step("cerrar sesión y comprobar el acceso protegido", async () => {
    await page.getByRole("button", { name: "Cerrar sesión" }).click();
    await expect(page).toHaveURL(/\/login/);
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
    const respuesta = await page.request.get("/api/propiedades");
    expect(respuesta.status()).toBe(401);
  });
});
