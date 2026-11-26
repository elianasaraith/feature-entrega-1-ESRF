## ADDED Requirements

### Requirement: Listado de propiedades
El sistema SHALL listar todas las propiedades de la cartera, sin límite de cantidad ni trato diferenciado entre ellas.

#### Scenario: Cartera con propiedades
- **WHEN** un usuario autenticado solicita el listado
- **THEN** el sistema devuelve todas las propiedades registradas

#### Scenario: Cuarta propiedad
- **WHEN** se crea una propiedad en una cartera que ya tiene tres
- **THEN** aparece en el listado igual que las anteriores

### Requirement: Detalle de una propiedad
El sistema SHALL devolver los datos de una propiedad por su identificador.

#### Scenario: Propiedad existente
- **WHEN** un usuario autenticado solicita una propiedad existente
- **THEN** el sistema devuelve sus datos, con montos como texto decimal y la fecha como `YYYY-MM-DD`

#### Scenario: Propiedad inexistente
- **WHEN** se solicita un identificador que no existe o no es un UUID válido
- **THEN** el sistema responde 404

### Requirement: Alta de propiedad
El sistema SHALL crear una propiedad con número de departamento, superficie, valor de compra (monto y moneda UF o CLP) y fecha de compra; dirección, estacionamiento y bodega son opcionales.

#### Scenario: Alta completa
- **WHEN** se envían todos los datos válidos
- **THEN** el sistema responde 201 y la propiedad queda consultable

#### Scenario: Sin estacionamiento ni bodega
- **WHEN** se envía una propiedad válida sin estacionamiento ni bodega (o vacíos)
- **THEN** se crea con ambos ausentes (`null`)

### Requirement: Edición de propiedad
El sistema SHALL actualizar una propiedad existente reemplazando todos sus datos editables, con las mismas reglas de validación que el alta.

#### Scenario: Edición válida
- **WHEN** se envía un cuerpo válido para una propiedad existente
- **THEN** el sistema responde 200 con los datos actualizados

#### Scenario: Edición de propiedad inexistente
- **WHEN** se envía un cuerpo válido para un identificador inexistente
- **THEN** el sistema responde 404

### Requirement: Validación de datos de propiedad
El sistema SHALL validar la entrada con Zod antes de llegar al servicio y SHALL responder 400 con el detalle por campo cuando sea inválida, respetando las restricciones de PostgreSQL.

#### Scenario: Valores no positivos
- **WHEN** la superficie o el valor de compra es cero o negativo
- **THEN** el sistema responde 400

#### Scenario: CLP con decimales
- **WHEN** la moneda es CLP y el monto tiene parte decimal
- **THEN** el sistema responde 400

#### Scenario: Fecha no existente en el calendario
- **WHEN** la fecha de compra es `2026-02-30` o no cumple `YYYY-MM-DD`
- **THEN** el sistema responde 400

#### Scenario: Excede la precisión de la columna
- **WHEN** la superficie o el monto exceden los decimales o el rango de su columna
- **THEN** el sistema responde 400

### Requirement: Endpoints y páginas de propiedades protegidos por sesión
Los endpoints de propiedades SHALL responder 401 sin sesión válida y SHALL invocar `requireSession()` antes de delegar al servicio; las páginas de propiedades SHALL redirigir a la pantalla de acceso sin sesión.

#### Scenario: Endpoint sin sesión
- **WHEN** se invoca cualquier endpoint de `/api/propiedades` sin sesión
- **THEN** el sistema responde 401 JSON sin ejecutar lógica de negocio

#### Scenario: Página sin sesión
- **WHEN** se solicita una página de `/propiedades` sin sesión
- **THEN** el sistema redirige a la pantalla de acceso

### Requirement: Sin eliminación de propiedades
El sistema SHALL NOT exponer ninguna operación de eliminación de propiedades.

#### Scenario: DELETE no disponible
- **WHEN** se envía `DELETE /api/propiedades/{id}`
- **THEN** el sistema responde 405
