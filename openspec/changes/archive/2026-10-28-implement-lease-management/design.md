## Context

T01 (propiedades), T02 (crédito), T03 (registro mensual) y T12 (auth) existen. Patrones vigentes que T04 reutiliza: Zod por entidad en `server/schemas/` con helpers en `shared.ts` (`positiveIntegerText`, `isRealCalendarDate`, `optionalText`), servicios con Prisma inyectado (`createXService(prisma)` registrados en `server/services/index.ts`), `asegurarPropiedad` en `propiedad-lookup.ts`, `toHttpResponse` como único punto de traducción de errores (400/404/409/500), handlers delgados con `requireSession()`, Server Components en `<Suspense>` con formularios cliente (`fetch` + `router.refresh()`), CHECK en SQL de la migración, y pruebas `node:test` con `resolveTestDatabase()` (`tests/setup/test-db.ts`). `docs/data-model.md` §4.5–4.7 define `arrendatario`, `contrato_arriendo` y `contrato_monto`. No existe nada de contratos en código. El MVP es de usuario único: ninguna entidad lleva `usuario_id` (§4.1).

## Goals / Non-Goals

**Goals:** alta, edición y consulta de arrendatarios y contratos; monto inicial opcional en `contrato_monto` preservado en ediciones; vigencia derivada; no solape inclusivo con bloqueo por propiedad en POST y PUT; garantía como dato contractual; pruebas aisladas de solape, concurrencia, autorización y preservación del monto.

**Non-Goals:** reajustes y nuevas filas de `contrato_monto`, cálculo de "monto vigente", `pago_esperado` (T05); abonos y estado de pago (T06); movimientos y aportes (T07, T08); dashboard (T09); documentos (T11); gestión de la garantía; `DELETE`; `EXCLUDE gist`; cualquier columna `estado` o `usuario_id`; seeds con datos reales.

## Decisions

1. **Endpoints anidados bajo la propiedad, sin `DELETE`:**
   - `GET /api/propiedades/[id]/contratos` → 200 con lista (`fechaInicio` desc); 404 si la propiedad no existe o el id no es UUID.
   - `POST` mismo path → 201; 400; 404 (propiedad o arrendatario); 409 (solape o RUT duplicado del arrendatario anidado).
   - `GET/PUT /api/propiedades/[id]/contratos/[contratoId]` → 200; 404 si el contrato no existe o no pertenece a la propiedad; PUT con cuerpo completo, nunca crea.
   - `GET/POST /api/arrendatarios` → 200 lista por nombre; 201; 400; 409 por RUT.
   - `DELETE` → 405 (no se exporta el método, como en T02/T03).
2. **Modelo Prisma** (`@@map` snake_case, `@db.Uuid`, `createdAt/updatedAt` como en T02):
   - `Arrendatario`: `nombre`, `rut String? @unique`, `email?`, `telefono?`.
   - `ContratoArriendo`: `propiedadId`, `arrendatarioId`, `fechaInicio @db.Date`, `fechaTermino @db.Date` (NOT NULL), `garantiaClp Decimal? @db.Decimal(14,0)`, `diaEsperadoPago @db.SmallInt`, `observaciones?`; `@@index([propiedadId, fechaInicio])`; FK `Restrict` a ambos. Sin `estado`.
   - `ContratoMonto` (forma final de §4.7, para que T05 no migre estructura): `contratoId`, `montoMensualClp Decimal @db.Decimal(14,0)`, `vigenteDesdePeriodo @db.Date`, `motivo?`; `@@unique([contratoId, vigenteDesdePeriodo])`; FK `Restrict`.
   - Relaciones inversas en `Propiedad`, `Arrendatario` y `ContratoArriendo`.
