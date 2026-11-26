## Why

El historial de montos de un contrato solo crece (`POST .../montos`): un monto o reajuste mal registrado no tiene corrección. Hoy solo se puede «tapar» con otro reajuste. Hace falta corregir errores sin romper el historial financiero.

## What Changes

- `PUT /api/propiedades/{id}/contratos/{contratoId}/montos/{montoId}`: corrige el monto (y opcionalmente el motivo) de una fila existente. El período de vigencia no se edita.
- `DELETE` del mismo recurso: elimina un **reajuste** (no el monto inicial).
- Ambas operaciones solo proceden si ningún pago esperado cuyo monto cambiaría tiene abonos registrados. Si alguno los tiene, se responde 422 y no se modifica nada. Los abonos nunca se modifican ni eliminan.
- Los pagos esperados sin abonos del rango afectado se actualizan al monto que les corresponde, en la misma transacción.
- `POST .../montos` (alta de primer monto o reajuste) aplica la misma protección: 422 sin cambios parciales si cambiaría pagos con abonos; no bloquea pagos cuyo monto no cambia. Sin ajustes compensatorios.
- Interfaz: acciones «Corregir» y «Eliminar» en el historial de montos.
- Fuera de alcance y pendiente de decisión de negocio: corregir montos de períodos con abonos (ver design). Sin cambios de esquema ni migraciones.

## Capabilities

### New Capabilities
<!-- ninguna -->

### Modified Capabilities
- `lease-management`: se añaden requisitos de corrección y eliminación guardada de montos, y se modifica «Reajuste actualiza solo los montos esperados desde su período» para rechazar con 422 los reajustes que cambiarían pagos con abonos.
- `rent-payments`: se modifica «Reajustes y sincronización con abonos»: ya no se aplica «no bloquearse por su existencia»; los cambios de monto que afectarían pagos con abonos se rechazan (422).

## Impact

`server/domain/contrato-monto.ts`, `server/services/contrato-service.ts`, `server/schemas/contrato.ts`, nueva ruta `montos/[montoId]/route.ts`, `montos-panel.tsx`, pruebas. Sin dependencias ni migraciones.
