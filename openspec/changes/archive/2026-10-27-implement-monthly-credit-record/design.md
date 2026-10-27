## Context

T01 (propiedades), T02 (crédito) y T12 (auth) existen. Patrones vigentes que T03 reutiliza: Zod por entidad en `server/schemas/` con helpers en `shared.ts` (`positiveDecimal`, `nonNegativeDecimal`, `isRealCalendarDate`), servicio con Prisma inyectado (`createCreditoService`), `toHttpResponse` como único punto de traducción de errores (400/404/409/500), handlers delgados con `requireSession()`, lecturas en Server Components dentro de `<Suspense>`, formularios Client Component con `fetch` + `router.refresh()`, pruebas `node:test` con `TEST_DATABASE_URL`. `docs/data-model.md` §4.4 define `credito_registro_mensual`. `credito_hipotecario` no tiene saldo vigente (§4.3); T10 no existe, así que el equivalente en CLP sigue «No disponible».

El usuario aprobó una regla más estricta que §4.4: `fecha_pago_dividendo` es obligatoria con dividendo y **nula** sin dividendo.

## Goals / Non-Goals

**Goals:** alta, actualización por período y consulta (historial y mes puntual) del registro mensual; mes sin registro explícito; «Último saldo registrado» en la página del crédito; validación alineada con el modelo más la regla bidireccional de fecha; CHECK en BD; pruebas aisladas.

**Non-Goals:** `DELETE`; seeds; movimientos financieros o categoría `DIVIDENDO` (T07); agregación, flujo neto y uso de `fecha_pago_dividendo` (T09); proveedor de UF y equivalente en CLP (T10); documentos (T11); amortización, saldo actual calculado, pagos proyectados; paginación; reglas cruzadas no definidas por el modelo.

## Decisions

1. **Endpoints anidados bajo el crédito de la propiedad**, sin exponer `credito_id`:
   - `GET /api/propiedades/[id]/credito/registro-mensual` → 200 con lista (período desc, sin paginación); 404 si la propiedad no existe, el id no es UUID o no hay crédito.
   - `POST` mismo path → 201; 400; 404; 409 por `UNIQUE(credito_id, periodo)`. El `periodo` viaja en el cuerpo.
   - `GET /api/propiedades/[id]/credito/registro-mensual/[periodo]` → 200 con `registrado: true|false`; 400 si el período es inválido; 404 si falta propiedad o crédito.
   - `PUT` mismo path → 200; 404 si no hay registro (nunca crea); cuerpo completo sin `periodo`.
   - `DELETE` → 405 (Next responde 405 al no exportar el método, igual que T02).
   Alternativa descartada: `PUT` como upsert; contradice la decisión aprobada.
2. **Modelo Prisma** `CreditoRegistroMensual` → `credito_registro_mensual`: `creditoId @db.Uuid`, `periodo DateTime @db.Date`, `dividendoPagadoClp Decimal? @db.Decimal(14,0)`, `fechaPagoDividendo DateTime? @db.Date`, `saldoPendienteUf Decimal? @db.Decimal(12,4)`, `createdAt/updatedAt` como en T02. `@@unique([creditoId, periodo])`, `@@index([fechaPagoDividendo])` (data-model §5.2), FK `onDelete: Restrict`. Relación inversa `registros` en `CreditoHipotecario`.
3. **CHECK en SQL** (Prisma 6 no los expresa; mismo enfoque que T01/T02), en una migración incremental generada con `--create-only` y revisada antes de aplicar:
   - `periodo` es día 1: `EXTRACT(DAY FROM periodo) = 1`.
   - `dividendo_pagado_clp > 0`; `saldo_pendiente_uf >= 0`.
   - Al menos un dato: `dividendo_pagado_clp IS NOT NULL OR saldo_pendiente_uf IS NOT NULL` (§4.4).
   - Fecha de pago bidireccional: `(dividendo_pagado_clp IS NULL) = (fecha_pago_dividendo IS NULL)`. Reemplaza el CHECK unidireccional de §4.4; es la desviación aprobada.
