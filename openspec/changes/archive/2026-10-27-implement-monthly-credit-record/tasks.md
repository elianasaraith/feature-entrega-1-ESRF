## 1. Modelo de datos

- [x] 1.1 Añadir `CreditoRegistroMensual` a `prisma/schema.prisma` (`@@unique([creditoId, periodo])`, `@@index([fechaPagoDividendo])`, FK `Restrict`, tipos de `data-model.md` §4.4) y la relación `registros` en `CreditoHipotecario`
- [x] 1.2 Generar la migración con `prisma migrate dev --create-only` (sin aplicarla) y añadir los CHECK en SQL: período día 1, dividendo > 0, saldo ≥ 0, al menos saldo o dividendo, y `(dividendo IS NULL) = (fecha_pago_dividendo IS NULL)`; revisar el SQL antes de aplicarlo — migración escrita a mano (sin `--create-only`, que requiere conexión) y sin aplicar
- [x] 1.3 Aplicar la migración **solo** a la BD de pruebas (`TEST_DATABASE_URL`, tras verificar que difiere de `DATABASE_URL` y `DIRECT_URL`) y regenerar el cliente Prisma; la BD de desarrollo no se toca sin aprobación del usuario — migración aplicada en `realtytrack_test` y `realtytrack` (evidencia aportada por el usuario)

## 2. Validación

- [x] 2.1 Añadir a `server/schemas/shared.ts` los helpers `yearMonth` (`YYYY-MM`, mes 01–12) y entero CLP positivo como texto sin decimales (hasta 14 dígitos), sin cambiar el comportamiento de los existentes
- [x] 2.2 Crear `server/schemas/credito-registro.ts` con el esquema de alta (con `periodo`) y de actualización (sin `periodo`), con las reglas: al menos saldo o dividendo, fecha de pago si y solo si hay dividendo (error en `fechaPagoDividendo`), y sin reglas cruzadas adicionales
- [x] 2.3 Pruebas unitarias del esquema: alta con ambos, solo saldo, solo dividendo, fila vacía, dividendo sin fecha, fecha sin dividendo, dividendo 0/negativo/decimal, saldo negativo y con 5 decimales, saldo 0 permitido, `2026-02-30`, período `2026-13` y mal formado, período futuro aceptado, fecha de pago anterior al período aceptada, precisión `1799.9999` y `412345` preservada como texto

## 3. Servicio

- [x] 3.1 Extraer a un helper de pruebas la verificación de aislamiento de `TEST_DATABASE_URL` (existe, distinta de `DATABASE_URL` y `DIRECT_URL`; si no, omitir con motivo y no escribir) y usarlo desde la suite de T02 sin cambiar su comportamiento
- [x] 3.2 Crear `server/services/credito-registro-service.ts` (`listar`, `obtenerPorPeriodo` con `registrado: false`, `crear`, `actualizar`, `ultimoSaldoRegistrado`): verifica propiedad y crédito (404), `P2002` → `ConflictError`, `actualizar` sin registro → `NotFoundError`, normaliza `YYYY-MM` a día 1, serializa Decimal → texto y fechas; registrarlo en `server/services/index.ts`
- [x] 3.3 Pruebas de integración (solo con aislamiento verificado): alta con ambos/solo saldo/solo dividendo, duplicado → `ConflictError`, CHECK rechaza fila vacía, dividendo sin fecha, fecha sin dividendo y período no día 1, meses en cualquier orden y historial desc, mes anterior con sus propios valores, mes sin registro → `registrado: false` sin arrastre, `actualizar` sin crear (404 sin registro), PUT que deja la fila vacía → rechazado, último saldo ignora filas solo-dividendo, round-trip decimal exacto, `periodo` ≠ fecha de pago conservados, sin movimientos creados; filas propias borradas por id en `finally` (registros → crédito → propiedad); sin `TRUNCATE`, seed ni `deleteMany` sin filtro — 11 pruebas de integración aprobadas, 0 omitidas (evidencia aportada por el usuario)

## 4. Route Handlers

- [x] 4.1 `app/api/propiedades/[id]/credito/registro-mensual/route.ts` con `GET` (lista) y `POST` (201): `requireSession()` → Zod → servicio → `toHttpResponse`; sin `DELETE`
- [x] 4.2 `app/api/propiedades/[id]/credito/registro-mensual/[periodo]/route.ts` con `GET` y `PUT`: valida `periodo` (400), sin `DELETE`
- [x] 4.3 Ampliar `tests/auth/proxy.test.ts`: ambas rutas sin sesión → 401 JSON

