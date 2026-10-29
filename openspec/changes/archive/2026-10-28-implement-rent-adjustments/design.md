## Context

T04 dejó `contrato_arriendo` y `contrato_monto` (tabla con `UNIQUE(contrato_id, vigente_desde_periodo)` y CHECK de día 1). `createContratoService(prisma)` ya ofrece el bloqueo por propiedad (`conBloqueoDePropiedad`), `obtenerFila` (404 si el contrato no pertenece a la propiedad), `asegurarPropiedad`, `ConflictError`/`NotFoundError` y `toHttpResponse`; `server/schemas/shared.ts` tiene `positiveIntegerText`; `server/domain/contrato-vigencia.ts` es el modelo de función pura con fecha inyectada; `hoyChile()` solo se llama en rutas y páginas. No existe `pago_esperado`. El MVP es de usuario único (sin `usuario_id`). Referencias: `data-model.md` §4.7, §4.8, §5.1 (reglas 3–5), §6; `architecture.md` §5.4; HU02 E3–E5, CL12–CL15.

## Goals / Non-Goals

**Goals:** primer monto tardío; reajustes como filas nuevas con histórico inmutable; monto vigente por período; tabla `pago_esperado`; actualización de montos esperados desde el período de un reajuste; sincronización explícita e idempotente; interfaz para todo lo anterior; pruebas aisladas en `realtytrack_test`.

**Non-Goals:** abonos, estado/saldo/exceso del pago (T06); movimientos y aportes (T07, T08); dashboard; documentos; prorrateo intramensual; editar o borrar filas de monto; cron o escritura desde un GET; recalcular pagos al cambiar `dia_esperado_pago`; nuevos servicios, capas o dependencias.

## Decisions

1. **Todo en `createContratoService`** (sin servicio nuevo): `listarMontos`, `registrarMonto`, `sincronizarPagos`. Reutilizan `conBloqueoDePropiedad`, `obtenerFila`, `fechaADate` y `primerDiaDelMes`. Mismo bloqueo que POST/PUT de contrato: monto, sincronización y edición de la misma propiedad se serializan.
2. **Dominio puro** `server/domain/contrato-monto.ts`, fechas `YYYY-MM-DD` como texto:
   - `montoVigenteEn(filas, periodo)`: fila con el mayor `vigenteDesde <= periodo`, o `null`.
   - `periodosEntre(desde, hasta)`: lista de meses día 1, ambos inclusivos.
   - `fechaEsperada(periodo, dia)`: día del mes, o el último día si no existe (31 en febrero).
3. **Modelo `PagoEsperado`** (`@@map("pago_esperado")`, mismo estilo que `ContratoMonto`): `id` UUID, `contratoId` FK `Restrict`, `periodo @db.Date`, `montoEsperadoClp Decimal(14,0)`, `fechaEsperada @db.Date`, `createdAt`, `updatedAt @updatedAt`; `@@unique([contratoId, periodo])`; relación inversa `pagos` en `ContratoArriendo`. CHECK en la migración (SQL a mano, como la de T04): `monto_esperado_clp > 0` y `EXTRACT(DAY FROM periodo) = 1`. Sin `propiedad_id` (§4.8). El nombre del índice único generado por Prisma es `pago_esperado_contrato_id_periodo_key`. Que el período caiga en la vigencia del contrato y que el monto coincida con el vigente son validaciones de aplicación (§5.1, reglas 3 y 5).
4. **`registrarMonto`** (transacción con bloqueo):
   1. `obtenerFila` (404). Período: sin filas → debe ser el mes de `fechaInicio`; con filas → entre el mes de `fechaInicio` y el de `fechaTermino`, ambos inclusive. Fuera de rango → 422; repetido → `ConflictError`/409 (se comprueba antes de insertar; `P2002` como respaldo). `server/errors.ts` hoy no tiene 422 (solo 400/404/409/500): se añade un único `UnprocessableError` y su rama en `toHttpResponse`, sin otros cambios.
   2. `contratoMonto.create` (nunca update/delete).
   3. Para cada `pago_esperado` existente con `periodo >= vigenteDesde`: nuevo monto = `montoVigenteEn(todasLasFilas, periodo)`; solo se actualiza si **difiere** del actual, con `update` por fila (Prisma aplica `@updatedAt`; un `updateMany` masivo con un único valor sería incorrecto cuando hay reajustes posteriores). Un pago sin cambio de monto no se toca, así conserva `updated_at`. Son pocas filas por contrato (≤ meses de vigencia).
   4. No crea pagos.
