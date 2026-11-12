## Why

El dashboard financiero (T09) necesita los egresos manuales de cada propiedad, y hoy no existe dónde registrarlos: reparaciones, equipamiento, seguros, contribuciones y gastos comunes en vacancia solo viven en la hoja de cálculo. T07 (HU03) cierra ese hueco con el registro de `movimiento_financiero`, sin duplicar los ingresos de T06 ni los dividendos de T03.

## What Changes

- Nueva tabla `movimiento_financiero` (Prisma + migración SQL con `CHECK (monto_clp > 0)`) y enum `categoria_movimiento` con 7 valores: `REPARACION`, `EQUIPAMIENTO`, `SEGURO`, `CONTRIBUCIONES`, `GASTO_COMUN`, `GASTO_EXTRAORDINARIO`, `OTRO`. Sin `DIVIDENDO` y sin columna `tipo`.
- CRUD completo por propiedad: alta, listado (con filtro por mes), consulta, edición y eliminación física.
- Validación de negocio: monto entero CLP > 0 y fecha no futura según `hoyChile()` (la fecha de hoy se acepta).
- Función de dominio pura de agregación mensual por categoría (total del mes y desglose), reutilizable por T09.
- Route Handlers protegidos con sesión bajo `/api/propiedades/[id]/movimientos`.
- UI en `app/propiedades/[id]/movimientos`: listado, filtro mensual, total y desglose por categoría, formulario de alta y edición, y confirmación al eliminar. Enlace desde el detalle de la propiedad.
- Pruebas unitarias (schema y agregación) e integración (CRUD, pertenencia a la propiedad, filtro mensual).
- Corrección documental: `CLAUDE.md` lista "dividendos" entre los movimientos financieros; se corrige conforme a `docs/data-model.md` §4.10 y D1.

Fuera de este change: ingresos de arriendo (abonos, T06), dividendos (T03), aportes de capital y su vínculo FK (T08), documentos adjuntos (T11), dashboard (T09). No hay breaking changes.

## Capabilities

### New Capabilities
- `financial-movements`: registro, consulta, edición y eliminación de egresos manuales por propiedad con categoría cerrada, validación de monto y fecha, filtro y agregación mensual por categoría en CLP.

### Modified Capabilities
<!-- Ninguna: los requisitos de mortgage-management, credit-monthly-record y rent-payments no cambian. -->

## Impact

- **Base de datos**: nueva migración (tabla, enum, `CHECK`, índice `(propiedad_id, fecha)`, FK `RESTRICT` a `propiedad`). La migración se crea en `/opsx:apply`; no se ejecuta durante la propuesta.
- **Código**: `prisma/schema.prisma`; `server/schemas/movimiento.ts`; `server/domain/movimiento-agregacion.ts`; `server/services/movimiento-service.ts` y `server/services/index.ts`; `app/api/propiedades/[id]/movimientos/**`; `app/propiedades/[id]/movimientos/**`; enlace en `app/propiedades/[id]/page.tsx`; `tests/movimientos/**`.
- **Documentación**: `CLAUDE.md` (línea de dividendos). `docs/` ya define el modelo y no cambia.
- **Dependencias**: ninguna nueva.
- **Habilita**: T08 (FK opcional desde `aporte_capital`) y T09 (agregación de egresos del mes).
