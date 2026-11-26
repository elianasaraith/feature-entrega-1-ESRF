## Context

T05 dejó `pago_esperado` (monto, fecha esperada, `UNIQUE(contrato_id, periodo)`) y la sincronización explícita `POST .../pagos-esperados/sincronizar`. T06 agrega el dinero recibido. Reglas ya cerradas en `data-model.md` §4.9 y §6.1: abonos sin tope, estado derivado por precedencia de cuatro reglas, fecha de completitud derivada, nada persistido. `data-model.md` también fija borrado físico y sin auditoría para el MVP.

Patrones a reutilizar: dominio puro en `server/domain/`, servicios con `createXService(prisma)` en `server/services/`, esquemas Zod en `server/schemas/`, `hoyChile()` de `server/clock.ts`, errores `NotFoundError`/`ConflictError`/`UnprocessableError` con `toHttpResponse`, bloqueo `pg_advisory_xact_lock(hashtext(propiedadId))` y montos como texto decimal.

## Goals / Non-Goals

**Goals:**
- CRUD de abonos con validación de pertenencia completa.
- Estado, saldo, fecha de completitud y calificaciones derivados por una función pura con fecha inyectada.
- Listado de pagos de un contrato con estado, reutilizable luego por T09.
- UI sencilla para listar, registrar, editar y eliminar abonos.

**Non-Goals:**
- Movimientos financieros, aportes, dashboard, conversión UF, documentos/comprobantes.
- Auditoría, papelera o borrado lógico.
- Sincronización implícita de pagos o cron.

## Decisions

**1. Rutas anidadas.** `.../contratos/{contratoId}/pagos-esperados` (GET), `.../pagos-esperados/{pagoId}/abonos` (GET, POST) y `.../abonos/{abonoId}` (PUT, DELETE). Mantiene el patrón de T05 y permite validar la cadena abono → pago → contrato → propiedad. Alternativa descartada: `POST /api/abonos` (architecture.md §19) y `/api/pagos-esperados/{id}/abonos` (readme): pierden el contexto de propiedad. Se actualizan esos documentos.

**2. Modelo `AbonoArriendo`.** Campos `id`, `pagoEsperadoId`, `montoClp Decimal(14,0)`, `fechaRecepcion Date`, `medio String?`, `createdAt`, `updatedAt`. FK `onDelete: Restrict`, `CHECK (monto_clp > 0)` en la migración, índice `(pago_esperado_id)` e índice por `fecha_recepcion` para T09. Sin columnas de estado.

**3. Dominio puro `calcularEstadoPago`.** Entrada: `montoEsperado`, `fechaEsperada`, abonos `{montoClp, fechaRecepcion, createdAt, id}` y `hoy` (YYYY-MM-DD). Salida: `recibido`, `saldo` (`max(esperado - recibido, 0)`), `estado`, `fechaCompletitud | null`, `vencidoConAbonosParciales`, `pagadoConAtraso`. Fechas como cadenas `YYYY-MM-DD` (comparación lexicográfica) para evitar desfases de zona horaria; montos como `bigint` (CLP enteros), nunca `number` flotante ni cálculo en componentes. La precedencia de reglas resuelve CL11–CL14 sin ramas especiales.

**4. Validación 422.** Zod valida formato (monto numérico, fecha `YYYY-MM-DD`) → 400. El monto <= 0 y la fecha futura son reglas de negocio y las lanza el servicio como `UnprocessableError` → 422, comparando con `hoyChile()` inyectado. Se aplican igual en alta y edición. Se acepta `fechaRecepcion` igual a hoy.

**5. Edición y eliminación simples.** `PUT` reemplaza monto, fecha y medio; el `pagoEsperadoId` no es editable. `DELETE` es físico (coherente con `data-model.md`), `204`. Implicación: no queda rastro de un abono eliminado o corregido; el usuario único asume ese riesgo y la UI pide confirmación. Auditoría y borrado lógico quedan fuera del MVP, como ya documenta el modelo.

**6. Concurrencia.** Alta, edición y eliminación toman `pg_advisory_xact_lock` por propiedad, igual que T04/T05, y validan pertenencia dentro de la transacción. Es suficiente para un único usuario.

**7. Un servicio nuevo `pago-service`.** Expone `listarPagos(propiedadId, contratoId, hoy)`, `listarAbonos`, `crearAbono`, `editarAbono`, `eliminarAbono`. Lee `pago_esperado` sin modificarlo y no invoca la sincronización: la UI mantiene el botón de T05. El resolvedor de pertenencia se comparte entre operaciones. El listado devuelve DTO con montos como texto.

**8. UI.** Página `/propiedades/[id]/contratos/[contratoId]/pagos` (server component que consulta el servicio) con un panel cliente: tabla de pagos con estado y saldo, formulario para registrar abono, edición en línea y eliminación con `confirm`. Enlazada desde la lista de contratos y desde la página de montos. Sin cálculo financiero en componentes: solo muestran lo que devuelve el servicio.

## Estrategia de pruebas de la API

Los Route Handlers solo componen `requireSession` + esquema Zod + servicio + `toHttpResponse`, y `requireSession` no puede invocarse fuera del runtime de Next.js. Por eso no hay pruebas que llamen directamente a los handlers. La cobertura se reparte así: esquema y mapeo de errores a HTTP (400, 404, 422) en `tests/pagos/abono-schema.test.ts`; reglas de negocio y pertenencia contra PostgreSQL en el servicio; y el 401 sin sesión por ruta en `tests/auth/proxy.test.ts`, porque lo responde `proxy.ts`. Mismo criterio que T04 y T05.

## Risks / Trade-offs

- [Borrado físico sin auditoría: un abono mal eliminado se pierde] → confirmación en UI; decisión coherente con `data-model.md`; fácil de revertir añadiendo borrado lógico después.
- [Desfase de un día entre `hoy` y `DATE`] → cadenas `YYYY-MM-DD` y `hoyChile()`; pruebas con fecha esperada igual, anterior y posterior a hoy.
- [Prisma `Decimal` y flotantes] → convertir a `bigint` en el límite del dominio; pruebas con montos grandes.
- [Reajuste que deja abonos "sobrantes"] → se admiten; no hay restricción de tope.
- [T09 necesita sumar abonos por `fecha_recepcion`] → índice creado ahora; la forma de la consulta se decide en T09.
- [Plazo corto] → si hay que recortar, se reduce la UI (sin edición en línea) y se mantienen dominio, API y pruebas.

## Migration Plan

Una migración Prisma que crea `abono_arriendo` con su `CHECK` e índices; no toca tablas existentes ni datos. Rollback: eliminar la tabla (no hay datos previos). Se actualizan el seed y `docs/` sin datos reales.

## Open Questions

Ninguna bloqueante. Supuestos registrados: `fechaRecepcion` no se valida contra el inicio del contrato; la edición usa `PUT` completo; no hay paginación en los listados (volumen bajo).
