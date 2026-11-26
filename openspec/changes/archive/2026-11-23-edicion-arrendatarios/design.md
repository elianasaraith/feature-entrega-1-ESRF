## Context

`arrendatarioService` solo tiene `listar` y `crear`. El esquema `arrendatarioInputSchema` y el 409 por RUT duplicado (`P2002`) ya existen. Los contratos referencian al arrendatario por `arrendatario_id`.

## Goals / Non-Goals

**Goals:** corregir los datos de un arrendatario existente reutilizando esquema, errores y verificación de existencia.
**Non-Goals:** eliminar arrendatarios, módulo administrativo propio, cambiar contratos, pagos o abonos.

## Decisions

- **Servicio:** `actualizar(id, input)` usa `asegurarArrendatario` (404 para id inexistente o no UUID) y un `update` por `id`; `P2002` → `ConflictError(RUT_DUPLICADO)`. Mismo cuerpo completo que el alta (PUT, semántica de reemplazo; `optionalText` normaliza vacíos a `null`). Solo se escriben los cuatro campos, de modo que `id`, `createdAt` y los contratos no cambian.
- **API:** ruta `/api/arrendatarios/[id]` con `GET` y `PUT`, ambos con `requireSession` y `toHttpResponse`. No se exporta `DELETE` (405).
- **UI:** se edita desde el contrato (el arrendatario del contrato) para no crear un módulo aparte: página `/propiedades/[id]/contratos/[contratoId]/arrendatario/editar` y formulario cliente con el patrón de `ContratoForm`.

## Risks / Trade-offs

- [Editar el nombre cambia lo que muestran todos los contratos de ese arrendatario] → es el comportamiento buscado (corrección de datos, no historial versionado).
- [RUT duplicado] → 409 con el mensaje existente; no se modifica nada.
