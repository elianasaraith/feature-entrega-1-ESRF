## 1. Modelo de datos

- [x] 1.1 Añadir `CreditoHipotecario` a `prisma/schema.prisma` (`propiedadId @unique`, tipos de `data-model.md` §4.3, FK `Restrict`) y `Propiedad.credito CreditoHipotecario?`
- [x] 1.2 Generar la migración con `prisma migrate dev --create-only` y añadir los CHECK en SQL (cuota > 0, tasa ≥ 0, cuotas > 0, día 1..31, monto original > 0, seguros ≥ 0, saldo inicial ≥ 0); revisar el SQL antes de aplicarlo
- [x] 1.3 Aplicar la migración solo a la BD de pruebas (`TEST_DATABASE_URL`) y regenerar el cliente Prisma; la BD de desarrollo no se toca sin aprobación — migración aplicada a `realtytrack_test` (`TEST_DATABASE_URL`) y también a la BD de desarrollo `realtytrack`, con aprobación del usuario — *evidencia proporcionada por el usuario (ejecutada en su entorno local, no por el sandbox del asistente)*.

## 2. Validación

- [x] 2.1 Extraer a `server/schemas/` los helpers compartidos (`isRealCalendarDate`, `optionalText`, `positiveDecimal`, nueva `nonNegativeDecimal`) y hacer que `propiedad.ts` los importe sin cambiar su comportamiento; `npm test` de propiedades sigue en verde
- [x] 2.2 Crear `server/schemas/credito.ts` con las reglas del spec (obligatorios/opcionales, rangos, 4 decimales, fecha real, sin reglas cruzadas)
- [x] 2.3 Pruebas unitarias del esquema: válido completo y solo obligatorios, campo faltante, cuota ≤ 0, tasa negativa, cero permitido (tasa, seguros, saldo), cuotas no enteras, día 0 y 32, exceso de decimales y de rango, `2026-02-30`, saldo > monto original aceptado, precisión `12.3456` / `4.1250` preservada como texto

## 3. Dominio UF → CLP

- [x] 3.1 Crear `server/domain/uf.ts` con `convertirUfAClp(montoUf, valorClp)` en aritmética decimal exacta (sin `Number`), rechazo de `valorClp <= 0`, sin redondeo
- [x] 3.2 Pruebas unitarias con valor de UF fijo: producto exacto, decimales largos sin pérdida, rechazo de UF ≤ 0

## 4. Errores y servicio

- [x] 4.1 Añadir `ConflictError` a `server/errors.ts` y su traducción a 409 en `toHttpResponse`
- [x] 4.2 Crear `server/services/credito-service.ts` (`obtenerPorPropiedad`, `crear`, `actualizar`): verifica propiedad (404), `P2002` → `ConflictError`, `actualizar` sin crédito → `NotFoundError`, serialización Decimal → string y fecha → `YYYY-MM-DD`; registrarlo en `server/services/index.ts`
- [x] 4.3 Pruebas de integración (solo con `TEST_DATABASE_URL` distinta de la BD de desarrollo; se omiten si no): alta con y sin opcionales, duplicado → `ConflictError`, CHECK rechaza violaciones, round-trip decimal exacto, `actualizar`, PUT sin crédito → `NotFoundError`, propiedad inexistente; filas propias borradas por id en `finally` (crédito antes que propiedad); sin `TRUNCATE`, seed ni `deleteMany` sin filtro — 44 pruebas aprobadas, 0 fallidas, 0 omitidas — *evidencia proporcionada por el usuario (ejecutada en su entorno local, no por el sandbox del asistente)*.

## 5. Route Handlers

- [x] 5.1 `app/api/propiedades/[id]/credito/route.ts` con `GET`, `POST` (201) y `PUT`: `requireSession()` → Zod → servicio → `toHttpResponse`; sin `DELETE`
- [x] 5.2 Ampliar `tests/auth/proxy.test.ts`: `/api/propiedades/<id>/credito` sin sesión → 401 JSON

## 6. UI

- [x] 6.1 `app/propiedades/[id]/credito/page.tsx`: cuota, saldo inicial y demás condiciones en UF, «CLP: No disponible» junto a cuota y saldo inicial; sin crédito, aviso y enlace a alta (Suspense + `notFound()` para propiedad inexistente)
- [x] 6.2 `credito-form.tsx` (Client Component, `fetch` a la API, errores por campo, `router.push` + `router.refresh`) y páginas `credito/nuevo` y `credito/editar`; la edición solo accesible si hay crédito
- [x] 6.3 Enlazar «Crédito hipotecario» desde `app/propiedades/[id]/page.tsx`

## 7. Documentación

- [x] 7.1 Corregir `docs/architecture.md` §6 (`creditos/` ya no es la ruta de T02) y revisar `readme.md` para mantener coherencia; documentar en `docs/work-tickets.md` T02 el AC3 como pendiente de T10 sin cambiar su definición
- [x] 7.2 Registrar en `prompts.md` los prompts relevantes de T02 (máx. 3 por sección) — registrados 2 prompts en la sección 2.6 (Tests), que pasa de 1 a 3; la sección 6 ya estaba llena

## 8. Verificación

- [x] 8.1 `npm run lint`, `npx tsc --noEmit`, `npm test` (con `TEST_DATABASE_URL`), `npm run build` — `npm test` 44/44 y `npm run build` exitoso en el entorno del usuario — *evidencia proporcionada por el usuario (ejecutada en su entorno local, no por el sandbox del asistente)*; lint y `tsc` también verificados por el asistente.
- [ ] 8.2 Manual con `npm run dev`: 401 sin sesión en los tres métodos; con sesión 201 → 409 al repetir POST → 200 en GET y PUT → 404 en PUT sin crédito → 400 en entradas inválidas → 405 en DELETE; flujo UI nuevo → consulta → editar; las propiedades existentes intactas
  - Evidencia del usuario (local, no del sandbox): registrar un crédito, consultarlo, acceder a la edición, propiedad sin crédito con opción de registrarlo, equivalente CLP «No disponible». POST 201 solo indirecto (el formulario navega únicamente si la respuesta es OK).
  - **Sin evidencia manual:** 401 sin sesión por curl (solo hay prueba automatizada del proxy); GET 200 de la API (la página lee el servicio, no la API); PUT 200 (solo se accedió a la edición, no se guardó); POST 409 al repetir; PUT 404 sin crédito; 400 en entradas inválidas; DELETE 405; propiedades existentes intactas. Tarea abierta hasta completarlos.
  - **Verificación HTTP automatizada: PENDIENTE; no pudo ejecutarse satisfactoriamente por problemas de autenticación con PostgreSQL** («Authentication failed against database server» en el entorno de pruebas). El script temporal `scripts/verify-credito-http.ts` fue eliminado por decisión del usuario. Sin evidencia por HTTP real: 201, 200 (GET/PUT), 409, 404 (PUT sin crédito), 400, 405 y 401 por `curl`. Cubiertos parcialmente por pruebas de servicio, esquema y proxy. **Archivado con esta tarea abierta, con aprobación explícita del usuario.**
- [x] 8.3 Dejar constancia en el resumen final de que AC3 sigue pendiente de integración con T10
