## Why

T04 dejó contratos de arriendo con monto inicial **opcional** y sin forma de registrarlo después, reajustarlo ni generar lo que se espera cobrar cada mes. Sin historial de montos y sin `pago_esperado`, T06 (abonos y estado del pago) no tiene a qué anclarse, y el dashboard (T09) no puede comparar esperado contra recibido. T05 cierra esa brecha: registra el primer monto, los reajustes y el monto vigente por período, y genera los pagos esperados de forma explícita e idempotente.

## What Changes

- **Primer monto tardío.** Un contrato sin filas en `contrato_monto` (alta de T04 sin monto) recibe su primer monto con `vigente_desde_periodo` igual al mes de `fecha_inicio` (`data-model.md` §5.1, regla 4). Cierra la excepción temporal de §4.7.
- **Reajustes.** Cada reajuste agrega una fila en `contrato_monto`; nunca se sobrescribe ni se elimina una fila anterior. Período anterior al inicio del contrato o posterior al término → 422; período ya registrado → 409. No se permiten reajustes posteriores al mes de `fecha_termino`.
- **Monto vigente** de un período: función pura de dominio sobre las filas (mayor `vigente_desde_periodo <= período`), expuesta por la consulta del historial.
- **Nueva tabla `pago_esperado`** (modelo Prisma `PagoEsperado`), con `UNIQUE(contrato_id, periodo)` y CHECK en una migración SQL incremental (solo se escribe; no se aplica en esta propuesta).
- **Reajuste → pagos esperados existentes.** En la misma transacción, `monto_esperado_clp` se actualiza **solo** en los pagos ya existentes con `periodo >= vigente_desde_periodo`, calculando cada uno sobre todas las filas (un reajuste anterior no pisa a uno posterior). Los períodos anteriores conservan su monto. `updated_at` se actualiza siempre que cambie `monto_esperado_clp`. El reajuste no crea pagos.
- **Sincronización explícita e idempotente** (`POST .../pagos-esperados/sincronizar`): crea los pagos faltantes desde el mes de inicio del contrato —siempre que exista un monto registrado— hasta `min(mes en curso, mes de fecha_termino)`. Sin cron; ningún GET escribe; repetirla no cambia nada y nunca borra ni modifica pagos existentes.
- **API** bajo `/api/propiedades/[id]/contratos/[contratoId]/`: `GET/POST montos` y `POST pagos-esperados/sincronizar`. El PUT de contrato sigue sin aceptar monto.
- **Interfaz obligatoria:** página `/propiedades/[id]/contratos/[contratoId]/montos` para registrar el primer monto, reajustar, consultar el historial y el monto vigente, y sincronizar pagos esperados; enlace «Montos» desde la lista de contratos.
- **Coherencia al editar contrato (propuesta a validar):** el PUT rechaza con 409 acortar `fecha_termino` a un mes anterior al de la última fila de `contrato_monto` o del último `pago_esperado`, para no violar `data-model.md` §5.1 (reglas 4 y 5).
- **Documentación:** se registra cómo se comportarán los reajustes cuando T06 tenga abonos (sin implementarlo).
- Pruebas unitarias (dominio, esquema) e integración solo contra `realtytrack_test`.

## Capabilities

### New Capabilities
<!-- Ninguna: T05 extiende lease-management. -->

### Modified Capabilities
- `lease-management`: reemplaza la prohibición de operar sobre `contrato_monto` por el registro del primer monto y de reajustes con histórico inmutable; la edición de contrato añade el 409 por inconsistencia con montos/pagos; las consultas exponen el monto vigente; añade generación de pagos esperados y su sincronización explícita; el alcance acotado pasa de T04 a T05 (sigue excluyendo abonos, estado de pago y movimientos).

## Cumplimiento de criterios de aceptación del ticket

| AC | Cobertura en T05 |
|---|---|
| AC1 (E3) Reajuste sin crear contrato nuevo | El contrato conserva id, arrendatario y garantía; el monto vigente cambia desde el período |
| AC2 (E4) Un mes anterior conserva el monto que regía | Los pagos de períodos anteriores no se tocan; `montoVigenteEn` respeta el histórico |
| AC3 (E5) Reajuste retroactivo | Se actualiza `monto_esperado_clp` desde el período. **El estado no se recalcula en T05**: es derivado y depende de abonos (T06) |
| AC4 (CL15) Mes sin contrato vigente | No existe fila de `pago_esperado` fuera de la vigencia del contrato; la ausencia no es impago |

## Impact

- Código nuevo: migración `add_pago_esperado`, `server/domain/contrato-monto.ts`, ampliación de `server/schemas/contrato.ts` y `server/services/contrato-service.ts`, rutas `app/api/propiedades/[id]/contratos/[contratoId]/{montos,pagos-esperados/sincronizar}/`, página y formulario de montos, `tests/contratos/`.
- Modificados: `prisma/schema.prisma` (modelo `PagoEsperado` y relación inversa), `app/propiedades/[id]/contratos/page.tsx` (enlace), `tests/auth/proxy.test.ts`.
- Documentación: `docs/work-tickets.md` (T05/T06), `docs/data-model.md` §4.7/§4.8, `readme.md` si refleja T05, y `prompts.md`.
- Sin dependencias nuevas. No se modifica `.env`. Migraciones: solo escritas; aplicarlas (también a `realtytrack_test`) requiere aprobación explícita en la fase apply.
- Fuera de alcance: abonos y estado/saldo del pago (T06), movimientos y aportes (T07, T08), dashboard (T09), documentos (T11), prorrateo intramensual, edición o borrado de filas de monto, generación automática (cron o desde un GET), recálculo de pagos al cambiar `dia_esperado_pago`.
