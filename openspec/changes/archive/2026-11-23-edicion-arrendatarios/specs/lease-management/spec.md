## ADDED Requirements

### Requirement: Edición de arrendatario
El sistema SHALL permitir corregir un arrendatario existente con `PUT /api/arrendatarios/{id}` y el mismo cuerpo del alta (`nombre` obligatorio; `rut`, `email` y `telefono` opcionales). El `id` SHALL conservarse y los contratos, pagos esperados, abonos e historial asociados SHALL permanecer sin cambios. El `rut`, si se informa, SHALL seguir siendo único. El sistema SHALL NOT ofrecer eliminación de arrendatarios. `GET /api/arrendatarios/{id}` SHALL devolver el arrendatario o 404.

#### Scenario: Edición exitosa
- **WHEN** un usuario autenticado envía datos válidos a `PUT /api/arrendatarios/{id}`
- **THEN** responde 200 con el arrendatario actualizado, el mismo `id` y sus contratos asociados intactos

#### Scenario: Campos opcionales vacíos
- **WHEN** se envía `rut`, `email` o `telefono` vacío
- **THEN** el campo queda en `null`

#### Scenario: RUT duplicado
- **WHEN** se edita con el `rut` de otro arrendatario
- **THEN** responde 409 y el arrendatario no cambia

#### Scenario: Conservar el propio RUT
- **WHEN** se edita sin cambiar el `rut` propio
- **THEN** responde 200

#### Scenario: Nombre inválido
- **WHEN** el nombre falta o solo tiene espacios
- **THEN** responde 400 con el error por campo

#### Scenario: Inexistente o id inválido
- **WHEN** el id no existe o no es UUID
- **THEN** responde 404

#### Scenario: Sin sesión
- **WHEN** se llama sin sesión
- **THEN** responde 401

#### Scenario: Sin eliminación
- **WHEN** se envía `DELETE /api/arrendatarios/{id}`
- **THEN** responde 405
