## ADDED Requirements

### Requirement: Identidad visual y sistema de diseño compartido
La interfaz SHALL usar una identidad visual única de RealtyTrack (tema claro, sidebar azul marino #14283F, acción primaria #2563EB, positivo #059669, advertencia #D97706, negativo #DC2626, fondo #F5F7FA) definida en tokens centralizados, con componentes reutilizables para botones, tarjetas, badges, campos de formulario, tablas, alertas, estados vacío/carga/error y diálogo de confirmación. Toda la interfaz SHALL estar en español y el documento HTML SHALL declarar `lang="es"`, título y descripción de RealtyTrack.

#### Scenario: Metadata del documento
- **WHEN** se carga cualquier página
- **THEN** el HTML declara `lang="es"` y el título y la descripción corresponden a RealtyTrack

#### Scenario: Formatos centralizados
- **WHEN** se muestra un monto CLP, UF o una fecha
- **THEN** se formatea mediante las utilidades compartidas, sin alterar la precisión del dato

### Requirement: Layout autenticado y navegación
Las páginas autenticadas SHALL compartir un layout con la marca RealtyTrack, sidebar con las secciones existentes (Dashboard, Propiedades), indicador de sección activa, cierre de sesión accesible y menú móvil funcional. La navegación contextual de cada propiedad (crédito, contratos, movimientos, documentos) SHALL conservarse con sus parámetros. El login SHALL NOT usar este layout.

#### Scenario: Sección activa
- **WHEN** el usuario está en `/propiedades/{id}/credito`
- **THEN** Propiedades aparece marcada como activa en el sidebar

#### Scenario: Menú móvil
- **WHEN** el viewport es menor a 1024 px
- **THEN** el sidebar se oculta y se abre mediante un botón accesible

#### Scenario: Login sin layout
- **WHEN** se visita `/login`
- **THEN** no se muestra el sidebar autenticado

### Requirement: Dashboard con datos reales y gráficos
El dashboard SHALL mostrar ingresos, egresos, flujo neto y saldo hipotecario consolidado del mes con equivalente CLP, indicadores de consolidado parcial o no disponible, histórico de 6/12 meses con gráfico de barras (ingresos/egresos) y de evolución del flujo neto, resumen por propiedad y referencias UF, usando únicamente los datos de los servicios existentes. Un valor desconocido SHALL NOT mostrarse como cero.

#### Scenario: Saldo parcial
- **WHEN** solo algunos créditos tienen saldo registrado
- **THEN** la tarjeta indica «Consolidado parcial» con el recuento de créditos

#### Scenario: Sin saldo
- **WHEN** ningún crédito tiene saldo
- **THEN** la tarjeta indica «Sin saldo registrado» y no muestra 0 UF

### Requirement: Estados y accesibilidad de la interfaz
Los formularios SHALL tener etiquetas asociadas, botones con estados disabled/loading que impidan envíos duplicados y mensajes de error/éxito; las acciones destructivas SHALL requerir confirmación; las tablas SHALL desplazarse horizontalmente sin desbordar la página; los elementos interactivos SHALL tener foco visible. Las páginas de error y not-found SHALL seguir la identidad visual.

#### Scenario: Eliminación confirmada
- **WHEN** el usuario pulsa eliminar en un documento, movimiento, abono o monto
- **THEN** se muestra un diálogo de confirmación y solo se elimina tras confirmar

#### Scenario: Envío duplicado
- **WHEN** un formulario está enviándose
- **THEN** el botón de envío permanece deshabilitado con indicador de carga

### Requirement: Preservación del comportamiento existente
El rediseño SHALL NOT modificar contratos HTTP, reglas de negocio, cálculos financieros, autenticación, esquema de datos ni el flujo de URLs firmadas con almacenamiento de objetos.

#### Scenario: Subida de documento
- **WHEN** se sube un documento
- **THEN** se mantiene el flujo existente de URL firmada y validación de archivo
