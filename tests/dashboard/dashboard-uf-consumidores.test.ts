import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// T10 grupo 7, sin base de datos: qué consumidores piden equivalentes de UF. La
// consulta al proveedor solo ocurre en los métodos *ConEquivalentes; los demás
// (p. ej. la ficha de propiedad) usan los métodos originales y nunca tocan la UF.
const leer = (ruta: string) => readFileSync(join(process.cwd(), ruta), "utf8");

test("la ficha de propiedad usa resumenPropiedad (sin UF)", () => {
  const texto = leer("app/propiedades/[id]/page.tsx");
  assert.match(texto, /dashboardService\.resumenPropiedad\(/);
  assert.equal(/ConEquivalentes/.test(texto), false);
  assert.equal(/ufService|uf\/uf-service|uf\/findic/.test(texto), false);
});

test("el dashboard y los endpoints que exponen el saldo piden los equivalentes", () => {
  assert.match(leer("app/dashboard/page.tsx"), /resumenMensualConEquivalentes\(/);
  assert.match(leer("app/api/dashboard/route.ts"), /resumenMensualConEquivalentes\(/);
  assert.match(
    leer("app/api/propiedades/[id]/resumen-mensual/route.ts"),
    /resumenPropiedadConEquivalentes\(/
  );
});

test("el cálculo financiero del dashboard no importa ni usa el equivalente de UF", () => {
  const dominio = leer("server/domain/dashboard.ts");
  assert.equal(/equivalente|uf-service|findic/i.test(dominio), false);
  const servicio = leer("server/services/dashboard-service.ts");
  // `totales(` solo recibe listas de montos en CLP; el equivalente no entra.
  assert.equal(/totales\([^)]*equivalente/i.test(servicio), false);
  assert.equal(/flujoNeto\([^)]*equivalente/i.test(servicio), false);
});
