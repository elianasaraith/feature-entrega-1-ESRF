## Why

La especificación vigente `lease-management` se contradice. `implement-rent-adjustments` estableció que los montos no exponían `DELETE` (405) ni operaciones para modificar o eliminar filas. `gestion-montos-arriendo` añadió después la corrección y la eliminación guardada de montos mediante requisitos nuevos (`ADDED`), sin modificar esos dos requisitos anteriores. La implementación expone `PUT` y `DELETE` en `.../montos/{montoId}`; el contrato, el arrendatario y la colección `.../montos` no exponen `DELETE`.

## What Changes

- Limitar la regla 405 al contrato, al arrendatario y a la colección de montos.
- Aclarar que el registro de montos no modifica ni elimina filas, y que la corrección y la eliminación son operaciones separadas.

Es una corrección documental de la especificación: no cambia el comportamiento ni el código.

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

- `lease-management`: se alinean dos requisitos con la corrección y eliminación de montos ya implementadas.

## Impact

Solo `openspec/specs/lease-management/spec.md`. Sin cambios en código, API, datos ni pruebas. Los cambios archivados no se modifican.
