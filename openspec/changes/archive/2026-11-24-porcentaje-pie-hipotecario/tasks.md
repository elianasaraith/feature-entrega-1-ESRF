## 1. Datos

- [x] 1.1 Campo `porcentajePie` (`@map("porcentaje_pie") @db.Decimal(5, 2)`, opcional) en `prisma/schema.prisma`
- [x] 1.2 Migración SQL `20261124120000_add_credito_porcentaje_pie`: `ADD COLUMN` nullable sin `DEFAULT` y `CHECK BETWEEN 0 AND 100` (sin ejecutarla)
- [x] 1.3 Regenerar el cliente Prisma (`prisma generate`) y validar el esquema

## 2. Servidor

- [x] 2.1 `creditoInputSchema`: `porcentajePie` opcional, 0–100 inclusive, máx. 2 decimales, sin `Number`
- [x] 2.2 `server/domain/credito-pie.ts`: `calcularPieEstimado` pura con Decimal
- [x] 2.3 `CreditoDto` + `toDto` con `porcentajePie`; `obtenerConEquivalentes` añade `pieEstimado`

## 3. Interfaz

- [x] 3.1 Campo «Porcentaje de pie (%)» con ayuda en `credito-form.tsx` (alta y edición)
- [x] 3.2 Detalle: fila de porcentaje («No informado»), monto estimado y componente de barra pie / resto
- [x] 3.3 Formateador de porcentaje en `app/_lib/format.ts`

## 4. Pruebas

- [x] 4.1 Esquema: válido, límites 0 y 100, decimales, fuera de rango, omitido/null/vacío
- [x] 4.2 Dominio: monto estimado UF y CLP, redondeo, 0 %, 100 %, resto
- [x] 4.3 Integración (omitida sin `TEST_DATABASE_URL`): alta, edición, quitar, 0 vs null, crédito sin campo, `pieEstimado`

## 5. Documentación y verificación

- [x] 5.1 `docs/data-model.md`, `docs/diagrams/data-model.mmd`, `readme.md`, `prompts.md`
- [x] 5.2 `tsc`, ESLint, suite de pruebas y `openspec validate porcentaje-pie-hipotecario --strict`
