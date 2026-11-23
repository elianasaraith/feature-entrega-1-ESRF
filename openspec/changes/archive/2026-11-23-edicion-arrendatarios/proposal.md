## Why

Un arrendatario solo puede crearse (`POST /api/arrendatarios` o anidado en el contrato). Un error en el nombre, RUT, email o teléfono no tiene corrección. La edición completa el alta de T04 sin tocar contratos ni historial financiero.

## What Changes

- `PUT /api/arrendatarios/{id}` actualiza `nombre`, `rut`, `email` y `telefono` (mismo esquema que el alta). El `id` no cambia.
- `GET /api/arrendatarios/{id}` devuelve un arrendatario (404 si no existe).
- Formulario de edición dentro del flujo de contratos, con enlace «Editar arrendatario» en la lista de contratos de la propiedad.
- No hay eliminación de arrendatarios (sigue sin existir `DELETE`).
- Sin cambios de esquema ni migraciones.

## Capabilities

### New Capabilities
<!-- ninguna -->

### Modified Capabilities
- `lease-management`: se añade el requisito de edición de arrendatario.

## Impact

`server/services/arrendatario-service.ts`, nueva ruta `app/api/arrendatarios/[id]/route.ts`, nueva página `app/propiedades/[id]/contratos/[contratoId]/arrendatario/editar/page.tsx` con su formulario, enlace en `app/propiedades/[id]/contratos/page.tsx`, pruebas. Sin dependencias.
