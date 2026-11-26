## 1. Modelo de datos y configuración

- [x] 1.1 Añadir el modelo `ValorUfPeriodo` (`valor_uf_periodo`) a `prisma/schema.prisma` y crear la migración con `CHECK (valor_clp > 0)` y `CHECK (EXTRACT(DAY FROM periodo) = 1)`
- [x] 1.2 Aplicar la migración en la base de pruebas y regenerar el cliente Prisma; verificar que las pruebas existentes siguen verdes
- [x] 1.3 Documentar `UF_API_BASE_URL` (por defecto `https://findic.cl/api/uf`) en `.env.example`
- [x] 1.4 Prueba de integración de los CHECK: valor 0 y período no día 1 son rechazados

## 2. Puerto y proveedor findic

- [x] 2.1 Crear `server/uf/proveedor.ts` con el tipo `ProveedorUf` y el resultado `ok | sin-datos | error`
- [x] 2.2 Crear `server/uf/findic.ts`: URL `dd-mm-yyyy`, `fetch` con timeout de 5 s y `cache: "no-store"`, esquema zod de la respuesta y valor como texto (máx. 2 decimales)
- [x] 2.3 Pruebas unitarias con `fetch` simulado: respuesta válida de 01-03-2026 (39796.31), serie vacía (01-01-2030), fecha distinta, valor 0/negativo/nulo/no finito/más de 2 decimales/fuera de rango, y que el resultado sea `Decimal` exacto (39796.31), HTTP 500, timeout y cuerpo no JSON

## 3. Servicio de UF y persistencia

- [x] 3.1 Crear la política del día 1 (`fechaReferenciaPeriodo`) y su prueba unitaria
- [x] 3.2 Crear `server/uf/uf-service.ts` con `obtenerValores(periodos)`: lectura por lote, consulta solo de faltantes, `createMany` con `skipDuplicates` y relectura
- [x] 3.3 Pruebas de integración con proveedor doble: primera consulta persiste; período almacenado no llama al proveedor; el proveedor cambia y la fila no cambia
- [x] 3.4 Pruebas de integración: consultas concurrentes dejan una fila; serie vacía y error del proveedor no persisten ni usan otro período; proveedor caído con valor almacenado usa el almacenado
- [x] 3.5 Verificar que `server/errors.ts` no cambia y que ninguna consulta de T10 responde 503 ante proveedor caído o serie vacía

## 4. Conversión y DTO de equivalente

- [x] 4.1 Crear el helper de equivalente (`EquivalenteClpDto`) que reutiliza `convertirUfAClp` y devuelve `null` si no hay UF
- [x] 4.2 Pruebas unitarias: conversión exacta (p. ej. 25.4321 UF × 39796.31), UF ausente → `null`, sin pérdida por `Number`

## 5. Crédito hipotecario (T02)

- [x] 5.1 Extender `credito-service` con `cuotaContractualClp` (UF del mes actual), `saldoInicialClp` (UF del mes de `fechaOtorgamiento`; `null` con indicación «Sin fecha de otorgamiento» si es `null`) y el equivalente del último saldo registrado (UF del período del registro)
- [x] 5.2 Pruebas de integración: con UF, sin UF (200 y `null`), saldo inicial con y sin `fechaOtorgamiento`, y campos previos y montos en UF intactos
- [x] 5.3 Actualizar `app/propiedades/[id]/credito/page.tsx`: mostrar CLP y fecha de referencia, «No disponible» o «Sin fecha de otorgamiento»; retirar el comentario «T10 pendiente»

## 6. Registro mensual (T03)

- [x] 6.1 Extender `credito-registro-service` con el equivalente del saldo de cada registro usando su propio período; `null` sin saldo o sin UF
- [x] 6.2 Pruebas de integración: cada registro usa su período, registro solo con dividendo, UF no disponible, orden y campos previos sin cambios
- [x] 6.3 Actualizar `registro-mensual/page.tsx` con el equivalente, la fecha de referencia y «No disponible»

## 7. Dashboard (T09)

- [x] 7.1 Extender `dashboard-service`: resolver por lote los períodos de los saldos aplicables y añadir `equivalenteClp` a `saldoCredito`, calculado con la UF del mes consultado
- [x] 7.2 Pruebas de integración: equivalente con la UF del mes consultado (registro de un período anterior), UF no disponible, y totales/flujo neto/estados de pago idénticos con y sin UF
- [x] 7.3 Prueba de histórico estable: mes anterior consultado dos veces con la UF «actual» cambiada devuelve cifras y fecha de referencia iguales
- [x] 7.4 Actualizar `app/dashboard/page.tsx`: mostrar el equivalente con su fecha o «No disponible» y retirar la nota «Pendiente de T10»

## 8. Regresión y verificación visual

- [x] 8.1 Ejecutar `npm test` completo (revisando el contador `skipped`), `npx tsc --noEmit`, `npm run lint` y `npm run build`; confirmar que T01–T09 pasan sin modificar sus pruebas, salvo las que fijaban «No disponible» por T10
- [x] 8.2 Verificación visual con la aplicación en ejecución: crédito, registro mensual y dashboard con UF disponible y simulando UF no disponible; revisar fecha de referencia y formato CLP
  - Evidencia visual confirmada por el usuario: crédito (equivalentes CLP y referencias de UF), registro mensual (UF de cada período y registros sin saldo), dashboard (conversión con la UF del mes consultado sin alterar los cálculos financieros), proveedor sin datos (`CLP: No disponible`), proveedor inaccesible (la pantalla funciona sin equivalente), persistencia en `valor_uf_periodo` (sin filas para períodos sin UF) y JSON de los tres GET con los campos anteriores y los nuevos equivalentes.
  - Salvedad: el escenario de crédito sin `fechaOtorgamiento` («Sin fecha de otorgamiento») **no fue comprobado visualmente**; solo tiene cobertura automatizada (prueba de integración del servicio, tarea 5.2).
- [x] 8.3 Verificación manual única contra findic.cl real (fecha con datos y 01-01-2030) sin persistir datos de prueba en la base de desarrollo

## 9. Documentación

- [x] 9.1 Actualizar `docs/work-tickets.md` (T10), `docs/architecture.md` (V2 y V3 confirmadas), `docs/data-model.md` (§8.4, P1)
- [x] 9.2 Actualizar `readme.md` (estado de T10 y consistencia con `docs/`) y registrar los prompts en `prompts.md`
- [x] 9.3 Ejecutar `openspec validate t10-integracion-uf --strict` y `/opsx:verify` antes de archivar
