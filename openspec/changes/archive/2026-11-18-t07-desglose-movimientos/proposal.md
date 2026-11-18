## Why

Hoy un gasto de una propiedad se registra con un único monto: no se puede ver en qué se fue una reparación de 150.000 (materiales, mano de obra, transporte). La planilla original sí lo detalla. El desglose opcional lo permite sin crear gastos independientes ni duplicar egresos, y reemplaza al ticket T08 (aportes de capital), cancelado por decisión de producto.

## What Changes

- Un movimiento financiero puede ser **simple** (como hoy) o **desglosado** en 1 a 50 conceptos, cada uno con `nombre` (1–100 caracteres, se permiten repetidos) y `montoClp` entero > 0.
- El `montoClp` del movimiento es la **suma exacta de sus conceptos**, calculada en el backend con `bigint` y guardada en el movimiento. Si el cliente lo envía junto con conceptos, debe coincidir (422 si no).
- Nueva tabla hija `movimiento_concepto` (`id`, `movimiento_financiero_id`, `nombre`, `monto_clp`, `orden`, timestamps) con `ON DELETE CASCADE`, `CHECK (monto_clp > 0)` e índice por movimiento. Sin columna de tipo ni bandera: un movimiento es desglosado si tiene conceptos.
- Las mismas rutas de T07 con cuerpo extendido (`conceptos` opcional). En el `PUT`, `conceptos` **ausente conserva el desglose existente** (el total vigente solo admite un `montoClp` igual), `conceptos: []` convierte explícitamente a simple y descarta el desglose de forma atómica (exige `montoClp`), `conceptos: null` es un 400 y una lista con elementos reemplaza el desglose completo. La respuesta añade `conceptos` (lista vacía para simples).
- Conversión simple ↔ desglosado con el `PUT` existente, sin endpoints nuevos; la pérdida de un desglose exige `conceptos: []` explícito.
- Función de dominio pura que suma los conceptos, usada por el servicio y por la interfaz para el total en vivo.
- Interfaz de movimientos: conmutador «Desglosar en conceptos», filas dinámicas, total en vivo y conceptos visibles en el listado.
- Pruebas de esquema, dominio, integración de T07 y, sobre todo, de no doble contabilización en T09.
- Documentación: `data-model.md` (entidad nueva y ER), `work-tickets.md`, `user-stories.md`, `product.md`, `architecture.md` y `readme.md`.

**No cambia:** las fórmulas, DTO y consultas de T09, los movimientos existentes (siguen siendo simples, sin migración de datos) ni las rutas.

Fuera de este change: conceptos como movimientos independientes, plantillas o categorías por concepto, conceptos en la actividad reciente, documentos por concepto, y cualquier cambio en el dashboard.

## Capabilities

### New Capabilities
<!-- Ninguna: el desglose amplía capacidades existentes. -->

### Modified Capabilities
- `financial-movements`: registro, consulta, edición, eliminación e interfaz pasan a admitir conceptos; se agregan los requisitos del desglose, del total igual a la suma, de la conversión, de la atomicidad, de la compatibilidad y de la función de suma.
- `financial-dashboard`: se agrega un requisito que fija que un movimiento desglosado se cuenta una sola vez. No se modifica ningún requisito existente.

## Impact

- **Base de datos**: una migración aditiva (`movimiento_concepto`, índice, FK en cascada, `CHECK`). No modifica `movimiento_financiero`. Se genera con `prisma migrate diff` y la aplica el usuario; este change no ejecuta migraciones.
- **Código**: `prisma/schema.prisma`; `server/domain/movimiento-desglose.ts` (nuevo); `server/schemas/movimiento.ts`; `server/services/movimiento-service.ts`; `app/api/propiedades/[id]/movimientos/**` (sin rutas nuevas; el `PUT` pasa a validar con `movimientoEdicionSchema`); `app/propiedades/[id]/movimientos/movimientos-panel.tsx`; `tests/movimientos/**` y `tests/dashboard/**` (solo pruebas).
- **T09**: sin cambios de código; solo pruebas nuevas.
- **Dependencias**: ninguna nueva.
- **Relación con otros changes**: `retirar-aportes-dashboard` sigue activo y sin archivar. Este change solo agrega un requisito a `financial-dashboard`, así que no entra en conflicto con él.
