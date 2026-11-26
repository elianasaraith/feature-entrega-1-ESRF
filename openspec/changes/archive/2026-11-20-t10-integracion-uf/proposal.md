## Why

Los créditos hipotecarios se registran en UF y hoy la interfaz muestra «No disponible» junto a cada importe en UF porque no existe integración con el valor de la UF (T02, T03 y T09 lo dejaron explícitamente pendiente de T10). T10 aporta el valor de la UF por período, estable en el histórico, para mostrar el equivalente en CLP sin estimar ni reescribir cifras pasadas.

## What Changes

- Puerto `ProveedorUf` (obtener el valor de la UF de una fecha) con una implementación HTTP contra `findic.cl` (`GET /api/uf/{dd-mm-yyyy}`), con timeout y validación estricta de la respuesta.
- Nueva tabla `valor_uf_periodo` (PK `periodo`, día 1 del mes) con `valor_clp`, `fecha_valor`, `fuente` y `obtenido_en`; **una migración Prisma**. Persistencia idempotente: un valor ya almacenado nunca se sobrescribe, ni siquiera ante consultas concurrentes.
- Servicio de UF bajo demanda: lee la tabla; si falta el período, consulta al proveedor y persiste; si no hay dato o el proveedor falla, informa «no disponible» sin estimar, interpolar ni reutilizar otro período. Referencia del período: **día 1 del mes**.
- Equivalentes en CLP **opcionales** (`null` si no hay UF) calculados en el backend con `convertirUfAClp` y acompañados de la fecha de referencia de la UF usada. Referencia temporal de cada uno: cuota contractual → mes actual; saldo inicial → mes de `fechaOtorgamiento` (único campo de fecha del crédito; si es `null`, equivalente `null` sin inventar una referencia); último saldo registrado y saldo de cada registro mensual → período del registro; saldo del dashboard → mes consultado.
- Interfaz: reemplaza el texto fijo «No disponible» por el equivalente en CLP y la fecha de referencia cuando existe; «No disponible» solo cuando es `null`.
- Todos los equivalentes degradan a `null` ante UF no disponible. No se implementa error 503 de dependencia externa: no hay consumidor en T10; el criterio AC4 queda documentado para futuras operaciones.
- Sin endpoints nuevos. Sin cambios en los cálculos de ingresos, egresos, dividendos, flujo neto ni estado de pagos.

## Capabilities

### New Capabilities
- `uf-integration`: obtención del valor de la UF vía puerto/proveedor, persistencia estable por período (`valor_uf_periodo`), política del día 1, manejo de errores y reglas de no estimación.

### Modified Capabilities
- `mortgage-management`: el equivalente en CLP de cuota, saldo inicial y último saldo registrado deja de estar «No disponible hasta T10» y pasa a calcularse con la UF del período cuando existe.
- `credit-monthly-record`: la consulta del historial incluye el equivalente en CLP opcional del saldo de cada registro; ya no se prohíbe convertir el saldo (sigue prohibido persistir equivalentes en CLP).
- `financial-dashboard`: el saldo de crédito por propiedad incluye el equivalente en CLP opcional con su fecha de referencia; los totales y flujos no cambian.

## Impact

- **Código nuevo**: `server/uf/` (puerto, proveedor findic, servicio). `server/errors.ts` no cambia.
- **Código modificado**: `credito-service`, `credito-registro-service`, `dashboard-service` (DTOs con campos opcionales añadidos, retrocompatibles); páginas `app/propiedades/[id]/credito/page.tsx`, `.../registro-mensual/page.tsx` y `app/dashboard/page.tsx`.
- **Base de datos**: una tabla nueva y su migración; no se alteran tablas existentes.
- **Configuración**: variable `UF_API_BASE_URL` (con valor por defecto `https://findic.cl/api/uf`) en `.env.example`.
- **Dependencias**: ninguna nueva (`fetch` nativo, `zod` y `Prisma.Decimal` ya existen).
- **Documentación**: `docs/work-tickets.md` (T10), `docs/architecture.md` (V2, V3), `docs/data-model.md` (§8.4, P1), `readme.md` y `prompts.md`.
- **Compatibilidad**: T01–T09 no se modifican en comportamiento; los campos de DTO añadidos son nuevos y opcionales.
- **Riesgo externo**: findic.cl es una fuente no oficial sin SLA; el diseño tolera su caída mostrando «No disponible».