5. **`sincronizarPagos(propiedadId, contratoId, referencia)`** (transacción con bloqueo): sin filas de monto → `{ creados: 0, existentes: n }`. Si hay: períodos desde el mes de `fechaInicio` hasta `min(mes(referencia), mes(fechaTermino))`; calcula los que faltan, `createMany({ data, skipDuplicates: true })` con `montoEsperadoClp = montoVigenteEn(...)` y `fechaEsperada = fechaEsperada(periodo, diaEsperadoPago)`; si el monto vigente del período es `null` (la primera fila siempre rige desde el mes de inicio, así que no ocurre) se omite el período. Devuelve `{ creados, existentes }`. Nunca actualiza ni borra. Es la **única** vía de creación; ni el alta, ni el reajuste, ni un GET la invocan. Alternativa descartada: generar en el reajuste o en un GET (escrituras silenciosas) y cron (fuera de arquitectura, `architecture.md` §5.4).
6. **Idempotencia**: `UNIQUE(contrato_id, periodo)` + `skipDuplicates` + el bloqueo por propiedad. Dos sincronizaciones simultáneas dan el mismo resultado final.
7. **Edición de contrato (T04) — propuesta a validar**: `actualizar` rechaza con 409 si el mes de la nueva `fechaTermino` es menor que el `vigenteDesdePeriodo` máximo de `contrato_monto` o que el `periodo` máximo de `pago_esperado`. Dos consultas `aggregate` dentro de la misma transacción con bloqueo. Preserva reglas 4 y 5 de §5.1 sin recalcular nada.
8. **API** (handlers delgados: `requireSession()` → Zod → servicio → `toHttpResponse`; sin `DELETE`):
   - `GET .../montos` → 200 `{ montos: [{ id, montoMensualClp, vigenteDesdePeriodo, motivo }], montoVigenteClp }` (referencia = `hoyChile()` solo en la ruta; solo lectura).
   - `POST .../montos` → 201 con la fila; 400 / 404 / 409 / 422.
   - `POST .../pagos-esperados/sincronizar` → 200 `{ creados, existentes }`; 404.
   Esquema `montoCrearSchema`: `{ montoMensualClp: positiveIntegerText(14), vigenteDesdePeriodo: "YYYY-MM" con mes real, motivo?: optionalText }`; se normaliza a `YYYY-MM-01`.
9. **UI** (`app/propiedades/[id]/contratos/[contratoId]/montos/`): Server Component en `<Suspense>` con tabla de historial, monto vigente y estado (con o sin monto); formulario cliente (patrón de `contrato-form.tsx`, `fetch` + `router.refresh()`) que registra el primer monto o el reajuste según haya filas, muestra mensajes 409/422; botón «Sincronizar pagos esperados» que muestra creados y existentes. Enlace «Montos» en la lista de contratos. Sin cálculo financiero en componentes.
10. **Comportamiento previsto cuando T06 registre abonos (documentado, no implementado)**:
    - El reajuste solo cambia `monto_esperado_clp` desde su período; nunca modifica, elimina ni reasigna abonos.
    - El estado es derivado y se recalcula al consultar (§6.1): un pago pagado cuyo esperado sube pasa a *vencido con abonos parciales* si su fecha ya pasó (CL12) o a *parcialmente pagado* si no (CL13); si el esperado baja, los abonos excedentes se admiten (CL14).
    - Por eso un reajuste retroactivo no se bloquea por la existencia de abonos, y la sincronización no toca pagos existentes. T05 no persiste estado, saldo ni exceso.
    Se registra en este diseño y como nota en T05/T06 de `docs/work-tickets.md`.
11. **Pruebas**: unitarias de `montoVigenteEn`, `periodosEntre`, `fechaEsperada` y `montoCrearSchema`. Integración con `resolveTestDatabase()` (nunca `DATABASE_URL`), limpieza por id propio (pago → monto → contrato → arrendatario → crédito/propiedad), sin `TRUNCATE` ni `deleteMany` sin filtro.

## Risks / Trade-offs

- [Contrato sin monto no genera pagos] → decidido: sincronizar devuelve 0; la UI explica que falta el primer monto.
- [Pagos ya creados tras cambiar `dia_esperado_pago`] → no se recalcula `fecha_esperada` en T05; queda anotado, T06 podrá reabrirlo.
- [Carrera reajuste/sincronización] → el bloqueo por propiedad las serializa.
- [Fechas y zona horaria] → texto `YYYY-MM-DD` y `Date` UTC como en el servicio; el reloj solo en rutas/páginas.
- [`updated_at` correcto] → `update` por fila con `@updatedAt`; se prueba que cambia solo cuando cambia el monto.
- [Ampliar el 409 del PUT cambia T04] → mínima y coherente con §5.1; marcada como propuesta a validar.
- [Migración con CHECK manual] → mismo patrón que T04; Prisma no los modela, por lo que `migrate dev` futuros no los tocan.
- [Pooler de Neon] → transacciones interactivas con `pg_advisory_xact_lock` ya funcionan en T04; sin cambios.

## Migration Plan

1. Añadir `PagoEsperado` a `prisma/schema.prisma`; escribir a mano `prisma/migrations/<timestamp>_add_pago_esperado/migration.sql` (tabla, índice único, FK `ON DELETE RESTRICT ON UPDATE CASCADE`, CHECK) y revisarlo. **No se ejecuta en esta propuesta.**
2. En apply, con aprobación explícita: aplicar solo a `realtytrack_test` (verificando que `TEST_DATABASE_URL` difiere de `DATABASE_URL` y `DIRECT_URL`) y regenerar el cliente. La BD de desarrollo requiere otra aprobación. No se modifica `.env`.
3. Compatibilidad: solo tabla nueva y relación inversa; no altera columnas ni datos existentes; FK y tipos (`UUID`, `NUMERIC(14,0)`, `DATE`, `TIMESTAMPTZ(6)`) coinciden con `contrato_monto`.
4. Rollback: `DROP TABLE "pago_esperado"`.

## Open Questions

- ¿Se valida el 409 del PUT por inconsistencia con montos/pagos (decisión 7)? Supuesto actual: sí.
- ¿T06 recalculará `fecha_esperada` si cambia `dia_esperado_pago`? Fuera de T05.
