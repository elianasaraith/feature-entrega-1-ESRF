## 1. Modelo de datos

- [x] 1.1 Añadir `Arrendatario`, `ContratoArriendo` y `ContratoMonto` a `prisma/schema.prisma` (tipos de `data-model.md` §4.5–4.7, `rut @unique`, `@@index([propiedadId, fechaInicio])`, `@@unique([contratoId, vigenteDesdePeriodo])`, FK `Restrict`, sin `estado` ni `usuario_id`) y las relaciones inversas en `Propiedad`
- [x] 1.2 Escribir a mano la migración `add_arrendatario_contrato_arriendo` con tablas, índices, FK y CHECK (`fecha_termino >= fecha_inicio`, garantía >= 0, día 1..31, monto > 0, `vigente_desde_periodo` día 1); revisar el SQL; **no aplicarla**
- [x] 1.3 Con aprobación explícita del usuario, aplicar la migración **solo** a la BD de pruebas (`TEST_DATABASE_URL`, verificada distinta de `DATABASE_URL` y `DIRECT_URL`) y regenerar el cliente Prisma; la BD de desarrollo no se toca sin otra aprobación; no modificar `.env` — migración `20261028120000_add_arrendatario_contrato_arriendo` aplicada en `realtytrack_test` y también en `realtytrack` (evidencia aportada por el usuario; no ejecutada por el asistente). La aplicación a `realtytrack` la hizo el usuario con su autorización; el asistente no aplicó ninguna migración ni verificó host, puerto y base de destino.

## 2. Validación y dominio

- [x] 2.1 Añadir a `server/schemas/shared.ts` el helper `nonNegativeIntegerText(maxDigits)` (entero CLP >= 0 como texto) sin cambiar los existentes
- [x] 2.2 Crear `server/schemas/arrendatario.ts` (nombre obligatorio; rut, email y teléfono opcionales con `optionalText`)
- [x] 2.3 Crear `server/schemas/contrato.ts`: esquema de alta (con `arrendatarioId` XOR `arrendatario` anidado, `montoMensualClp` opcional) y de edición (cuerpo completo **sin** `montoMensualClp`); fechas reales, `fechaTermino >= fechaInicio` con el error en `fechaTermino`, `diaEsperadoPago` 1..31, garantía >= 0
- [x] 2.4 Crear `server/domain/contrato-vigencia.ts` (`vigenciaDe` → `FUTURO | VIGENTE | FINALIZADO`, extremos inclusivos, referencia inyectada)
- [x] 2.5 Pruebas unitarias de vigencia (futuro, extremos inclusivos, finalizado, contrato de un día) y de esquemas (arrendatario ambiguo, término anterior, día 0/32, `2026-02-30`, garantía 0/negativa/decimal, monto 0/decimal/exceso, monto enviado en edición ignorado)

## 3. Servicios

- [x] 3.1 Crear `server/services/arrendatario-service.ts` (`listar` por nombre, `crear`, `asegurarArrendatario` con UUID + existencia → `NotFoundError`; `P2002` por RUT → `ConflictError`) y registrarlo en `server/services/index.ts`
- [x] 3.2 Crear `server/services/contrato-service.ts` con un único helper transaccional que toma `pg_advisory_xact_lock(hashtext(propiedadId))` y comprueba solape inclusivo (excluyendo el propio contrato en PUT); `listar`, `obtener` (404 si no pertenece a la propiedad), `crear` y `actualizar`; DTO con `montoInicialClp` (fila de menor `vigenteDesdePeriodo` o `null`) y Decimal/fechas como texto; registrarlo en `server/services/index.ts`
- [x] 3.3 `crear`: arrendatario existente o anidado en la misma transacción, fila inicial de `contrato_monto` si hay monto (`vigenteDesdePeriodo` = día 1 del mes de `fechaInicio`, motivo «monto inicial»); toda falla revierte todo
- [x] 3.4 `actualizar`: nunca escribe en `contrato_monto`; 404 si no existe; 409 si cambia el mes de `fechaInicio` y hay fila de monto; verifica el arrendatario si cambia
- [x] 3.5 Pruebas de integración de **solape** (parcial, borde compartido 409, sucesivos con otro arrendatario, otra propiedad, PUT con solape, PUT sin solape consigo mismo) — cubierta por `tests/contratos/contrato-service.integration.test.ts`; las 23 pruebas de integración pasaron (evidencia aportada por el usuario; no ejecutada por el asistente).
- [x] 3.6 Pruebas de integración de **concurrencia** (`Promise.all` de dos POST solapados → uno creado y uno `ConflictError`; POST+PUT; propiedades distintas sin conflicto; ningún contrato duplicado) — cubierta por `tests/contratos/contrato-service.integration.test.ts`; las 23 pruebas de integración pasaron (evidencia aportada por el usuario; no ejecutada por el asistente).
- [x] 3.7 Pruebas de integración de **autorización** (arrendatario inexistente y no-UUID → `NotFoundError`; PUT con arrendatario inexistente conserva el original; contrato bajo propiedad ajena → 404; propiedad inexistente) — cubierta por `tests/contratos/contrato-service.integration.test.ts`; las 23 pruebas de integración pasaron (evidencia aportada por el usuario; no ejecutada por el asistente).
- [x] 3.8 Pruebas de integración de **preservación del monto inicial** (alta con y sin monto; PUT no altera la fila de `contrato_monto`; monto enviado en PUT ignorado; cambio de mes de inicio → 409; rollback del contrato si falla el monto o el arrendatario anidado) y de **garantía sin efectos** (no se crean pagos, abonos ni movimientos) — cubierta por `tests/contratos/contrato-service.integration.test.ts`; las 23 pruebas de integración pasaron (evidencia aportada por el usuario; no ejecutada por el asistente).
- [x] 3.9 Todas las pruebas de integración usan `resolveTestDatabase()` (se omiten con motivo si no hay aislamiento verificado), limpian por id propio (monto → contrato → arrendatario → crédito → propiedad) y no usan `TRUNCATE` ni `deleteMany` sin filtro — cubierta por `tests/contratos/contrato-service.integration.test.ts`; las 23 pruebas de integración pasaron (evidencia aportada por el usuario; no ejecutada por el asistente).

