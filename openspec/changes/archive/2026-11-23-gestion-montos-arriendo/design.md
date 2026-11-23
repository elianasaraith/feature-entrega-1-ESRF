## Context

`registrarMonto` agrega una fila y reescribe `monto_esperado_clp` de los pagos esperados existentes desde su período (comportamiento vigente, sin cambios aquí). `pago_esperado` tiene `abono_arriendo` dependientes; el estado de un pago se deriva y no se persiste. Escrituras sobre un contrato usan el bloqueo advisory por propiedad (`conBloqueoDePropiedad`), igual que los abonos.

## Goals / Non-Goals

**Goals:** corregir o eliminar un monto/reajuste erróneo con garantías: abonos intactos, períodos con abonos intactos, nada de cambios silenciosos.
**Non-Goals:** editar el período de vigencia, eliminar el monto inicial, modificar abonos, ajustes compensatorios, cualquier regla para períodos con abonos.

## Decisions

- **Regla de seguridad:** una corrección es segura si ningún pago esperado cuyo monto cambiaría tiene abonos. Función pura `pagosQueCambian(filasNuevas, pagos)` en el dominio: para cada pago con período ≥ `vigenteDesde` de la fila, calcula `montoVigenteEn(filasNuevas, periodo)` y devuelve los que difieren del monto esperado actual. Así solo se evalúa y se toca el rango gobernado por la fila corregida (el resto, y los períodos anteriores, no cambian).
- **Bloqueo:** si algún pago afectado tiene abonos → `UnprocessableError` (422) que enumera los períodos, sin escribir nada.
- **Corregir (PUT):** actualiza `monto_mensual_clp` (y `motivo` si viene) de la fila, y los pagos afectados sin abonos. Un cambio sin efecto sobre pagos (p. ej. sin pagos creados aún) solo actualiza la fila.
- **Eliminar (DELETE):** permitido solo para una fila que no sea la de menor `vigenteDesde` (monto inicial → 422: corríjalo). Los pagos afectados pasan al monto de la fila anterior vigente. Mismo bloqueo por abonos.
- **Transacción y bloqueo:** todo dentro de `conBloqueoDePropiedad`, 404 para fila inexistente o de otro contrato.
- **Respuesta:** `{ monto, pagosActualizados }` en PUT; `{ eliminado: true, pagosActualizados }` en DELETE.
- **UI:** edición en línea y confirmación en el historial; los errores del servidor (422) se muestran tal cual.

- **`registrarMonto` protegido:** antes de crear la fila se calcula `pagosAfectados` con la lista de filas más la candidata; si algún pago que cambiaría tiene abonos → 422 sin escribir. Después se crea la fila y se actualizan solo los pagos que cambian. Reutiliza el mismo helper que corregir/eliminar (una sola regla).
- **Concurrencia:** el registro de abonos, la corrección/eliminación y `registrarMonto` usan el mismo `pg_advisory_xact_lock(hashtext(propiedadId))` dentro de una transacción; comprobar abonos y escribir ocurren con el bloqueo tomado, de modo que un abono concurrente espera o bloquea el reajuste, nunca se intercala.

## Escenario pendiente (decisión de negocio, no implementado)

Corregir o eliminar un monto cuyo rango incluye pagos con abonos exige definir una regla financiera (p. ej. mantener el esperado histórico y aplicar la corrección solo hacia adelante, o un ajuste compensatorio). No se decide aquí: la operación se rechaza con 422. El `registrarMonto` ya queda sometido a la misma regla (decisión confirmada por el usuario).

## Risks / Trade-offs

- [Eliminar es un borrado físico de un registro histórico] → solo reajustes, solo sin abonos afectados, dentro de transacción con bloqueo.
- [Un pago sin abonos cambia de monto esperado, incluso vencido] → coherente con `registrarMonto`; los estados se derivan, no hay datos persistidos que corregir.
