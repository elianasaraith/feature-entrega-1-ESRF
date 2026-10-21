## MODIFIED Requirements

### Requirement: Protección global de rutas sin sesión
El sistema SHALL redirigir a la pantalla de acceso cualquier solicitud de página protegida que no presente una sesión válida, y SHALL responder 401 JSON a las solicitudes a `/api/*` sin sesión válida. Las rutas `/api/auth/*` no se ven afectadas.

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