3. **CHECK en SQL** (Prisma 6 no los expresa; mismo enfoque que T01–T03), en una migración incremental **escrita a mano y sin aplicar** (T03 ya lo hizo así porque `--create-only` necesita conexión): `fecha_termino >= fecha_inicio`; `garantia_clp >= 0`; `dia_esperado_pago BETWEEN 1 AND 31`; `contrato_monto.monto_mensual_clp > 0`; `vigente_desde_periodo` día 1.
4. **Monto inicial**: el esquema de alta acepta `montoMensualClp` opcional (`positiveIntegerText(14)`). El servicio crea contrato y fila de `contrato_monto` en la misma `$transaction` (`vigenteDesdePeriodo` = `YYYY-MM-01` del mes de `fechaInicio`, `motivo` «monto inicial»). El esquema de edición **no incluye** `montoMensualClp` (Zod descarta claves desconocidas por defecto, así que un monto enviado en el PUT se ignora) y `actualizar` no referencia `contratoMonto` salvo para leer. El DTO expone `montoInicialClp` leyendo la fila de menor `vigenteDesdePeriodo`; no calcula montos vigentes.
   - **Invariante relajada**: sin monto, el contrato queda sin fila; se documenta como *propuesta a validar* en `data-model.md` §4.7/§5.1, `work-tickets.md` T04 y este cambio. T05 deberá tratar contratos sin fila (p. ej. exigiendo el monto inicial antes de generar pagos esperados). Alternativa descartada: monto obligatorio; el usuario eligió opcional.
   - **Edición de `fechaInicio`**: para no romper la regla «el primer `contrato_monto` rige desde el mes de `fecha_inicio`» (§5.1, regla 4) sin sobrescribir el monto, el PUT rechaza con 409 un cambio del *mes* de `fechaInicio` si el contrato ya tiene fila de monto (cambiar solo el día dentro del mismo mes es válido). Supuesto reversible; T05 podrá reabrirlo.
5. **Vigencia**: función pura `vigenciaDe(contrato: {fechaInicio, fechaTermino}, referencia)` en `server/domain/contrato-vigencia.ts` (como `server/domain/uf.ts`), con fechas `YYYY-MM-DD` comparadas como texto o `Date` UTC; extremos inclusivos; la referencia se inyecta (el handler/página pasa «hoy»; el dominio no lee el reloj). `fecha_termino` es NOT NULL (confirmado en `data-model.md` §4.6, diagrama, `readme.md` y HU02 E1); no hay contratos indefinidos en el MVP.
6. **Solape inclusivo** `inicioA <= terminoB && inicioB <= terminoA`, evaluado en el servicio con `findFirst` sobre los contratos de la propiedad (excluyendo `id` propio en PUT). Alternativa descartada: `EXCLUDE USING gist` (requiere `btree_gist`, el data-model lo deja como opción, no requisito).
7. **Bloqueo por propiedad en POST y PUT**: un único helper del servicio abre `prisma.$transaction(async (tx) => …)`, ejecuta `SELECT pg_advisory_xact_lock(hashtext(<propiedadId>))` vía `tx.$executeRaw` (parametrizado) y luego comprueba solape y escribe dentro de la misma transacción. Serializa por propiedad, no bloquea filas ajenas, no requiere extensiones ni dependencias, y se libera solo al terminar la transacción. POST y PUT usan exactamente el mismo helper. Alternativas descartadas: `FOR UPDATE` sobre `propiedad` (bloquea esa fila también para otras operaciones), validación sin bloqueo (carrera teórica). Un único usuario hace la carrera improbable, pero la propuesta lo exige y el costo es una línea de SQL.
8. **Arrendatario**: `arrendatarioId` XOR `arrendatario` anidado (refinamiento Zod). El servicio comprueba UUID + existencia (404, mismo criterio que `asegurarPropiedad`). El anidado se crea con `tx.arrendatario.create` dentro de la transacción; si el contrato falla, todo se revierte. `P2002` por RUT → `ConflictError`.
9. **Autorización**: single-user, sin `usuario_id` (§4.1). La garantía de acceso es `requireSession()` en cada handler + el proxy global; la "propiedad del arrendatario" se reduce a existencia verificada. No se añade `usuario_id`. Propuesta a validar (ver proposal).
10. **Zod** (`server/schemas/arrendatario.ts`, `contrato.ts`): fechas con `isRealCalendarDate`; `fechaTermino >= fechaInicio` por `superRefine` con error en `fechaTermino`; `diaEsperadoPago` entero 1..31; garantía CLP entero >= 0 como texto (nuevo helper `nonNegativeIntegerText` en `shared.ts`, sin tocar los existentes); `optionalText` para observaciones, email y teléfono.
11. **UI** bajo `app/propiedades/[id]/contratos/`: listado (Server Component en `<Suspense>`, `fechaInicio` desc, vigencia con «hoy» pasado al dominio, «Sin monto registrado» si no hay monto inicial), alta con selector de arrendatario existente o formulario anidado, y edición. Sin cálculo financiero en componentes. Enlace «Contratos» en el detalle de la propiedad. La garantía se muestra rotulada como dato contractual, nunca como ingreso.
12. **Pruebas** (`tests/contratos/`), todas las de integración con `resolveTestDatabase()` (se omiten si no hay aislamiento verificado; nunca usan `DATABASE_URL`) y limpieza por id propio (monto → contrato → arrendatario → crédito/propiedad), sin `TRUNCATE` ni `deleteMany` sin filtro:
    - Unitarias: vigencia (extremos, futuro, finalizado), esquemas.
    - Integración: solape inclusivo (parcial, borde compartido, sucesivos, otra propiedad, PUT), **concurrencia** (`Promise.all` de dos POST solapados → uno 201 y uno `ConflictError`; POST+PUT; propiedades distintas), **autorización** (arrendatario inexistente o no-UUID → `NotFoundError`; PUT con arrendatario inexistente conserva el original; contrato bajo propiedad ajena → 404; 401 sin sesión en `proxy.test.ts`), **preservación del monto inicial** (PUT no altera la fila; monto enviado en PUT ignorado; cambio de mes de inicio → 409), alta sin monto, rollback del anidado, y garantía sin efectos financieros.

