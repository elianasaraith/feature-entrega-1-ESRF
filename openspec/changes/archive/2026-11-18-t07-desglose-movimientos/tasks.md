## 1. Base de datos

- [x] 1.1 Añadir a `prisma/schema.prisma` el modelo `MovimientoConcepto` (`@@map("movimiento_concepto")`: `id`, `movimientoFinancieroId`, `nombre`, `montoClp Decimal(14,0)`, `orden Int`, `createdAt`, `updatedAt`; relación con `onDelete: Cascade`; `@@index([movimientoFinancieroId])`) y la relación inversa `conceptos` en `MovimientoFinanciero`, sin cambiar sus columnas
- [x] 1.2 Generar el SQL sin conexión con `prisma migrate diff`, guardarlo como `prisma/migrations/<timestamp>_add_movimiento_concepto/migration.sql`, añadir `CHECK ("monto_clp" > 0)` y revisar que la FK sea `ON DELETE CASCADE`. No ejecutar la migración
- [x] 1.3 Detenerse y pedir al usuario que aplique la migración a `realtytrack` y `realtytrack_test` y ejecute `prisma generate`; continuar solo cuando lo confirme

## 2. Dominio y validación

- [x] 2.1 Crear `server/domain/movimiento-desglose.ts` con `MAX_CONCEPTOS` (50), `MAX_NOMBRE_CONCEPTO` (100), `esMontoEnteroTexto` y `sumarConceptos` (suma `bigint`, lista vacía → `"0"`), sin importar nada de T09
- [x] 2.2 En `server/schemas/movimiento.ts` mantener `movimientoInputSchema` (alta) y añadir `movimientoEdicionSchema` (edición) sobre una base común: `conceptos` como lista opcional **nunca nula** (nombre recortado de 1 a 100, monto con el mismo formato, máximo 50; `null` → 400 en `conceptos`); alta con `montoClp` obligatorio salvo que `conceptos` tenga elementos; edición con `montoClp` opcional solo cuando `conceptos` está ausente y obligatorio con `conceptos: []`; la salida distingue ausencia de lista vacía y, para un simple sin `conceptos`, es idéntica a la actual (sin clave `conceptos`)

## 3. Servicio y DTO

- [x] 3.1 En `server/services/movimiento-service.ts` añadir `ConceptoDto` y `conceptos` a `MovimientoDto`; leer con `include` de `conceptos` ordenados por `orden`; los totales de `listar`, `resumenMensual` y `agregarPorCategoria` siguen usando `montoClp` del padre
- [x] 3.2 Reglas de negocio 422 antes de escribir, comunes a alta y edición: monto de cada concepto > 0, total ≤ 14 dígitos, `montoClp` igual a la suma si se envía con conceptos, `montoClp > 0` en simples y con `conceptos: []` (mensaje actual), `montoClp` igual al total vigente si se envía con `conceptos` ausente sobre un desglosado, y `fecha <= hoy`
- [x] 3.3 `crear` con una escritura anidada (`conceptos: { create }`, `orden` = índice) y total calculado por `sumarConceptos`; con `conceptos` ausente o `[]` no se crean filas hijas
- [x] 3.4 `editar` según la tabla de D7: con `conceptos` de uno o más elementos o `[]`, `$transaction` interactiva con `deleteMany` de los conceptos y luego `update` (total = suma, o `montoClp` con `[]`); con `conceptos` ausente, un `update` de fecha, categoría y descripción que **no borra ni inserta conceptos ni escribe `montoClp` en un desglosado**, acepta `montoClp` omitido o igual al total vigente y rechaza uno distinto con 422; si el movimiento es simple y falta `montoClp`, lanzar un `ZodError` con ruta `montoClp` (400); todas las validaciones antes de escribir
- [x] 3.5 Verificar que `eliminar` no necesita cambios (el `CASCADE` borra los conceptos) y que no se crean rutas nuevas en `app/api/propiedades/[id]/movimientos/**`; el único cambio en rutas es el `PUT` (tarea 3.6)
- [x] 3.6 Adaptar el `PUT` de `app/api/propiedades/[id]/movimientos/[movId]/route.ts` para validar con `movimientoEdicionSchema` (el `POST` sigue con `movimientoInputSchema`); sin endpoints nuevos y sin lógica de negocio en la ruta

## 4. Interfaz

