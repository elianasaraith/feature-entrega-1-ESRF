## Why

Hoy el propietario debe consolidar a mano qué ocurrió financieramente en un mes, aunque los hechos ya están registrados en T03 (créditos), T06 (abonos) y T07 (movimientos). T09 cierra el MVP con un dashboard mensual de cartera y un resumen mensual en el detalle de cada propiedad, calculados al consultar, sin persistir derivados.

## What Changes

- Nueva página `/dashboard` (cartera) con selector mensual: ingresos recibidos, dividendos pagados, otros egresos, egresos totales, flujo neto antes de aportes, estado de pagos esperados del mes contractual, saldo de créditos en UF y resumen agregado por propiedad (sin rankings).
- `/propiedades/[id]` pasa a este orden: datos y botón Editar → resumen financiero del mes (ingresos, dividendos, otros egresos, flujo neto) → actividad reciente del mes (abonos, dividendos, movimientos; descendente, con enlaces) → accesos a crédito, contratos y movimientos. Selector de mes (pasados y futuros).
- Nuevo `dashboard-service` único, usado por cartera y propiedad, más dos lecturas REST: `GET /api/dashboard?mes=YYYY-MM` y `GET /api/propiedades/{id}/resumen-mensual?mes=YYYY-MM`, protegidas por sesión.
- Nueva función de dominio pura para flujo neto, formato de importes (CLP con miles, UF hasta 4 decimales) y selección del saldo aplicable.
- Sin migraciones, tablas de resumen, vistas materializadas ni cachés. Sin aportes de capital (T08) ni conversión UF→CLP (T10): sus integraciones quedan documentadas como pendientes y la interfaz no muestra ceros ni valores inventados para ellas.

## Capabilities

### New Capabilities
- `financial-dashboard`: agregación mensual por regla de caja (cartera y propiedad), estado de pagos del mes contractual, saldo de créditos en UF por período, actividad reciente y sus dos endpoints de lectura.

### Modified Capabilities
- `property-management`: el detalle de la propiedad incorpora el resumen financiero mensual y la actividad reciente, con orden de secciones definido.

## Impact

- Código nuevo: `server/services/dashboard-service.ts` (registrado en `server/services/index.ts`), `server/domain/dashboard.ts`, esquema de query reutilizando `yearMonth`, rutas bajo `app/api/dashboard/` y `app/api/propiedades/[id]/resumen-mensual/`, UI en `app/dashboard/` y componentes de resumen/actividad compartidos.
- Código modificado: `app/propiedades/[id]/page.tsx`, `app/page.tsx` (enlace al dashboard).
- Lectura de `abono_arriendo`, `pago_esperado`, `contrato_arriendo`, `credito_registro_mensual`, `movimiento_financiero`. Sin cambios de esquema Prisma.
- Docs: marcar T09 como implementado en `docs/work-tickets.md` y propagar al `readme.md` al archivar.
- Fuera de alcance: T08 (aportes), T10 (UF→CLP), comparación entre propiedades, proyecciones.
