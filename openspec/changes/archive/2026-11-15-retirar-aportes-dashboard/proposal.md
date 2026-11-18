## Why

El ticket T08 (aportes de capital) se canceló por decisión de producto: el MVP no registra capital aportado y el gasto de una propiedad se registra una sola vez, como egreso (T07). Los specs vigentes de `financial-dashboard` todavía hablan de «flujo neto antes de aportes» y de aportes pendientes para T08, lo que presenta como futuro algo que ya no se hará.

## What Changes

- El flujo neto pasa a nombrarse **«flujo neto»** en el spec de `financial-dashboard`. Solo cambia el nombre: la fórmula (ingresos − egresos totales), los DTO (`flujoNetoClp`) y los contratos API no cambian.
- Se retira del requisito «Dashboard de cartera» la mención a aportes de capital y T08; el escenario «Integraciones pendientes» pasa a «Integración pendiente de T10» y solo menciona el equivalente en CLP del saldo UF.
- En la interfaz, la etiqueta «Flujo neto antes de aportes» pasa a «Flujo neto» (ya aplicada en `app/_components/resumen-mensual.tsx`).
- No hay breaking changes, código nuevo ni migraciones.

Fuera de este change: el desglose de conceptos dentro de los movimientos financieros (T07), que es el siguiente objetivo confirmado y tendrá su propio change.

## Capabilities

### New Capabilities
<!-- Ninguna. -->

### Modified Capabilities
- `financial-dashboard`: «Totales mensuales por regla de caja» (nombre del flujo neto) y «Dashboard de cartera» (sin aportes ni T08 pendiente). Las fórmulas y el resto de los requisitos de T09 no cambian.

## Impact

- **Specs**: `openspec/specs/financial-dashboard/spec.md`, mediante el delta de este change. Su sección `Purpose` se actualiza a mano, porque un delta no puede modificarla.
- **Código**: solo la etiqueta de `app/_components/resumen-mensual.tsx`. Ninguna fórmula, DTO ni ruta.
- **Dependencias y base de datos**: ninguna.