- [x] 4.1 En `movimientos-panel.tsx` añadir la casilla «Desglosar en conceptos», filas dinámicas `nombre` + `monto` (inicia con una, «Agregar concepto» hasta 50, «Quitar» conservando al menos una) y el total en vivo con `sumarConceptos` filtrando con `esMontoEnteroTexto`; el campo de monto del gasto simple se oculta mientras el desglose está activo y se muestra el total en vivo
- [x] 4.2 Enviar siempre `conceptos` (nunca omitirlo ni enviarlo nulo): `conceptos` con elementos y sin `montoClp` en un desglosado; `montoClp` y `conceptos: []` en un simple; al pasar de desglosado a simple, avisar, rellenar el monto total y solo entonces enviar `conceptos: []`
- [x] 4.3 Mostrar los conceptos de cada movimiento desglosado bajo su fila del listado, y los errores `conceptos.N.nombre`, `conceptos.N.montoClp`, `conceptos` y los 422 sin perder lo ingresado

## 5. Pruebas

- [x] 5.1 `tests/movimientos/movimiento-desglose.test.ts`: `sumarConceptos` (150.000, lista vacía, montos grandes, valor inválido) y `esMontoEnteroTexto`
- [x] 5.2 Ampliar `tests/movimientos/movimiento-schema.test.ts`: nombre vacío o largo, 51 conceptos, monto no entero, `conceptos: null` → 400 (alta y edición), `conceptos: []` sin `montoClp` → 400, `montoClp` ausente sin conceptos: 400 en el alta y permitido en la edición, ausencia distinta de lista vacía en la salida, y que la salida de un gasto simple sin `conceptos` no cambia
- [x] 5.3 Ampliar `tests/movimientos/movimiento-service.integration.test.ts`: alta desglosada y total; total coincidente y discordante (422 sin escribir); suma sobre 14 dígitos; monto de concepto ≤ 0; conversión simple ↔ desglosado; **protección contra pérdida accidental de conceptos**: `PUT` sin `conceptos` sobre un desglosado sin `montoClp`, con `montoClp` igual al total y con la edición de solo fecha o descripción conservan conceptos y total; `PUT` sin `conceptos` con `montoClp` distinto → 422 y el registro no cambia (fecha, categoría, descripción, total y conceptos); `PUT` sin `conceptos` sobre un simple (con monto como hoy; sin monto → 400); `conceptos: []` convierte a simple de forma atómica, sin `montoClp` → 400 y con `montoClp` ≤ 0 → 422 conservando el desglose; `conceptos: null` → 400 conservando el desglose; reemplazo con suma discordante → 422 con conceptos y total originales; reemplazo exacto y orden preservado; cascada al eliminar; `CHECK` del concepto; pertenencia y aislamiento; el listado devuelve un movimiento y no suma conceptos; registro antiguo con `conceptos: []`
- [x] 5.3b Pruebas HTTP de las rutas (`tests/movimientos/movimiento-api.integration.test.ts`): crear desglosado y consultar sus conceptos; `PUT` sin `conceptos` ni `montoClp` conserva el desglose; `montoClp` inconsistente → 422; `conceptos: []` convierte a simple; `conceptos: null` → 400; compatibilidad con gastos simples; 401, 404 y que ninguna operación rechazada altera los datos. Solo contra `realtytrack_test`
- [x] 5.4 Ampliar `tests/dashboard/dashboard-service.integration.test.ts` (solo pruebas): desglosado de 150.000 cuenta 150.000; simples y desglosados juntos; flujo neto; cartera igual a la suma de propiedades; actividad reciente con un único elemento; conversión y eliminación reflejadas
- [x] 5.5 Comprobar que las pruebas existentes de T07 y T09 pasan sin modificarse; ejecutar `npm test` (218 pruebas de base, 0 fallos), `npm run lint`, `npx tsc --noEmit` y pedir al usuario `npm run build`
- [x] 5.6 Documentar la consulta de verificación de integridad (movimientos cuyo `monto_clp` difiere de la suma de sus conceptos) y ejecutarla con el usuario contra la base de pruebas

## 6. Documentación

- [x] 6.1 `docs/data-model.md`: nueva entidad `movimiento_concepto` (§4.14), actualización de §4.10, relación 1 : 0..N, índices, decisión D15 y conteos; mantener la numeración existente
- [x] 6.2 Diagramas: añadir la entidad y la relación en `docs/diagrams/data-model.mmd` y en el ER de `readme.md`, con los conteos actualizados
- [x] 6.3 `docs/work-tickets.md` (ampliación de T07 y su estado), `docs/user-stories.md` (HU03: escenarios del desglose, sin renumerar los existentes), `docs/product.md` (§6.4 y criterios de éxito 6 y 7), `docs/architecture.md` y `readme.md`; sustituir «pendiente de implementación» por el estado real solo cuando esté verificado
- [x] 6.4 Actualizar en `CLAUDE.md` la nota «Próximo objetivo confirmado» cuando el desglose esté implementado
- [x] 6.5 Ejecutar `openspec validate t07-desglose-movimientos --strict` y corregir lo que falle
