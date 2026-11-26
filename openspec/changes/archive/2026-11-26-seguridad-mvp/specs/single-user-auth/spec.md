## ADDED Requirements

### Requirement: Límite de intentos de acceso persistente por cuenta e IP
El sistema SHALL limitar los intentos de acceso con un almacén en PostgreSQL compartido entre instancias serverless: 5 intentos por cuenta y 20 por IP en una ventana fija de 15 minutos. Cada intento SHALL reservarse con una operación atómica antes de verificar la contraseña, de modo que solicitudes concurrentes no superen el límite. Superado el límite por IP, el sistema SHALL denegar el acceso sin verificar la contraseña. Superado el límite de la cuenta, el sistema SHALL denegar el acceso sin verificar nunca la contraseña contra el hash de la cuenta, ejecutando una verificación Argon2id contra el hash de relleno para que el intento bloqueado tarde lo mismo que uno evaluado (el coste queda acotado por el límite por IP). En ambos casos SHALL usar el mismo mensaje genérico que un fallo de credenciales, indicando solo que se reintente más tarde, hasta que expire la ventana. Un acceso correcto SHALL reiniciar el contador de la cuenta. Los intentos con un email inexistente SHALL contarse contra la IP y contra una cuenta genérica compartida, de modo que el almacén no crezca con emails arbitrarios. El almacén SHALL guardar solo claves derivadas con hash (nunca el email ni la IP en claro), SHALL expirar automáticamente los bloqueos y SHALL eliminar de forma acotada los registros vencidos.

#### Scenario: Bloqueo de cuenta tras 5 intentos
- **WHEN** se realizan 6 intentos de acceso a la misma cuenta dentro de 15 minutos
- **THEN** el sexto se deniega sin verificar la contraseña contra el hash de la cuenta, incluso si esa contraseña fuera la correcta

#### Scenario: Bloqueo por IP incluyendo usuarios inexistentes
- **WHEN** una misma IP realiza 21 intentos en 15 minutos con emails distintos, existentes o no
- **THEN** el intento 21 se deniega sin verificar la contraseña

#### Scenario: Intentos concurrentes
- **WHEN** se lanzan 50 intentos simultáneos contra la misma cuenta
- **THEN** como máximo 5 se verifican contra el hash de la cuenta y el resto se deniega por límite

#### Scenario: Expiración del bloqueo
- **WHEN** transcurren 15 minutos desde el inicio de la ventana
- **THEN** el contador se reinicia y el siguiente intento se evalúa con normalidad

#### Scenario: Acceso correcto reinicia la cuenta
- **WHEN** el usuario accede con credenciales correctas antes de superar el límite
- **THEN** el contador de la cuenta vuelve a cero

#### Scenario: Sin registros ilimitados
- **WHEN** se prueban 1000 emails inexistentes distintos desde una IP
- **THEN** el número de filas creadas no crece por email y el almacén no guarda ningún email ni IP en claro

#### Scenario: Fallo de PostgreSQL
- **WHEN** el almacén de intentos no está disponible o la reserva del intento falla
- **THEN** el acceso se deniega (cierre por defecto) con el mismo mensaje genérico, no se verifica la contraseña y el error se registra sin datos personales

#### Scenario: Limpieza acotada
- **WHEN** existen registros cuya ventana venció hace más de un día
- **THEN** cada intento, incluso los denegados, elimina como máximo un número fijo de ellos

### Requirement: IP de cliente tomada de una fuente confiable
El sistema SHALL obtener la IP del cliente para el límite de intentos únicamente de la cabecera que la plataforma de despliegue sobrescribe (`x-vercel-forwarded-for` en Vercel) y SHALL ignorar `x-forwarded-for` y `x-real-ip` enviados por el cliente. Fuera de la plataforma de despliegue (desarrollo y pruebas), todas las solicitudes SHALL compartir un cubo local.

#### Scenario: Cabecera manipulada
- **WHEN** un cliente envía `X-Forwarded-For` con IPs arbitrarias
- **THEN** esas IPs no se usan para contar ni para evadir el límite

#### Scenario: Rotación de direcciones IPv6
- **WHEN** un cliente rota entre direcciones del mismo bloque /64
- **THEN** todas cuentan contra el mismo límite

#### Scenario: Sin cabecera de plataforma en producción
- **WHEN** la solicitud llega en producción sin la cabecera de la plataforma
- **THEN** se cuenta contra un cubo compartido y no se omite el límite

