## 1. Funciones de dominio (puras)

- [x] 1.1 Añadir en `server/domain/dashboard.ts` `mesAdyacente(mes, delta)` y `mesesHasta(mesFin, n)` con aritmética entera (cruce de año), sin `Date` ni `Number` financiero
- [x] 1.2 Añadir en `server/domain/uf.ts` `sumarUf(saldos: string[])` con `Prisma.Decimal` (precisión clonada), devolviendo texto decimal exacto
- [x] 1.3 Añadir en `server/domain/dashboard.ts` la clasificación del consolidado (`COMPLETO` / `PARCIAL` / `SIN_SALDOS`) a partir de `conSaldo` y `total`

## 2. Servicio

- [x] 2.1 `dashboardService.historico(mesFin, meses)`: 3 consultas por rango con `select` mínimo, agrupación por `YYYY-MM` y `totales()` existente; meses vacíos en cero; sin UF
- [x] 2.2 Añadir `saldoConsolidado` a `resumenMensualConEquivalentes` (nuevo tipo en el DTO con equivalente): `count` de créditos, `sumarUf`, `calcularEquivalenteClp` con `ufDelMes` (una llamada, solo si hay total); no tocar `calcular()`, `resumenMensual` ni los DTO base

## 3. API

- [x] 3.1 Nueva ruta `app/api/dashboard/historico/route.ts` con `requireSession`, `yearMonth` para `mes` y esquema zod para `meses` (1–12, defecto 6), `toHttpResponse` en errores
- [x] 3.2 Confirmar que `GET /api/dashboard` devuelve el campo nuevo sin alterar los existentes

## 4. Frontend funcional mínimo

- [x] 4.1 Componente `saldo-consolidado.tsx`: total UF, equivalente («No disponible» si `null`), aviso de parcial con créditos sin saldo, «Sin saldo registrado» sin ceros
- [x] 4.2 Componente `historico-mensual.tsx`: tabla simple con las 5 cifras por mes, solo presentación
- [x] 4.3 `app/dashboard/page.tsx`: enlaces mes anterior/siguiente junto al selector, sección de consolidado, histórico de 6 meses con enlace a 12 (`?meses=12`), validando `meses` de la URL con el mismo esquema
- [x] 4.4 Verificar visualmente en el navegador: mes con datos, mes vacío, cruce de año, consolidado parcial y UF no disponible

## 5. Pruebas

- [x] 5.1 Unitarias de dominio: `mesAdyacente` y `mesesHasta` (cruce de año, enero/diciembre, 6 y 12), `sumarUf` (decimales exactos), clasificación del consolidado
- [x] 5.2 Integración del histórico: 6 meses, cruce de año, meses sin movimientos, hechos de caja fuera de su período, gasto desglosado contado una vez
- [x] 5.3 Integración de consistencia: cada mes del histórico coincide con `resumenMensual(mes).totales`
- [x] 5.4 Integración del consolidado: varios créditos, último saldo aplicable por crédito, crédito sin saldo (parcial), sin saldos, UF no disponible (equivalente `null`, resto idéntico), una sola llamada a la UF del mes
- [x] 5.5 Compatibilidad del contrato: campos previos de `/api/dashboard` intactos; revisar y ajustar los tests existentes que comparen la respuesta completa de cartera
- [x] 5.6 Validación del esquema de `meses` y de `mes` (0, 13, no entero, formato inválido)

## 6. Verificación y cierre

- [x] 6.1 `npm test`, `npm run lint`, `tsc` y `npm run build` sin errores; sin `any`
- [x] 6.2 `openspec validate dashboard-historico-mensual --strict`
- [x] 6.3 Actualizar `docs/work-tickets.md` (estado T09) y `readme.md` y registrar el prompt en `prompts.md`, según `CLAUDE.md`
