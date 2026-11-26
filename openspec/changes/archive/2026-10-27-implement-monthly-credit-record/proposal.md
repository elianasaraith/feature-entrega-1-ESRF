## Why

T03 ("Registro mensual de dividendo y saldo del crédito") es el siguiente ticket de HU01. T02 ya guarda las condiciones contractuales del crédito, pero no hay dónde registrar, mes a mes, el dividendo efectivamente pagado (CLP) ni el saldo pendiente informado por el banco (UF), ni consultar un mes anterior con el mismo detalle que el actual. Sin esa serie, T09 (dashboard) no tiene egresos por dividendo ni saldo de créditos que mostrar.

## What Changes

- Nueva tabla `credito_registro_mensual` (modelo Prisma `CreditoRegistroMensual`), composición `credito_hipotecario 1 : 0..N`, con `UNIQUE(credito_id, periodo)` y CHECK en una migración SQL incremental.
- API REST anidada bajo el crédito de la propiedad, sin `DELETE`:
  - `GET/POST /api/propiedades/[id]/credito/registro-mensual` (historial de más reciente a más antiguo, sin paginación; alta).
  - `GET/PUT /api/propiedades/[id]/credito/registro-mensual/[periodo]` (consulta de un mes; actualización de un registro existente, nunca lo crea).
- El período viaja como `YYYY-MM` y se guarda como el día 1 del mes. Se aceptan períodos futuros y meses anteriores en cualquier orden.
- Un mes sin registro se devuelve con `registrado: false` y valores `null`; la UI muestra «No registrado». No se estima ni se arrastra ningún valor.
- Regla de fecha de pago, **más estricta que `data-model.md` §4.4**: `fecha_pago_dividendo` es obligatoria si hay dividendo y debe ser `null` si no lo hay. Se refleja en validación, spec y un CHECK de base de datos. (Requiere actualizar `data-model.md`; ver Impact.)
- La página del crédito muestra «Último saldo registrado» (UF) con su período: el registro de período máximo con saldo no nulo. Si no existe, «No registrado». Se mantiene separado del «Saldo inicial» de T02. Nunca se rotula «Saldo actual» ni se calcula o proyecta un saldo. El equivalente en CLP sigue como «No disponible» hasta T10.
- Páginas `/propiedades/[id]/credito/registro-mensual` (historial), alta y edición por período.
- Pruebas de integración solo contra `TEST_DATABASE_URL`, con verificación previa de aislamiento (distinta de `DATABASE_URL` y `DIRECT_URL`); si no puede verificarse, se detienen.

## Capabilities

### New Capabilities
- `credit-monthly-record`: alta, actualización y consulta del registro mensual de dividendo pagado (CLP) y saldo pendiente (UF) de un crédito, historial por período, mes sin registro, último saldo registrado y reglas de validación.

### Modified Capabilities
- `mortgage-management`: el alcance de T02 respecto de T03 deja de excluir el registro mensual (lo aporta `credit-monthly-record`) y la página del crédito añade el «Último saldo registrado» diferenciado del saldo inicial.

## Cumplimiento de criterios de aceptación del ticket

| AC | Estado en T03 |
|---|---|
| AC1 (E7) Dividendo (CLP) y saldo (UF) asociados al mes | Implementado completamente |
| AC2 (E8) Mes anterior devuelve sus propios valores | Implementado completamente |
| AC3 (CL11) Mes sin registro: no registrado, sin estimación ni arrastre | Implementado completamente |
| AC4 (CL12) Sin amortización calculada | Implementado completamente (no se calcula ni proyecta nada) |

## Impact

- Código nuevo: `prisma/schema.prisma` + migración, `server/schemas/credito-registro.ts`, `server/services/credito-registro-service.ts`, `app/api/propiedades/[id]/credito/registro-mensual/`, `app/propiedades/[id]/credito/registro-mensual/`, `tests/creditos/registro-*.test.ts`.
- Modificados: `server/schemas/shared.ts` (helpers de mes y entero CLP), `server/services/index.ts`, `app/propiedades/[id]/credito/page.tsx`, `tests/auth/proxy.test.ts`.
- Documentación: `docs/data-model.md` §4.4 (regla bidireccional de `fecha_pago_dividendo`; hoy solo exige fecha si hay dividendo), `docs/work-tickets.md` T03 y `readme.md` si reflejan la regla, y `prompts.md`. Es una desviación deliberada y aprobada por el usuario respecto del documento, no una contradicción accidental.
- Sin dependencias nuevas. Ningún cambio en `credito_hipotecario` ni en sus validaciones.
- Fuera de alcance: crear movimientos financieros o categoría `DIVIDENDO` (T07); agregación mensual, flujo neto y consumo de `fecha_pago_dividendo` (T09); proveedor de UF y equivalente en CLP (T10); documentos (T11); `DELETE`; seeds de registros; amortización, simulación o pagos proyectados.