### Requirement: Mitigación de enumeración de usuarios
El sistema SHALL ejecutar la verificación de contraseña Argon2id también cuando el email no existe, contra un hash Argon2id válido de contraseña desconocida, y SHALL responder con el mismo mensaje y estado genéricos en ambos casos.

#### Scenario: Email inexistente
- **WHEN** se intenta acceder con un email que no existe
- **THEN** el sistema ejecuta una verificación Argon2id contra el hash de relleno y deniega con el mismo mensaje que una contraseña incorrecta

#### Scenario: Normalización del email
- **WHEN** el email llega con espacios o distinta capitalización
- **THEN** se normaliza (recorte y minúsculas, longitud máxima 254) antes de buscar al usuario y de derivar claves, y un email más largo se deniega sin consultar la base

#### Scenario: Tiempos comparables
- **WHEN** se comparan los tiempos de respuesta de un email inexistente y de un email existente con contraseña incorrecta, ambos fuera de bloqueo
- **THEN** ambos ejecutan una verificación Argon2id y la diferencia no es atribuible a la ausencia del usuario

#### Scenario: Mensaje idéntico
- **WHEN** se comparan las respuestas por email inexistente y por contraseña incorrecta
- **THEN** son indistinguibles en mensaje y código

### Requirement: Sesión de 8 horas con expiración absoluta
La sesión SHALL durar 8 horas contadas desde el inicio de sesión y SHALL NOT renovarse más allá de ese plazo: el sistema SHALL registrar el instante de autenticación en el token y SHALL tratar como no autenticada cualquier sesión cuyo instante de autenticación supere las 8 horas, aunque la cookie siga vigente.

#### Scenario: Sesión dentro del plazo
- **WHEN** se solicita una ruta protegida 7 horas después del inicio de sesión
- **THEN** la sesión sigue siendo válida

#### Scenario: Token anterior al cambio
- **WHEN** llega un token de sesión sin instante de autenticación
- **THEN** se trata como no autenticado, porque su fecha de emisión se renueva en cada lectura y lo haría renovable sin límite

#### Scenario: Sesión vencida
- **WHEN** se solicita una ruta protegida 9 horas después del inicio de sesión, aunque haya habido actividad intermedia
- **THEN** la solicitud se trata como no autenticada

### Requirement: Comprobación de sesión en layouts privados
Los layouts de las secciones privadas (`/dashboard` y `/propiedades`) SHALL verificar la sesión por sí mismos y redirigir a la pantalla de acceso si no existe, como defensa en profundidad adicional a la protección del proxy. Las comprobaciones de sesión de los Route Handlers SHALL conservarse.

#### Scenario: Proxy omitido
- **WHEN** una página privada se renderiza sin sesión aunque el proxy no la haya interceptado
- **THEN** el layout redirige a la pantalla de acceso sin renderizar datos privados

#### Scenario: Endpoints conservan su comprobación
- **WHEN** un Route Handler recibe una solicitud sin sesión
- **THEN** responde 401 aunque el proxy no la haya interceptado

## MODIFIED Requirements

### Requirement: Protección global de rutas sin sesión
El sistema SHALL redirigir a la pantalla de acceso cualquier solicitud de página protegida que no presente una sesión válida, y SHALL responder 401 JSON a las solicitudes a `/api/*` sin sesión válida. Las rutas `/api/auth/*` no se ven afectadas. El patrón de exclusión del proxy SHALL ser exacto (la pantalla de acceso, `/api/auth/` y los recursos estáticos de Next.js) y SHALL NOT excluir rutas por mero prefijo, de modo que una ruta futura como `/login-admin` o `/api/authx` quede protegida.

#### Scenario: Ruta protegida sin sesión
- **WHEN** se solicita cualquier página distinta de la pantalla de acceso sin una sesión válida
- **THEN** el sistema redirige a la pantalla de acceso

#### Scenario: API sin sesión
- **WHEN** se solicita una ruta `/api/*` (distinta de `/api/auth/*`) sin una sesión válida
- **THEN** el sistema responde 401 con cuerpo JSON y no redirige

#### Scenario: Rutas de autenticación intactas
- **WHEN** se solicita `/api/auth/*` sin sesión
- **THEN** la solicitud llega a Auth.js como antes

#### Scenario: Ruta protegida con sesión válida
- **WHEN** se solicita una ruta protegida con una sesión válida
- **THEN** el sistema permite que la solicitud continúe

#### Scenario: Rutas con prefijo parecido
- **WHEN** se solicita `/login-admin`, `/api/authx` o `/favicon.ico.bak` sin sesión
- **THEN** el proxy las trata como protegidas