4. **Período `YYYY-MM`**: el esquema Zod valida `^\d{4}-(0[1-9]|1[0-2])$`; el servicio lo convierte a `YYYY-MM-01` UTC al guardar y lo devuelve como `YYYY-MM`. La BD refuerza con el CHECK de día 1 (la normalización ocurre antes del `INSERT`; el CHECK es la red de seguridad, no el mecanismo). Alternativa: aceptar fecha completa y truncar; descartada, pide un día sin sentido funcional.
5. **Zod** `server/schemas/credito-registro.ts`: esquema de cuerpo para POST (con `periodo`) y para PUT (sin `periodo`), compartiendo campos. Nuevos helpers en `shared.ts`: `yearMonth` y un entero CLP positivo como texto sin decimales (reusa el patrón de `positiveDecimal` con 0 decimales y hasta 14 dígitos). Un `superRefine` aplica las dos reglas de fila: al menos saldo o dividendo, y fecha de pago si y solo si hay dividendo; el error de fecha se asocia a `fechaPagoDividendo`. Sin reglas cruzadas adicionales (fecha vs período, saldo vs saldo inicial).
6. **Servicio** `createCreditoRegistroService(prisma)`, registrado en `server/services/index.ts`:
   - Resuelve crédito por propiedad (404 de propiedad / 404 de crédito, como en T02) reutilizando la misma verificación; si hace falta, se extrae como helper compartido en lugar de copiarla.
   - `listar`, `obtenerPorPeriodo` (devuelve `registrado: false` con `null` si no hay fila), `crear` (`P2002` → `ConflictError`), `actualizar` (`updateMany` por `creditoId + periodo`; `count === 0` → `NotFoundError`, igual patrón que T02), `ultimoSaldoRegistrado` (`findFirst` con `saldoPendienteUf: { not: null }` ordenado por período desc → `{ periodo, saldoPendienteUf } | null`).
   - Serialización Decimal → texto sin pasar por `Number`; fechas `YYYY-MM-DD`; período `YYYY-MM`.
7. **UI** bajo `app/propiedades/[id]/credito/registro-mensual/`: historial (Server Component, lista desc, «No registrado» donde corresponda, rótulo derivado «Correspondiente a …» solo si el mes de `fecha_pago_dividendo` difiere del período, sin almacenarlo), alta, y edición por período con formulario cliente al estilo de `credito-form.tsx`. El formulario deja el campo de fecha de pago visible solo cuando hay dividendo (conveniencia; la garantía es la API). `credito/page.tsx` agrega «Último saldo registrado» con su período y «CLP: No disponible», separado de «Saldo inicial», más enlace al historial. Sin cálculo financiero en componentes.
8. **Aislamiento de pruebas de integración**: el patrón de T02 ya omite si `TEST_DATABASE_URL` falta o coincide con `DATABASE_URL`/`DIRECT_URL`; T03 lo extrae a un helper de pruebas reutilizable para no duplicarlo en una segunda suite, sin cambiar su comportamiento, y mantiene la omisión silenciosa con motivo. Si el aislamiento no puede verificarse no se escribe nada. Ante errores de conexión o permisos se informa y se detiene; no se tocan credenciales, usuarios ni bases. Cada prueba borra por id propio en `finally` (registros → crédito → propiedad); sin `TRUNCATE` ni `deleteMany` sin filtro. Las pruebas de T02 que borran créditos no se ven afectadas: los registros de T03 se limpian antes en sus propias pruebas.
9. **Sin movimientos ni agregación**: el servicio no importa nada de T07/T09/T10 ni invoca `convertirUfAClp`. Solo guarda `fecha_pago_dividendo` para que T09 imputará la caja por esa fecha.

## Risks / Trade-offs

- [El CHECK bidireccional diverge de `data-model.md` §4.4] → decisión explícita del usuario; tarea de documentación actualiza `data-model.md` (y ticket/README si lo reflejan) para no dejar la fuente de verdad desactualizada.
- [Un `saldo` solo-dividendo no desplaza el último saldo; un período futuro con saldo se vuelve «último»] → es la regla aprobada; la UI siempre muestra el período, y no se compara con la fecha actual.
- [Extraer el helper de aislamiento de pruebas toca la suite de T02] → extracción sin cambio de comportamiento, cubierta por sus 44 pruebas.
- [Carrera POST/POST] → `UNIQUE` en BD; el segundo recibe 409 vía `P2002`.
- [Duplicación Zod/CHECK] → aceptada como en T01/T02: Zod da 400 por campo; el CHECK protege la integridad.
- [Dos fuentes de dividendo si el usuario carga el mismo egreso como `OTRO` en T07] → mitigación en UX y documentación; T03 no puede evitarlo y no debe intentarlo.

## Migration Plan

1. `prisma migrate dev --create-only`, añadir los CHECK y revisar el SQL.
2. Aplicar solo a la BD de pruebas con `TEST_DATABASE_URL` en la fase apply; la BD de desarrollo requiere aprobación del usuario. Esta propuesta no ejecuta migraciones.
3. Rollback: migración inversa que elimina `credito_registro_mensual`; la tabla es nueva y no altera `credito_hipotecario`.

## Supuestos (reversibles, a validar)

- PUT con cuerpo completo: los campos omitidos quedan en `null`; el resultado debe cumplir las reglas.
- Sin tope de períodos futuros ni validación del período contra `fecha_otorgamiento`/`fecha_compra`.
- Sin seed de registros en este ticket.

## Open Questions

Ninguna que bloquee T03. Para T09 quedan abiertas: cómo mostrar el saldo en CLP (requiere T10) y la presentación del rótulo «Correspondiente a …» en el dashboard.
