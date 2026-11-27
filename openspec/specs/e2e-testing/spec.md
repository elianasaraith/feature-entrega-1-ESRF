# e2e-testing Specification

## Purpose
Pruebas extremo a extremo con Playwright de los flujos principales de RealtyTrack, ejecutadas solo contra una base de pruebas aislada y con datos ficticios.
## Requirements
### Requirement: Flujo E2E principal con Playwright
El proyecto SHALL incluir una prueba E2E con Playwright (Chromium) que recorra, contra frontend, backend y PostgreSQL reales y sin mocks de servicios de negocio, el flujo: login válido, creación de propiedad, creación de contrato con arrendatario nuevo, registro de un pago de arriendo, comprobación del ingreso en el dashboard y cierre de sesión con comprobación del acceso protegido.

#### Scenario: Flujo completo
- **WHEN** se ejecuta `npm run test:e2e` con una base de pruebas migrada
- **THEN** el pago registrado aparece como pagado, el dashboard del mes muestra el ingreso recibido igual al monto del pago y, tras cerrar sesión, `/dashboard` redirige a `/login`

#### Scenario: Credenciales inválidas
- **WHEN** se envía el formulario de login con una contraseña incorrecta
- **THEN** se muestra el mensaje genérico de error y no se accede al dashboard

### Requirement: Escenarios E2E por área funcional
El proyecto SHALL incluir, además del flujo principal y del rechazo de credenciales, tres escenarios E2E independientes: gestión hipotecaria, gestión financiera y gestión de arriendos, cada uno con su propia propiedad y datos ficticios, y con aserciones sobre resultados y persistencia (recarga de la página), no solo sobre elementos visuales.

#### Scenario: Gestión hipotecaria
- **WHEN** se registra un crédito con 20 % de pie sobre una propiedad de 3000 UF, se edita a 25 % y se registra un dividendo mensual
- **THEN** la página del crédito muestra el pie estimado de 600 UF y luego de 750 UF tras recargar, y el registro mensual muestra el dividendo y el saldo ingresados

#### Scenario: Gestión financiera
- **WHEN** se registra un gasto de 120.000 CLP en un mes fijo y se consulta el dashboard de ese mes y de los adyacentes
- **THEN** el gasto persiste en el listado, el dashboard muestra egresos de $120.000 y flujo neto de -$120.000, y al cambiar de mes el selector, el encabezado y las cifras permanecen sincronizados

#### Scenario: Gestión de arriendos
- **WHEN** se crea un contrato de 400.000 CLP, se edita el arrendatario, se registra un reajuste a 450.000 CLP desde julio y se sincronizan los pagos
- **THEN** el arrendatario editado persiste y los pagos esperados anteriores a julio son de $400.000 y los posteriores de $450.000

### Requirement: Aislamiento y repetibilidad sobre base de pruebas
La prueba E2E SHALL ejecutarse únicamente contra la base indicada por `TEST_DATABASE_URL`, rechazando una base que coincida con `DATABASE_URL` o `DIRECT_URL` o cuyo nombre no contenga `test` o `e2e`, y SHALL dejar la base en estado conocido antes de cada ejecución.

#### Scenario: Base no aislada
- **WHEN** `TEST_DATABASE_URL` falta, apunta a la base de desarrollo o su nombre no contiene `test` ni `e2e`
- **THEN** la ejecución falla antes de escribir en cualquier base

#### Scenario: Ejecuciones consecutivas
- **WHEN** la prueba se ejecuta dos veces seguidas
- **THEN** ambas pasan, sin depender de datos ni de contadores de intentos de login de la ejecución anterior

### Requirement: Pruebas sin datos reales ni esperas artificiales
La prueba E2E SHALL usar solo datos y credenciales ficticios, selectores accesibles (rol, etiqueta o texto visible) y esperas basadas en aserciones, sin `waitForTimeout` ni `sleep`.

#### Scenario: Revisión del código de la prueba
- **WHEN** se revisa el directorio `e2e/`
- **THEN** no contiene `waitForTimeout`, `sleep`, RUT reales ni credenciales reales

#### Scenario: Servicios externos
- **WHEN** se ejecutan los escenarios
- **THEN** ninguno depende de la API de UF ni de R2

