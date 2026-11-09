## Why

T05 genera los pagos esperados (`pago_esperado`) pero no hay forma de registrar el dinero
efectivamente recibido. Sin abonos no existe el estado del pago (pendiente, parcial, vencido,
pagado), que es el problema central del producto, ni la base de ingresos que consumirá el
dashboard (T09). Los usuarios también se equivocan al registrar pagos, por lo que el alta debe
ir acompañada de edición y eliminación.

## What Changes

- Nueva tabla `abono_arriendo` (monto CLP > 0, fecha de recepción, medio opcional) ligada a
  `pago_esperado`, con migración Prisma.
- CRUD completo de abonos: crear, listar, editar (monto, fecha de recepción, medio) y eliminar,
  con endpoints anidados bajo propiedad → contrato → pago esperado.
- Consulta de pagos esperados de un contrato con su estado derivado: monto recibido, saldo
  pendiente, estado (`PENDIENTE` · `PARCIALMENTE_PAGADO` · `VENCIDO` · `PAGADO`), fecha de
  completitud y las calificaciones *vencido con abonos parciales* y *pagado con atraso*.
- Dominio puro que deriva todo lo anterior a partir de los abonos vigentes y una fecha de
  referencia inyectada. Estado, saldo, fecha de completitud y calificaciones nunca se persisten.
- Validación: monto <= 0 → 422; fecha de recepción futura → 422 (formato inválido → 400); pertenencia abono → pago → contrato → propiedad del usuario autenticado.
- Eliminación **física** con confirmación en la interfaz, sin auditoría ni papelera: es lo que
  ya establece `data-model.md` (usuario único, borrado físico).
- Interfaz sencilla para listar pagos con su estado y registrar, editar y eliminar abonos.
- La sincronización de pagos esperados de T05 se mantiene explícita; los reajustes siguen sin
  modificar ni bloquear abonos.
- Actualización de `docs/` (`work-tickets.md` T06, `architecture.md` ruta del endpoint),
  `readme.md` y `prompts.md`.

Fuera de alcance: movimientos financieros (T07), aportes de capital (T08), dashboard (T09),
conversión UF, documentos y comprobantes (T11), cobro o ejecución de pagos.

## Capabilities

### New Capabilities
- `rent-payments`: registro, consulta, edición y eliminación de abonos de arriendo contra un
  pago esperado, y estado de pago derivado (recibido, saldo, estado, fecha de completitud y
  calificaciones).

### Modified Capabilities
<!-- Ninguna: lease-management conserva sus requisitos; T06 solo lee pago_esperado. -->

## Impact

- **Base de datos**: migración con `abono_arriendo` (FK `onDelete: Restrict` a `pago_esperado`,
  `CHECK (monto_clp > 0)`, índice por `fecha_recepcion`).
- **Código**: `server/domain/` (estado del pago), `server/schemas/`, `server/services/`,
  Route Handlers bajo `app/api/propiedades/[id]/contratos/[contratoId]/pagos-esperados/...`,
  página bajo `app/propiedades/[id]/contratos/[contratoId]/pagos`, y `tests/pagos/`.
- **Documentación**: la ruta `POST /api/abonos` de `architecture.md` §19 y
  `POST /api/pagos-esperados/{id}/abonos` del `readme.md` pasan a la ruta anidada.
- **Sin dependencias nuevas**.