## Risks / Trade-offs

- [Contrato sin fila de `contrato_monto` rompe la invariante de §4.7 hasta T05] → decisión explícita del usuario; documentada como propuesta a validar; T05 exigirá el monto antes de generar pagos.
- [`pg_advisory_xact_lock` con conexión agrupada (Neon pooler)] → el bloqueo es transaccional y se toma y libera dentro de una misma transacción interactiva, que usa una sola conexión; si el pooler no soportara transacciones interactivas, la prueba de concurrencia lo detecta y se usa `DIRECT_URL`. Verificación en la fase de pruebas.
- [Colisión de `hashtext` entre propiedades] → solo serializa de más (nunca de menos); aceptable.
- [Bloquear el cambio del mes de `fechaInicio` limita la edición] → supuesto reversible; evita sobrescribir el monto inicial.
- [Garantía confundida con ingreso] → no hay movimientos ni pagos en T04; rótulo explícito en UI; prueba de ausencia de efectos.
- [PII] → fixtures y seeds usan datos ficticios; nada real al repositorio.
- [Interpretación de "propiedad del arrendatario" en single-user] → ver proposal; si se quisiera propiedad por usuario real habría que cambiar el modelo.

## Migration Plan

1. Escribir `prisma/migrations/<timestamp>_add_arrendatario_contrato_arriendo/migration.sql` a mano (tablas, índices, FK, CHECK) y revisarlo. **Esta propuesta no ejecuta migraciones.**
2. Aplicar solo a la BD de pruebas (`TEST_DATABASE_URL`, tras verificar que difiere de `DATABASE_URL` y `DIRECT_URL`) con aprobación explícita del usuario; la BD de desarrollo requiere otra aprobación.
3. Regenerar el cliente Prisma.
4. Rollback: migración inversa que elimina `contrato_monto`, `contrato_arriendo` y `arrendatario` (tablas nuevas, sin alterar las existentes).

## Open Questions

- ¿Se valida la interpretación de autorización (sesión + existencia, sin `usuario_id`)? Supuesto actual: sí.
- ¿Debe T05 exigir `contrato_monto` inicial antes de generar pagos esperados cuando falte? Se decide en T05.
- ¿Se permite cambiar el arrendatario de un contrato ya iniciado vía PUT? Supuesto actual: sí, solo a uno existente.
