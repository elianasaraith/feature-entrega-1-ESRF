## ADDED Requirements

### Requirement: Resumen financiero mensual en el detalle de la propiedad
La página `/propiedades/[id]` SHALL mostrar, en este orden: (1) datos generales y botón Editar; (2) resumen financiero del mes seleccionado con ingresos recibidos, dividendos pagados, otros egresos y flujo neto; (3) actividad reciente del mes; (4) accesos a crédito hipotecario, contratos y movimientos financieros. El mes SHALL elegirse con selector (`?mes=YYYY-MM`), por defecto el de `hoyChile()`, permitiendo meses pasados y futuros; un `mes` inválido SHALL usar el mes por defecto. Las cifras SHALL provenir del `dashboard-service`.

#### Scenario: Orden de secciones
- **WHEN** se abre el detalle de una propiedad
- **THEN** aparecen datos y Editar, resumen del mes, actividad reciente y accesos, en ese orden

#### Scenario: Mes anterior
- **WHEN** el usuario selecciona un mes anterior
- **THEN** resumen y actividad corresponden a ese mes

#### Scenario: Mes inválido en la URL
- **WHEN** la URL trae `?mes=xx`
- **THEN** se usa el mes actual de Chile sin error

#### Scenario: Cambios reflejados
- **WHEN** se registra, edita o elimina un abono, dividendo o movimiento y se vuelve al detalle
- **THEN** resumen y actividad reflejan el cambio sin recarga manual
