## Why

El dashboard (T09) responde "qué pasó en un mes", pero obliga a cambiar de mes uno a uno para ver la evolución, y muestra el saldo hipotecario solo por propiedad, sin total de cartera (`docs/product.md` §6.5 lista "saldo de los créditos hipotecarios" entre los agregados del dashboard general). Ambas piezas se necesitan antes del rediseño del frontend y de la Entrega Final (26-nov-2026).

Alcance frente al original:
- **Saldo consolidado**: completa §6.5 (el agregado de cartera estaba solo por propiedad).
- **Histórico multi-mes y navegación mes a mes**: ampliación menor. §6.5 exige consultar cualquier mes con el mismo detalle (ya cumplido); no existe criterio de aceptación de serie multi-mes. No es una proyección (fuera de alcance): solo reordena datos ya registrados.

## What Changes

- Nuevo `GET /api/dashboard/historico?mes=YYYY-MM&meses=N`: totales de caja (ingresos, dividendos, otros egresos, egresos totales, flujo neto) de los últimos N meses terminando en `mes`, en orden ascendente. Por defecto N=6; máximo 12. Meses sin operaciones en cero.
- `GET /api/dashboard` añade el campo `saldoConsolidado` (cambio aditivo; no se modifica ni elimina ningún campo existente).
- `saldoConsolidado`: suma en UF de los últimos saldos aplicables por crédito, equivalente en CLP con la UF del mes consultado, y estado `COMPLETO` / `PARCIAL` / `SIN_SALDOS` con conteo de créditos con y sin saldo.
- Página `/dashboard`: sección de saldo consolidado, tabla de histórico (6 meses; enlace a 12) y enlaces "mes anterior / mes siguiente" junto al selector existente. Sin gráficos ni librerías nuevas.
- Sin cambios de esquema Prisma, migraciones ni datos. Sin cambios en T10 ni en `valor_uf_periodo`.

## Capabilities

### New Capabilities
<!-- Ninguna: todo pertenece al dashboard financiero existente. -->

### Modified Capabilities
- `financial-dashboard`: se añaden los requisitos de histórico mensual, saldo hipotecario consolidado y navegación entre meses. Los requisitos vigentes no cambian (ADDED, sin MODIFIED).

## Impact

- Código: `server/services/dashboard-service.ts`, `server/domain/dashboard.ts`, `server/domain/uf.ts`, `server/schemas/shared.ts` (o esquema local de `meses`), `app/api/dashboard/` (nueva ruta `historico`), `app/dashboard/page.tsx`, nuevos componentes en `app/_components/`.
- API: una ruta nueva y un campo aditivo; compatibilidad hacia atrás preservada.
- Dependencias, esquema y datos: ninguno.
- Nota de modelo: el crédito solo guarda su saldo en UF (`saldo_pendiente_uf`); no existen créditos en CLP, por lo que no hay mezcla de monedas que resolver. El cálculo de moneda queda cubierto en `design.md`.
- Documentación: `docs/work-tickets.md` (estado T09) y `readme.md` deberán reflejarlo al archivar (fuera de este change).
