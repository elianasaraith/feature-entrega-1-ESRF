## Context

`Propiedad` (T01) y la autenticación (T12) existen. Patrones vigentes que T02 reutiliza: Zod por entidad en `server/schemas/`, servicio con Prisma inyectado en `server/services/`, `toHttpResponse` como único punto de traducción de errores (hoy solo 400/404/500), handlers delgados con `requireSession()`, lecturas de Server Components vía servicio dentro de `<Suspense>`, formularios Client Component que escriben por `fetch`, pruebas `node:test` con `TEST_DATABASE_URL`. `docs/data-model.md` §4.3 define la entidad; §8 define UF/CLP. T10 (proveedor de UF y `valor_uf_periodo`) no existe: no hay `server/uf/` ni la tabla, y el proveedor y la regla del día de referencia (P1) siguen como *propuesta a validar*. `server/domain/` aún no existe.

## Goals / Non-Goals

**Goals:** alta, consulta y edición del crédito (1 : 0..1), validación alineada con el modelo, precisión decimal sin `Number`, función pura UF → CLP, UI mínima, pruebas aisladas de la BD de desarrollo.

**Non-Goals:** registro mensual, dividendo en CLP, saldo actual (T03); proveedor, tabla y día de referencia de la UF (T10); documentos (T11); dashboard (T09); amortización; borrado; reglas cruzadas no definidas en el modelo.

## Decisions

1. **Endpoints anidados**: `GET/POST/PUT /api/propiedades/[id]/credito`, sin `DELETE` (405). Refleja la relación 1 : 0..1 sin un `creditoId` en la URL.
   - `GET`: 200, o 404 si la propiedad no existe / id no UUID / no tiene crédito.
   - `POST`: 201; 404 si la propiedad no existe; 409 si ya hay crédito.
   - `PUT`: cuerpo completo, 200; 404 si la propiedad no existe **o no tiene crédito** (nunca crea). Alternativa descartada: upsert, porque contradice la precisión aprobada.
   - Mensajes de 404 distintos ("Propiedad no encontrada" / "La propiedad no tiene crédito hipotecario") para que la UI distinga.
2. **Modelo Prisma** `CreditoHipotecario` → `credito_hipotecario`, con `propiedadId String @unique @db.Uuid` y `propiedad Propiedad @relation`; `Propiedad.credito CreditoHipotecario?`. Tipos: UF `@db.Decimal(12,4)`, tasa `Decimal(6,4)`, `numeroCuotasTotal Int`, `diaVencimiento Int @db.SmallInt`, `fechaOtorgamiento DateTime? @db.Date`, `createdAt/updatedAt` como en `Propiedad`. Sin columnas de saldo vigente, dividendo ni equivalente CLP (`architecture.md` §10.3).
   - **FK**: `onDelete: Restrict` (propiedades no se borran en el producto; evita borrado en cascada de datos financieros).
3. **CHECK en SQL** en una migración incremental, mismo enfoque que `propiedad` (Prisma 6 no expresa CHECK): `cuota_contractual_uf > 0`, `tasa_interes_anual >= 0`, `numero_cuotas_total > 0`, `dia_vencimiento BETWEEN 1 AND 31`, `monto_original_uf > 0` (si no es nulo), `seguros_uf >= 0`, `saldo_inicial_uf >= 0`. Se genera con `prisma migrate dev --create-only`, se añade el SQL de CHECK y se aplica en apply, no en este paso.
4. **Zod** `server/schemas/credito.ts`, específico de la entidad. Se reutiliza el patrón de `propiedad.ts`; no se crea una librería genérica. `positiveDecimal` hoy es local a `propiedad.ts` y solo acepta > 0: para `tasa`, `seguros` y `saldo` (≥ 0) hace falta una variante que admita cero. Se extraen a `server/schemas/shared.ts` solo `isRealCalendarDate`, `optionalText` y los helpers decimales realmente compartidos (`positiveDecimal`, `nonNegativeDecimal`), actualizando `propiedad.ts` para importarlos, sin cambiar su comportamiento (cubierto por las pruebas existentes). Alternativa: duplicar; descartada por divergencia entre dos copias del mismo parser.
   - Montos y tasa: número o string → string decimal; nunca `Number`/`parseFloat`. Se rechazan notación científica y signo.
   - Entero: `numeroCuotasTotal` y `diaVencimiento` como enteros JSON (o string de dígitos) con `Number.isSafeInteger` sobre valores pequeños; esto es seguro porque no son montos.
   - Sin reglas cruzadas (saldo ≤ monto original, fechas, unicidad de `numeroCredito`, día 31 vs mes).