## 5. UI

- [x] 5.1 Historial en `app/propiedades/[id]/credito/registro-mensual/page.tsx` (Server Component en `<Suspense>`, período desc, «No registrado» donde falte dato, rótulo derivado «Correspondiente a …» solo si el mes de la fecha de pago difiere del período, enlace a alta y edición)
- [x] 5.2 Alta y edición por período (`nuevo/` y `[periodo]/editar/`) con un formulario cliente al estilo de `credito-form.tsx`: fecha de pago visible solo con dividendo, errores por campo, `router.refresh()`; sin cálculo financiero
- [x] 5.3 Modificar `app/propiedades/[id]/credito/page.tsx`: fila «Último saldo registrado» con período y «CLP: No disponible» (o «No registrado»), separada de «Saldo inicial», más enlace al historial; sin rotular «Saldo actual»

## 6. Documentación

- [x] 6.1 Actualizar `docs/data-model.md` §4.4 (y su diagrama y la decisión D-correspondiente) con la regla bidireccional de `fecha_pago_dividendo`; reflejarla en `docs/work-tickets.md` T03 y `docs/user-stories.md` solo si la contradicen
- [x] 6.2 Reflejar en `docs/architecture.md` y `readme.md` únicamente lo que cambie (ruta del registro mensual, regla de fecha); no duplicar contenido
- [x] 6.3 Registrar en `prompts.md` el uso de IA de este cambio — sección 6 reorganizada a 3 prompts (inicial del backlog, rechazo de T13 y T14, e implementación fusionada de T01 y T03)

## 7. Verificación final

- [x] 7.1 `openspec validate implement-monthly-credit-record`, tests unitarios, tests de integración con aislamiento verificado, lint, `tsc --noEmit` y `next build` en verde — validate, unitarias, integración, tsc, eslint y build en verde (evidencia aportada por el usuario; validate ejecutado en la verificación)
- [x] 7.2 Verificación manual con sesión: 201/409/404/200/400 en alta y PUT, 405 en `DELETE`, mes sin registro, último saldo con filas solo-dividendo y períodos futuros. **Evidencia (aportada por el usuario; no ejecutada por el asistente).** *Respuestas y comportamiento observados, confirmados por el usuario:* (a) consulta del crédito; historial inicialmente vacío; alta de septiembre de 2026; alta posterior de agosto de 2026; historial ordenado del más reciente al más antiguo; edición exitosa de un registro existente; (b) período duplicado: la interfaz mostró «El crédito ya tiene un registro para ese período»; (c) GET del período `2026-07` (sin registro): devolvió `registrado=false`; (d) período inválido `2026-13`: devolvió «Entrada inválida»; (e) propiedad inexistente: devolvió «Propiedad no encontrada»; (f) período futuro `2026-12`: se registró correctamente; (g) historial: mostró «Correspondiente a 2026-12»; (h) último saldo registrado: mostró 5000 UF del período 2026-09, ignorando el registro posterior de diciembre, que no tenía saldo. *Códigos HTTP:* ninguno de los códigos de la tarea (201, 409, 404, 200, 400) fue leído explícitamente en estas verificaciones; los mensajes de (b), (d) y (e) son los que el código asocia a 409, 400 y 404, pero eso no los confirma como códigos observados. **Comprobado por pruebas automatizadas del servicio y del esquema (resultados aportados por el usuario; no ejecutadas por el asistente):** duplicado, propiedad inexistente o sin crédito, mes sin registro sin arrastre, último saldo ignorando filas solo-dividendo, períodos futuros, PUT que no crea, CHECK de la base y 401 de las rutas. **Sin comprobar explícitamente (alcance original de la tarea, no reducido):** los códigos HTTP 201, 409, 404, 200 y 400 de las rutas nuevas (sin prueba automatizada de los Route Handlers ni lectura manual del código de estado) y el 405 de `DELETE`, que solo se comprobó por inspección de código (las rutas no exportan `DELETE`). Tampoco se probó el 404 ni el 400 de un `PUT`.
- [x] 7.3 Revisar que T03 no duplica T02 (sin tocar `credito_hipotecario`), T07 (sin movimientos ni `DIVIDENDO`), T09 (sin agregación) ni T10 (sin conversión ni equivalente CLP)
