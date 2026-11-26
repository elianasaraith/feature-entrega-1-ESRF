## Context

`dashboardService` (`server/services/dashboard-service.ts`) calcula un mes con 5 consultas Prisma (abonos, dividendos, movimientos, pagos esperados, últimos saldos) y las agrupa en TypeScript con `bigint`. `resumenMensualConEquivalentes` añade el equivalente en CLP de cada saldo con la UF del mes consultado (una sola llamada a `uf.obtenerValores([mes])`, degradando a `null`). `GET /api/dashboard` y `/dashboard` ya existen; el selector de mes es un formulario GET.

Hechos verificados que condicionan el diseño:
- El crédito solo almacena el saldo en UF (`credito_registro_mensual.saldo_pendiente_uf`). No hay créditos ni saldos en CLP: no existe mezcla de monedas en el consolidado.
- `credito_hipotecario.propiedad_id` es único: un crédito por propiedad.
- `financial-dashboard` exige que el equivalente en CLP "no se sume a ningún total" y que no se llame a la UF sin necesidad.
- `rangoDelMes`, `sumarMontos`, `flujoNeto`, `totales()`, `calcularEquivalenteClp` y `convertirUfAClp` ya existen y se reutilizan.

## Goals / Non-Goals

**Goals:**
- Serie de totales de caja de N meses (6 por defecto, máx. 12) con las mismas reglas que el mes individual.
- Saldo hipotecario consolidado exacto, que distinga total, parcial y no disponible.
- Navegación mes anterior/siguiente y tablas simples en `/dashboard`.
- Contrato HTTP existente intacto.

**Non-Goals:**
- Gráficos, librerías, rediseño visual, proyecciones, comparación entre propiedades.
- Histórico por propiedad, estados de pago o saldos en la serie.
- Cambios de esquema, migraciones, datos, T10 o `valor_uf_periodo`.
- Refactorizar `calcular()` ni cambiar los DTO existentes.

## Decisions

**D1. Histórico con 3 consultas por rango, no N meses × 5 consultas.**
Nuevo método `dashboardService.historico(mesFin, meses)`: tres `findMany` (abonos por `fecha_recepcion`, dividendos por `fecha_pago_dividendo`, movimientos por `fecha`) sobre `[primerMes, mesFin+1)` con `select` mínimo (fecha y monto). Se agrupan por `YYYY-MM` en TypeScript y cada mes pasa por la función `totales()` existente. Alternativa descartada: llamar a `resumenMensual` N veces (30 consultas, más lectura de pagos y saldos innecesaria). La consistencia con el dashboard mensual se asegura con la misma `totales()` y se prueba explícitamente. `calcular()` no se toca.

**D2. Contrato HTTP: ruta nueva + campo aditivo.**
- `GET /api/dashboard/historico?mes&meses` → `{ mes, meses, periodos: [{ mes, ingresosClp, dividendosClp, otrosEgresosClp, egresosTotalesClp, flujoNetoClp }] }`.
- `GET /api/dashboard` → mismo cuerpo + `saldoConsolidado`. Es la opción más simple compatible: ningún cliente existente cambia. Alternativas descartadas: parámetro `?historico=` en `/api/dashboard` (cuerpo de forma variable, rompe compatibilidad de tipos) y `saldoConsolidado` en un endpoint aparte (más llamadas y UF consultada dos veces).
- Validación: `mes` con `yearMonth`; `meses` con zod, entero 1–12, defecto 6. Sin `mes`, `hoyChile()`.

**D3. Sin UF en el histórico.** Los totales son CLP de caja; no usan UF. No se llama a `uf` ni al proveedor.

**D4. Consolidado: suma en UF y conversión del total.**
- Se reutiliza la lista `saldos` que `calcular()` ya obtiene (último registro con saldo por crédito, `distinct creditoId`), vía las filas `saldoCredito` del resumen. Como solo hay un crédito por propiedad, `conSaldo` = propiedades con `saldoCredito !== null`.
- `creditos.total` requiere una consulta adicional barata: `prisma.creditoHipotecario.count()` (solo en `resumenMensualConEquivalentes`; `resumenMensual` y sus DTO no cambian). `sinSaldo = total − conSaldo`.
- `sumarUf(saldos: string[])` en `server/domain/uf.ts`, con `Prisma.Decimal` (misma precisión clonada que `convertirUfAClp`), devuelve texto decimal exacto sin `Number`.
- `equivalenteClp = calcularEquivalenteClp(totalUf, valorUf)` con la UF del mes consultado, reutilizando `ufDelMes` (una sola llamada, solo si `totalUf !== null`). Se convierte el total, no se suman equivalentes individuales: respeta "el equivalente no se suma a ningún total". Consecuencia aceptada: el total convertido puede diferir en 1 CLP de la suma de los equivalentes mostrados por fila redondeada.
- `estado`: `SIN_SALDOS` (conSaldo = 0), `PARCIAL` (0 < conSaldo < total), `COMPLETO` (conSaldo = total > 0). Un saldo desconocido nunca aporta 0.
- Los saldos pueden venir de períodos anteriores al mes consultado (regla vigente); el consolidado hereda esa regla y la UI ya declara que el período del saldo puede ser anterior.

- Universo de créditos (consistencia temporal): créditos de la cartera cuyo `fecha_otorgamiento` es nula o anterior al fin del mes consultado, más cualquier crédito con saldo aplicable. Un crédito aún no otorgado en ese mes no cuenta como «sin saldo». Se implementa con un `findMany` filtrado (en lugar de `count`).

**D5. Navegación sin JavaScript de cliente.** Función pura `mesAdyacente(mes, delta)` en `server/domain/dashboard.ts` (aritmética de año y mes con enteros) y generación de la lista de meses en `mesesHasta(mesFin, n)`. Enlaces `?mes=` junto al `SelectorMes`; el enlace de 12 meses añade `&meses=12`. La página llama al servicio directamente (como hoy), no por HTTP.

**D6. Componentes presentacionales.** `app/_components/historico-mensual.tsx` y `saldo-consolidado.tsx` solo formatean (`formatearClp`, `formatearUf`, `formatearMontoClp`); sin cálculo financiero en React. Estilo Tailwind mínimo consistente con las tablas actuales; el rediseño visual es un change aparte.

**Supuestos (reversibles, a validar):**
- Máximo 12 meses; `meses` fuera de 1–12 → 400.
- Un solo mes de referencia UF para el consolidado: el consultado.
- El histórico no incluye saldos ni estados de pago.

## Risks / Trade-offs

- [Campo `saldoConsolidado` añadido al cuerpo existente] → Aditivo; un test de compatibilidad fija los campos previos. Tests existentes que comparan la respuesta completa de cartera deben revisarse.
- [Diferencia de 1 CLP entre total convertido y suma de filas redondeadas] → Documentada; el total exacto convertido es la cifra de referencia.
- [Agrupar por mes en TypeScript con filas del rango completo] → Máximo 12 meses de una cartera personal; volumen despreciable. Se seleccionan solo columnas necesarias.
- [Duplicación del criterio de rango y de caja respecto de `calcular()`] → Mismas columnas y filtros; la prueba de consistencia entre histórico y dashboard mensual detecta divergencias.
- [Tablas anchas en móvil] → Fuera de alcance; lo aborda el rediseño.

## Migration Plan

Sin migraciones ni datos. Despliegue normal; rollback por reversión del código. No hay cambios de esquema.

## Open Questions

Ninguno bloqueante. Se asumen los valores por defecto indicados (6 meses, máx. 12).
