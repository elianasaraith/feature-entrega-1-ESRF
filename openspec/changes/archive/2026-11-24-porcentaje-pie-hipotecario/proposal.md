## Why

El pie (pago inicial como porcentaje del valor de compra) es un dato que el propietario maneja al hablar de su crédito hipotecario, pero hoy el sistema no lo registra. Se incorpora como dato **informado**, opcional y sin efecto sobre ningún cálculo financiero.

## What Changes

- Nuevo campo opcional `porcentaje_pie` (`DECIMAL(5,2)`, API `porcentajePie`) en `credito_hipotecario`, con `CHECK` entre 0 y 100. `null` = no informado; `0` = pie de 0 %.
- Migración no destructiva (`ADD COLUMN` nullable, sin `DEFAULT`, sin backfill): los créditos existentes quedan en `null`.
- Alta, edición y consulta del crédito incorporan `porcentajePie`. La consulta solo **añade** campos (`porcentajePie`, `pieEstimado`); ninguno previo cambia.
- Formularios de crear/editar: campo «Porcentaje de pie (%)», opcional, con texto de ayuda; permite registrar, editar y quitar (vacío → `null`).
- Detalle del crédito: porcentaje de pie («No informado» si es `null`, nunca 0 %), monto estimado del pie sobre el valor de compra de la propiedad en su moneda original, y barra pie / resto del valor de compra.
- Cálculo del monto estimado como función pura de dominio con aritmética decimal.

Fuera de alcance: deducir el pie desde el monto original del crédito, modificar montos contractuales, dividendos, saldos, UF, pagos o dashboard, contabilizar el pie como egreso, nuevas dependencias.

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

- `mortgage-management`: el crédito admite `porcentajePie` opcional (validación, persistencia, API) y el detalle/formularios lo presentan.

## Impact

- `prisma/schema.prisma` y nueva migración SQL (aplicación local manual; este change no ejecuta migraciones).
- `server/schemas/credito.ts`, `server/services/credito-service.ts`, nuevo `server/domain/credito-pie.ts`.
- `app/propiedades/[id]/credito/` (formulario, detalle, componente de barra), `app/_lib/format.ts`.
- `docs/data-model.md`, `docs/diagrams/data-model.mmd`, `readme.md`, `prompts.md`.
- Sin nuevas dependencias. Sin cambios en `rediseno-frontend`.