## 4. Route Handlers

- [x] 4.1 `app/api/arrendatarios/route.ts` con `GET` y `POST` (201): `requireSession()` → Zod → servicio → `toHttpResponse`; sin `DELETE`
- [x] 4.2 `app/api/propiedades/[id]/contratos/route.ts` con `GET` (pasa «hoy» como referencia de vigencia) y `POST` (201 / 404 / 409)
- [x] 4.3 `app/api/propiedades/[id]/contratos/[contratoId]/route.ts` con `GET` y `PUT`; sin `DELETE`
- [x] 4.4 Ampliar `tests/auth/proxy.test.ts`: las tres rutas sin sesión → 401 JSON

## 5. UI

- [x] 5.1 Listado en `app/propiedades/[id]/contratos/page.tsx` (Server Component en `<Suspense>`, `fechaInicio` desc, vigencia, arrendatario, «Sin monto registrado» cuando falte, garantía rotulada como dato contractual)
- [x] 5.2 Alta (`nuevo/`) y edición (`[contratoId]/editar/`) con un formulario cliente al estilo de `registro-form.tsx`: arrendatario existente o nuevo, monto inicial solo en el alta, errores por campo, `router.refresh()`; sin cálculo financiero
- [x] 5.3 Añadir el enlace «Contratos» en `app/propiedades/[id]/page.tsx`

## 6. Documentación

- [x] 6.1 Actualizar `docs/data-model.md` §4.7 y §5.1 (monto inicial opcional en T04 e invariante «al menos una fila» relajada hasta T05, como *propuesta a validar*) y `docs/work-tickets.md` T04/T05
- [x] 6.2 Reflejar en `readme.md` y `docs/architecture.md` únicamente lo que cambie; no duplicar contenido
- [x] 6.3 Registrar en `prompts.md` el uso de IA de este cambio (máximo 3 prompts principales por sección)

## 7. Verificación final

- [x] 7.1 `openspec validate implement-lease-management`, pruebas unitarias, pruebas de integración con aislamiento verificado, lint, `tsc --noEmit` y `next build` en verde — **Reproducido por el asistente:** `openspec validate` válido, `tsc --noEmit` sin errores, `eslint` sin hallazgos y 19 pruebas unitarias en verde (vigencia, esquemas de contrato, 401 del proxy). **Aportado por el usuario (no ejecutado por el asistente):** 23 pruebas de integración en verde y `npm run build` correcto.
- [x] 7.2 Verificación manual con sesión: 201/409/404/400 en alta y PUT, 405 en `DELETE`, contratos sucesivos y borde compartido; registrar qué se observó y qué solo se comprobó por pruebas — **Evidencia aportada por el usuario (verificación manual en el navegador con sesión; no ejecutada por el asistente).** *Observado:* POST válido → 201; POST con datos inválidos → 400; solicitudes con contrato o arrendatario inexistente → 404; POST con solape → 409; PUT que cambia el mes de inicio de un contrato con monto inicial → 409; `DELETE` en contratos y arrendatarios → 405; contratos sucesivos sin solape (un contrato termina el 28/02/2027 y el siguiente empieza el 01/03/2027); listado del más reciente al más antiguo; edición del día esperado de pago; alta con RUT duplicado rechazada con mensaje de conflicto (**código HTTP no confirmado**). *Pendientes en el registro previo:* (a) borde compartido (término e inicio el mismo día → 409); (b) código HTTP del RUT duplicado (esperado 409); (c) PUT con datos inválidos → 400; (d) PUT con `arrendatarioId` inexistente → 404 y el contrato conserva su arrendatario. *Cierre:* el usuario declaró después que esas cuatro comprobaciones también fueron validadas manualmente, sin aportar los resultados detallados (códigos HTTP observados) ni indicar que se hayan repetido; el asistente no las vio ni las ejecutó.
- [x] 7.3 Revisar que T04 no adelanta T05 (sin reajustes, sin "monto vigente", sin `pago_esperado`), T06, T07, T08, T09 ni T11, que la garantía no es ingreso, y que no se tocaron `.env`, commits ni la BD de desarrollo
