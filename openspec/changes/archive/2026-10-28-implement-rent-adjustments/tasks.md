## 1. Modelo de datos

- [x] 1.1 Añadir `PagoEsperado` a `prisma/schema.prisma` (`contratoId` FK `Restrict`, `periodo @db.Date`, `montoEsperadoClp Decimal(14,0)`, `fechaEsperada @db.Date`, `createdAt`, `updatedAt @updatedAt`, `@@unique([contratoId, periodo])`, `@@map("pago_esperado")`) y la relación inversa `pagos` en `ContratoArriendo`
- [x] 1.2 Escribir a mano la migración `add_pago_esperado` (tabla, índice único, FK `ON DELETE RESTRICT ON UPDATE CASCADE`, CHECK `monto_esperado_clp > 0` y `periodo` día 1), con el mismo patrón y tipos que la migración de T04; revisar el SQL; **no aplicarla**
- [x] 1.3 Con aprobación explícita del usuario, aplicar la migración **solo** a `realtytrack_test` (`TEST_DATABASE_URL` verificada distinta de `DATABASE_URL` y `DIRECT_URL`) y regenerar el cliente Prisma; la BD de desarrollo requiere otra aprobación; no modificar `.env`

## 2. Dominio, validación y errores

- [x] 2.1 Crear `server/domain/contrato-monto.ts`: `montoVigenteEn`, `periodosEntre`, `fechaEsperada` (último día del mes si el día no existe); funciones puras, fechas como texto
- [x] 2.2 Añadir `montoCrearSchema` a `server/schemas/contrato.ts` (`montoMensualClp` con `positiveIntegerText(14)`, `vigenteDesdePeriodo` `YYYY-MM` con mes real normalizado a día 1, `motivo` opcional)
- [x] 2.3 Añadir `UnprocessableError` (422) a `server/errors.ts` y su rama en `toHttpResponse`
- [x] 2.4 Pruebas unitarias: monto vigente (sin filas, antes de la primera, igual a una fila, entre dos, retroactivo, varios reajustes), `periodosEntre`, `fechaEsperada` (31 en febrero, año bisiesto, día normal) y esquema (monto 0/negativo/decimal/exceso, período inválido `2026-13`, motivo vacío)

## 3. Servicio

- [x] 3.1 `registrarMonto` en `contrato-service.ts` con `conBloqueoDePropiedad` y `obtenerFila`: primer monto = mes de inicio; período entre el mes de inicio y el de término (422), repetido (409); solo `create`; actualiza `monto_esperado_clp` de los pagos existentes con `periodo >= vigenteDesde` fila por fila con `montoVigenteEn` sobre todas las filas y solo si el monto difiere; no crea pagos
- [x] 3.2 `listarMontos` (filas por vigencia ascendente + monto vigente a la referencia; solo lectura)
- [x] 3.3 `sincronizarPagos`: bajo bloqueo, desde el mes de inicio hasta `min(mes de referencia, mes de término)`, solo si hay monto; `createMany` con `skipDuplicates`; devuelve `{ creados, existentes }`; nunca modifica ni borra
- [x] 3.4 `actualizar`: 409 si el mes de la nueva `fechaTermino` es anterior al máximo `vigenteDesdePeriodo` o al máximo `periodo` de pago (propuesta a validar)
- [x] 3.5 Pruebas de integración (`realtytrack_test`, `resolveTestDatabase()`, limpieza por id propio): **AC1** reajuste conserva identidad/arrendatario/garantía; **AC2** meses anteriores conservan el monto; **AC3** retroactivo actualiza solo desde su período y no pisa un reajuste posterior; **AC4** sin pagos fuera de la vigencia ni antes del primer monto
- [x] 3.6 Pruebas: primer monto tardío (período distinto al mes de inicio → 422), 409 por período repetido, 422 anterior al inicio y posterior al término, filas anteriores intactas (incluido su `updated_at`), contrato de otra propiedad → 404
- [x] 3.7 Pruebas: `updated_at` cambia solo en pagos cuyo `monto_esperado_clp` cambió; reajuste sin pagos no crea filas; el alta de contrato no crea pagos
- [x] 3.8 Pruebas de sincronización: idempotente (dos ejecuciones = mismas filas), continuación en meses posteriores sin tocar existentes, contrato sin monto → 0 creados, límite por término, `fecha_esperada` día 31 en febrero, monto reajustado en períodos aún no generados, concurrencia (`Promise.all` de dos sincronizaciones sin duplicados)
- [x] 3.9 Pruebas del 409 de PUT por término anterior a un monto o pago, y de que el PUT sigue sin escribir en `contrato_monto` ni `pago_esperado`

## 4. Route Handlers

- [x] 4.1 `app/api/propiedades/[id]/contratos/[contratoId]/montos/route.ts`: `GET` (referencia `hoyChile()`, sin escribir) y `POST` (201 / 400 / 404 / 409 / 422); `requireSession()` → Zod → servicio → `toHttpResponse`; sin `DELETE`
- [x] 4.2 `app/api/propiedades/[id]/contratos/[contratoId]/pagos-esperados/sincronizar/route.ts`: `POST` (200 `{ creados, existentes }`, 404)
- [x] 4.3 Añadir las rutas nuevas a `tests/auth/proxy.test.ts` (401 sin sesión, 405 `DELETE`)

## 5. Interfaz

- [x] 5.1 Página `app/propiedades/[id]/contratos/[contratoId]/montos/page.tsx` (Server Component en `<Suspense>`, 404 si propiedad o contrato no existen): historial, monto vigente, indicación de contrato sin monto
- [x] 5.2 Formulario cliente de monto (primer monto o reajuste según haya filas; `fetch` + `router.refresh()`; mensajes 400/409/422) y acción «Sincronizar pagos esperados» con el resultado
- [x] 5.3 Enlace «Montos» en `app/propiedades/[id]/contratos/page.tsx`; sin cálculo financiero en componentes
- [x] 5.4 Verificación manual de la interfaz con la app en ejecución: primer monto, reajuste, error 409/422, sincronización

## 6. Documentación y cierre

- [x] 6.1 Actualizar `docs/work-tickets.md` (T05 implementado y nota del comportamiento previsto con abonos en T06), `docs/data-model.md` §4.7/§4.8 (cierre de la excepción temporal y generación explícita), `readme.md` si refleja T05, y `prompts.md`
- [x] 6.2 Ejecutar `npm test`, `npx tsc --noEmit` y `npm run lint`; informar resultados reales y lo no ejecutado
- [x] 6.3 Confirmar que no se implementó nada de T06 ni T07 y que `.env` no se modificó
