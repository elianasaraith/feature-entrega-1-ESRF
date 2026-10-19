# single-user-auth Specification

## Purpose

TBD - Purpose not yet documented for this capability.

## Requirements

### Requirement: Acceso con el usuario único
El sistema SHALL conceder acceso a la aplicación cuando se presentan el email y la contraseña correctos del usuario único creado por seed.

#### Scenario: Credenciales correctas
- **WHEN** se envían el email y la contraseña correctos del usuario sembrado
- **THEN** el sistema concede acceso y establece una sesión

#### Scenario: Credenciales incorrectas
- **WHEN** se envía un email o una contraseña que no coincide con el usuario sembrado
- **THEN** el sistema niega el acceso sin indicar cuál de los dos campos fue incorrecto

### Requirement: Protección global de rutas sin sesión
El sistema SHALL redirigir a la pantalla de acceso cualquier solicitud a una ruta protegida que no presente una sesión válida.

#### Scenario: Ruta protegida sin sesión
- **WHEN** se solicita cualquier ruta distinta de la pantalla de acceso sin una sesión válida
- **THEN** el sistema redirige a la pantalla de acceso

#### Scenario: Ruta protegida con sesión válida
- **WHEN** se solicita una ruta protegida con una sesión válida
- **THEN** el sistema permite que la solicitud continúe

### Requirement: Mecanismo reutilizable de comprobación de sesión para Route Handlers
El sistema SHALL ofrecer un mecanismo que un Route Handler pueda invocar para exigir una sesión válida antes de delegar al servicio correspondiente, como defensa en profundidad adicional a la protección global de rutas.

#### Scenario: Mecanismo invocado sin sesión
- **WHEN** el mecanismo de comprobación de sesión se invoca sin una sesión válida presente
- **THEN** devuelve una respuesta 401 sin ejecutar ninguna lógica de negocio

#### Scenario: Mecanismo invocado con sesión válida
- **WHEN** el mecanismo de comprobación de sesión se invoca con una sesión válida presente
- **THEN** devuelve la sesión, permitiendo que el llamador continúe con su lógica

### Requirement: Cierre de sesión explícito
El sistema SHALL ofrecer una acción de cierre de sesión que invalide la sesión activa.

#### Scenario: Cerrar sesión
- **WHEN** un usuario con sesión activa ejecuta la acción de cierre de sesión
- **THEN** la sesión queda invalidada y una solicitud posterior a una ruta protegida ya no se reconoce como autenticada

### Requirement: Sin registro, invitaciones, perfiles, roles ni recuperación de contraseña
El sistema SHALL NOT ofrecer ningún flujo de registro público, invitación, gestión de perfiles, roles o recuperación de contraseña.

#### Scenario: No existe ninguna de estas rutas o acciones
- **WHEN** se examina la aplicación en busca de registro público, invitaciones, gestión de perfiles, roles o recuperación de contraseña
- **THEN** ninguno de esos flujos existe ni es alcanzable

### Requirement: Contraseña almacenada solo como hash Argon2id
El sistema SHALL almacenar la contraseña del usuario único únicamente como un hash Argon2id, y SHALL NOT almacenarla ni exponerla en texto plano en ningún momento, incluyendo logs y respuestas.

#### Scenario: Persistencia de la contraseña
- **WHEN** se crea el usuario único con una contraseña
- **THEN** la base de datos almacena únicamente su hash Argon2id, nunca la contraseña en texto plano

### Requirement: Alta del usuario único por seed, idempotente y sin sobrescribir credenciales existentes
El sistema SHALL proveer un mecanismo de seed que registre al usuario único leyendo su email y contraseña desde variables de entorno, sin credenciales hardcodeadas, que pueda ejecutarse repetidamente sin duplicar al usuario ni sobrescribir sus credenciales si ya existe, y que SHALL NOT impedir que el seed de datos ficticios de la fundación se ejecute cuando las variables de autenticación están ausentes.

#### Scenario: Primera ejecución con ambas variables presentes
- **WHEN** el seed se ejecuta con `SEED_USER_EMAIL` y `SEED_USER_PASSWORD` presentes y no existe todavía ningún usuario
- **THEN** se crea el usuario único con esas credenciales, hasheando la contraseña con Argon2id

#### Scenario: Ejecución repetida no sobrescribe credenciales
- **WHEN** el seed se ejecuta de nuevo con las mismas o distintas variables de entorno y el usuario único ya existe
- **THEN** el usuario existente no se modifica, conservando sus credenciales originales

#### Scenario: Ambas variables ausentes
- **WHEN** el seed se ejecuta sin `SEED_USER_EMAIL` ni `SEED_USER_PASSWORD`
- **THEN** no se crea ningún usuario, no se produce ningún error, y el seed de propiedades ficticias de la fundación se ejecuta con normalidad

#### Scenario: Solo una variable presente
- **WHEN** el seed se ejecuta con únicamente `SEED_USER_EMAIL` o únicamente `SEED_USER_PASSWORD` presente
- **THEN** el seed informa un error claro y se detiene