5. **Errores**: `ConflictError` en `server/errors.ts` → 409 en `toHttpResponse`. El servicio captura `PrismaClientKnownRequestError` con código `P2002` sobre `propiedad_id` y lanza `ConflictError`; `P2003` (FK) no se espera porque se verifica la propiedad antes, pero una carrera se trataría como 404 de propiedad. Las demás excepciones siguen a 500.
6. **Servicio** `createCreditoService(prisma)` con `obtenerPorPropiedad`, `crear`, `actualizar`. Serialización: Decimal → string con `toString()` (sin pasar por `Number`); fecha → `YYYY-MM-DD`. `actualizar` usa `updateMany` por `propiedadId` y `count === 0` → 404 (mismo patrón que T01), tras distinguir propiedad inexistente de crédito inexistente.
7. **Conversión UF → CLP**: `server/domain/uf.ts` exporta `convertirUfAClp(montoUf: string, valorClp: string): string` usando aritmética decimal exacta. Sin dependencias nuevas: Prisma ya incluye `Decimal` (decimal.js) vía `@prisma/client/runtime/library`. Rechaza `valorClp <= 0`. No redondea; el redondeo es de presentación (`data-model.md` §2). Solo se invoca desde pruebas unitarias con un valor fijo; **ningún código de aplicación la llama hasta T10**. No hay puerto `ProveedorUf` aquí (sería abstracción especulativa antes de T10).
8. **UI**: `app/propiedades/[id]/credito/page.tsx` (consulta; si no hay crédito, aviso y enlace a alta), `credito/nuevo/page.tsx`, `credito/editar/page.tsx`, y `credito-form.tsx` (Client Component). Redirecciones entre alta y edición, para respetar "un crédito por propiedad" y "PUT nunca crea": `credito/nuevo` redirige a `credito/editar` si la propiedad ya tiene crédito, y `credito/editar` redirige a `credito/nuevo` si no lo tiene. Son una comodidad de navegación; la garantía real sigue en la API (409 en POST duplicado, 404 en PUT sin crédito). El detalle de la propiedad añade un enlace «Crédito hipotecario». Cuota y saldo inicial se muestran en UF; junto a cada uno, el texto literal «CLP: No disponible» (AC3 pendiente de T10). Sin cálculos financieros en componentes. Mismo patrón Suspense + `notFound()` que T01 (`cacheComponents`, sin `export const dynamic`).
9. **Rutas y documentación**: se mantiene `/propiedades/[id]/credito` del ticket. `architecture.md` §6 lista `creditos/` para el registro mensual; en la implementación se corrige para no contradecir (T03 decidirá su ruta, tentativamente `/propiedades/[id]/credito/registro-mensual` según su ticket).
10. **Pruebas** (`node:test`, sin dependencias nuevas):
    - Unitarias del esquema Zod (sin BD): todos los escenarios de validación del spec, incluidos ceros permitidos, precisión `12.3456`/`4.1250`, `2026-02-30` y ausencia de reglas cruzadas.
    - Unitaria de `convertirUfAClp` con valor fijo, exactitud decimal y rechazo de UF ≤ 0.
    - Integración del servicio solo con `TEST_DATABASE_URL` explícita y distinta de `DATABASE_URL`/`DIRECT_URL`; si no cumple, se omiten. Cada prueba crea su propia propiedad y crédito, y borra por id propio en `finally` (crédito antes que propiedad). Nunca `TRUNCATE`, `deleteMany` sin filtro ni seed. Casos: alta, duplicado → `ConflictError`, CHECK rechaza violaciones, round-trip de precisión decimal, `actualizar`, PUT sin crédito → `NotFoundError`, propiedad inexistente.
    - Proxy: `/api/propiedades/[id]/credito` sin sesión → 401 JSON (la regla `/api/*` ya existe).
    - Solo evidencia manual (`requireSession()` no se invoca fuera del runtime de Next): 201/409/404/200/400 con sesión y 405 en `DELETE`.

## Risks / Trade-offs

- [AC3 no queda satisfecho] → documentado como pendiente de integración con T10 en proposal, spec y tareas; la función pura y su prueba reducen el coste de integrarlo.
- [Extraer helpers de `propiedad.ts` puede alterar T01] → extracción sin cambio de comportamiento, respaldada por las pruebas unitarias existentes de `propiedad-schema`.
- [Duplicación Zod / CHECK] → aceptada, igual que en T01: Zod da 400 por campo; el CHECK protege la integridad.
- [Carrera POST/POST] → `UNIQUE` en BD garantiza una sola fila; el segundo recibe 409 vía `P2002`.
- [Usar `Decimal` de Prisma en dominio acopla el dominio a una librería] → `decimal.js` es la misma que usa Prisma; la firma pública usa `string`, así que el acoplamiento es interno. Alternativa BigInt manual: más código y más riesgo, descartada.
- [Migración con CHECK en SQL manual] → misma práctica ya aceptada en `20261013120000_add_propiedad_check_constraints`.

## Migration Plan

1. Crear la migración (`--create-only`), añadir los CHECK y revisarla.
2. Aplicar primero a la BD de pruebas (`prisma migrate deploy` con `TEST_DATABASE_URL`); la BD de desarrollo se migra solo tras revisión del usuario.
3. Rollback: migración inversa que elimina `credito_hipotecario`; la tabla es nueva y no altera `propiedad`.

## Supuestos (reversibles, a validar)

- Sin unicidad de `numero_credito`; sin reglas cruzadas de fechas/saldos; sin validar día 31 contra el mes; sin tope de `fecha_otorgamiento`.
- Se muestra «No disponible» para el equivalente en CLP en lugar de ocultarlo, para dejar visible el AC3 pendiente.

## Open Questions

Ninguna que bloquee T02. Quedan para T10: proveedor de UF y regla del día de referencia (P1), y el período con que se convertirán cuota y saldo inicial.
