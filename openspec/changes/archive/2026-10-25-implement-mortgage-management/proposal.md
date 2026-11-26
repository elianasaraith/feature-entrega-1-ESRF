## Why

T02 ("Alta y condiciones del crédito hipotecario") es el siguiente ticket de HU01. Con propiedades (T01) y acceso protegido (T12) ya archivados, falta registrar las condiciones contractuales del crédito de una propiedad, que conservan su unidad natural en UF. Es prerrequisito de T03 (registro mensual de dividendo y saldo) y de T11 (documentos del crédito).

## What Changes

- Nueva tabla `credito_hipotecario` (modelo Prisma `CreditoHipotecario`), relación 1 : 0..1 con `Propiedad` mediante `UNIQUE(propiedad_id)`, con los CHECK de `docs/data-model.md` §4.3 en una migración SQL incremental.
- API REST anidada bajo la propiedad: `GET/POST/PUT /api/propiedades/[id]/credito`. Sin borrado.
  - `POST` → 201; 409 si la propiedad ya tiene crédito.
  - `PUT` actualiza solo un crédito existente; propiedad sin crédito → 404.
- Validación de entrada con Zod alineada con `data-model.md` §4.3 (sin reglas nuevas), preservando precisión decimal en montos UF y tasa.
- Servicio `credito-service` y `ConflictError` → 409 en el punto único de traducción de errores.
- Función pura de dominio UF → CLP, usada solo con valores fijos en pruebas unitarias. La UI muestra el equivalente como «No disponible» hasta integrar T10.
- Páginas `/propiedades/[id]/credito` (consulta, o aviso de que no hay crédito), alta y edición; enlace desde el detalle de la propiedad.
- Corrección documental: `architecture.md` §6 menciona `app/creditos/` para el registro mensual (T03); las pantallas del crédito de T02 viven bajo `app/propiedades/[id]/credito` según el ticket.

## Capabilities

### New Capabilities
- `mortgage-management`: alta, consulta y edición del crédito hipotecario de una propiedad, con condiciones en UF, y conversión UF → CLP como función pura.

### Modified Capabilities
<!-- Ninguna: no cambian requisitos de property-management ni single-user-auth. -->

## Cumplimiento de criterios de aceptación del ticket

| AC | Estado en T02 |
|---|---|
| AC1 (E4) Crédito asociado únicamente a su propiedad | Implementado completamente |
| AC2 (E5) Cuota y saldo en UF | Implementado completamente (cuota y saldo inicial en UF) |
| AC3 (E6) Equivalente en CLP con `valor_uf_periodo` sin reemplazar la UF | **Parcial**: se entrega la función pura (probada con valor fijo) y la UI «No disponible». **Pendiente de integración con T10**; no se considera satisfecho |
| AC4 (CL10) Propiedad sin crédito válida | Implementado completamente |

## Impact

- Código nuevo: `prisma/schema.prisma` + migración, `server/schemas/credito.ts`, `server/domain/uf.ts`, `server/services/credito-service.ts`, `app/api/propiedades/[id]/credito/`, `app/propiedades/[id]/credito/`.
- Modificados: `server/errors.ts` (`ConflictError`), `server/services/index.ts`, detalle de propiedad (enlace), `docs/architecture.md` §6 y `readme.md` si reflejan la ruta.
- Sin dependencias nuevas.
- Fuera de alcance: registro mensual, dividendo pagado en CLP, saldo actual derivado (T03); proveedor y tabla de UF (T10); documentos (T11); dashboard (T09); amortización o simulación; borrado del crédito.
