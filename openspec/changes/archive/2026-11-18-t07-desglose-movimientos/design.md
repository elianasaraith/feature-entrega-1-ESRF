## Context

T07 ya implementa `movimiento_financiero` (`docs/data-model.md` §4.10): egreso manual con `fecha`, `categoria`, `monto_clp NUMERIC(14,0) > 0` y `descripcion`, CRUD por propiedad y UI propia. T09 consume esa tabla con una consulta (`prisma.movimientoFinanciero.findMany` por propiedad y mes) y suma `montoClp` con `bigint`; no hace `include` ni conoce nada más. T08 (aportes de capital) se canceló y este change es el siguiente objetivo confirmado: poder registrar un gasto como **simple** o **desglosado en conceptos**.

Estado observado:
- `server/schemas/movimiento.ts`: `movimientoInputSchema` con `montoClp` obligatorio (formato → 400; monto ≤ 0 y fecha futura se dejan al servicio → 422). Su prueba de esquema compara la salida con `deepEqual`.
- `server/services/movimiento-service.ts`: `crear`/`editar`/`eliminar` sobre una sola tabla, DTO con montos en texto, sin transacciones.
- `contrato-service.ts` ya usa una transacción interactiva (`tx`), así que hay precedente.
- `movimientos-panel.tsx` (cliente) recibe totales ya calculados; por regla del proyecto no calcula finanzas, pero ya importa funciones puras del dominio (`formatearClp`).
- Todas las FK del esquema son `Restrict`; ninguna entidad compuesta existe todavía.

Decisiones ya confirmadas por el usuario (la semántica de `PUT` se corrigió: omitir `conceptos` protege el desglose existente): total guardado en el padre; entidad hija `MovimientoConcepto` con `orden` y timestamps; `ON DELETE CASCADE`; `montoClp` obligatorio en simples y opcional en desglosados (debe coincidir con la suma si se envía); suma en el backend con `bigint`; total en vivo en la interfaz con una función pura de dominio; 50 conceptos y 100 caracteres de nombre como máximo; nombres repetidos permitidos; rutas actuales; T09 intacto; sin relleno de datos; conversión por el `PUT` existente, con `conceptos` ausente = sin cambios, `[]` = convertir a simple y `null` = 400.

## Goals / Non-Goals

**Goals:**
- Registrar, consultar, editar y eliminar gastos desglosados sin cambiar el comportamiento de los simples.
- Garantizar que un movimiento se cuente una sola vez en T09, sin tocar T09.
- Atomicidad: nunca un movimiento sin sus conceptos, ni conceptos sin movimiento, ni un total distinto de la suma.
- Compatibilidad total con clientes y datos existentes.

**Non-Goals:**
- Conceptos como movimientos independientes, con fecha, categoría o rutas propias.
- Plantillas de conceptos, categorías por concepto, documentos por concepto.
- Conceptos en la actividad reciente o en el dashboard.
- Cambios a fórmulas, DTO o consultas de T09.
- Triggers o restricciones entre tablas que verifiquen la suma en la base de datos.

## Decisions

**D1. Modelo y migración.** `model MovimientoConcepto @@map("movimiento_concepto")`:

```
id                      String   @id @default(uuid()) @db.Uuid
movimientoFinancieroId  String   @map("movimiento_financiero_id") @db.Uuid
nombre                  String
montoClp                Decimal  @map("monto_clp") @db.Decimal(14, 0)
orden                   Int
createdAt / updatedAt   DateTime (Timestamptz(6), como el resto)
movimiento  MovimientoFinanciero @relation(..., onDelete: Cascade)
@@index([movimientoFinancieroId])
```

`MovimientoFinanciero` gana solo la relación inversa `conceptos MovimientoConcepto[]`; sus columnas no cambian. La migración `<timestamp>_add_movimiento_concepto` crea la tabla, el índice y la FK `ON DELETE CASCADE`, y añade a mano `CHECK ("monto_clp" > 0)` (Prisma 6 no lo expresa). No hay `UNIQUE (movimiento, orden)`: un reemplazo borra y reinserta en la misma transacción y la unicidad añadiría fragilidad sin proteger nada que el servicio no controle. Los límites de 50 y 100 viven en Zod, no en la base, para poder relajarlos sin migrar. Se genera con `prisma migrate diff` sin conexión y la aplica el usuario. *Alternativa descartada*: `Restrict` y borrado manual de hijos; obliga a ordenar borrados en cada ruta y en la limpieza de todas las pruebas, y los conceptos son parte del movimiento (composición).

**D2. Total guardado en el padre.** `movimiento_financiero.monto_clp` es siempre el total: el monto enviado en un simple, o la suma de conceptos en un desglosado. Por eso T09, `agregarPorCategoria` y el listado siguen leyendo una sola columna y no pueden contar un gasto dos veces. *Alternativa descartada*: total calculado al consultar; obligaba a unir la tabla hija en T09 y a distinguir simples de desglosados. El riesgo de desvío ante una escritura directa a la base se audita con una consulta de verificación (en las tareas), sin trigger.

**D3. Un movimiento es desglosado si tiene conceptos.** No hay columna `tipo` ni bandera: se deriva de la existencia de filas, igual que el resto de los derivados del modelo.

**D4. Dominio puro `server/domain/movimiento-desglose.ts`.**
- Constantes `MAX_CONCEPTOS = 50` y `MAX_NOMBRE_CONCEPTO = 100`.
- `esMontoEnteroTexto(v)`: `true` si es texto de enteros no negativos.
- `sumarConceptos(montos: string[]): string`: suma exacta con `bigint`, lista vacía → `"0"`, lanza ante un valor no entero.
- Sin reloj ni base de datos y sin importar nada de T09 (la dependencia T07 → T09 se evita con una suma propia de pocas líneas).

La usa el servicio para el total y la interfaz, composiendo `sumarConceptos(montos.filter(esMontoEnteroTexto))`, para el total en vivo. Así la regla vive una sola vez y el componente solo presenta.

**D5. Validación en dos capas.**
- *Zod (formato → 400)*, con una base común a dos esquemas: `fecha` y `categoria` como hoy; `descripcion` con `optionalText`; `montoClp` con el patrón actual de entero en texto de hasta 14 dígitos y signo opcional (0 y negativos llegan al servicio, igual que hoy); `conceptos` como **lista opcional y nunca nula** de `{ nombre, montoClp }`, con `nombre` recortado de 1 a 100 caracteres, el mismo `montoClp` y un máximo de 50 elementos. `conceptos: null` es un error de formato (400, ruta `conceptos`), tanto en el alta como en la edición.
- *`movimientoInputSchema` (alta, `POST`)*: `montoClp` es obligatorio salvo que `conceptos` traiga al menos un elemento. Un `superRefine` reporta el error en la ruta `montoClp`, igual que el rechazo actual de un monto ausente. Con `conceptos: []` también exige `montoClp`.
- *`movimientoEdicionSchema` (edición, `PUT`)*: igual, pero `montoClp` puede omitirse cuando `conceptos` está **ausente**, porque en un movimiento desglosado esa combinación significa «no tocar el desglose» (D7). Con `conceptos: []` sigue exigiendo `montoClp`. Si el movimiento resulta ser simple y no vino `montoClp`, el servicio lanza un `ZodError` con la ruta `montoClp` (el mismo 400 de hoy), porque solo el estado del registro lo revela.
- *Forma de salida preservada:* para un cuerpo simple sin `conceptos` la salida es idéntica a la de hoy (`{ fecha, categoria, montoClp, descripcion }`, sin clave `conceptos`), de modo que las pruebas actuales de esquema pasan sin tocarse. `conceptos` aparece en la salida solo si vino en el cuerpo, y la ausencia se distingue de la lista vacía. `montoClp` aparece solo si se envió.
- *Servicio (reglas de negocio → 422)*, en este orden y siempre antes de escribir: monto de cada concepto > 0; total ≤ 14 dígitos; con conceptos y `montoClp`, debe ser igual a la suma; en un simple o con `conceptos: []`, `montoClp > 0` (mensaje actual); en un desglosado con `conceptos` ausente y `montoClp` presente, debe ser igual al total vigente; `fecha <= hoy`. Los mensajes del simple no cambian.
- Los errores de `ZodError` salen de `toHttpResponse` con claves como `conceptos`, `conceptos.0.nombre`, `conceptos.2.montoClp` y `montoClp`.

**D6. Atomicidad.**
- *Alta:* un único `create` con `conceptos: { create: [...] }` (escritura anidada, atómica). `orden` es el índice 0..n−1 del arreglo recibido. Con `conceptos` ausente o `[]` no se crean filas hijas.
- *Edición con `conceptos` de uno o más elementos, o `[]`:* `prisma.$transaction(async (tx) => { await tx.movimientoConcepto.deleteMany({ where: { movimientoFinancieroId } }); return tx.movimientoFinanciero.update({ where: { id }, data: { fecha, categoria, descripcion, montoClp: total, conceptos: { create } }, include }) })`, con `create` vacío en el caso de `[]`. El borrado explícito va primero para no depender del orden interno de las escrituras anidadas. El precedente es la transacción de `contrato-service`.
- *Edición con `conceptos` ausente:* **nunca borra ni inserta conceptos y no escribe `montoClp`** en un desglosado. Es un `update` de `fecha`, `categoria` y `descripcion` (y de `montoClp` solo si el movimiento es simple). En un desglosado el total ya guardado queda intacto, por lo que no puede desviarse de la suma.
- *Baja:* sin cambios en el servicio; el `CASCADE` elimina los conceptos.
- Todas las validaciones corren **antes** de abrir la transacción o de escribir: un 400 o un 422 no modifica el registro ni sus conceptos.

**D7. `PUT`: el campo `conceptos` decide, y omitirlo protege el desglose.** Sigue siendo una edición de cuerpo completo para `fecha`, `categoria` y `descripcion`; lo que cambia es el significado de `conceptos`:

| `conceptos` | `montoClp` | Movimiento actual | Resultado |
|---|---|---|---|
| ausente | presente (> 0) | simple | Edición normal, como hoy |
| ausente | ausente | simple | 400 en `montoClp` (como hoy); no cambia nada |
| ausente | ausente | desglosado | Se actualizan fecha, categoría y descripción; **se conservan conceptos y total** |
| ausente | igual al total vigente | desglosado | Igual que la fila anterior |
| ausente | distinto del total vigente | desglosado | 422; no cambia nada |
| `[]` | presente (> 0) | cualquiera | Convierte a **simple**: elimina los conceptos y guarda `montoClp`, de forma atómica |
| `[]` | ausente | cualquiera | 400 en `montoClp`; no cambia nada |
| `[]` | ≤ 0 | cualquiera | 422; no cambia nada |
| `null` | cualquiera | cualquiera | 400 en `conceptos`; no cambia nada |
| 1 a 50 elementos | ausente o igual a la suma | cualquiera | Desglosado: reemplaza el desglose completo; total = suma calculada en el backend |
| 1 a 50 elementos | distinto de la suma | cualquiera | 422; no cambia nada |

Un movimiento solo pasa de desglosado a simple con `conceptos: []` explícito, y solo se reemplaza el desglose con una lista no vacía.

**D8. Conversión simple ↔ desglosado** con el mismo `PUT` (D7). Simple → desglosado: enviar `conceptos` con elementos. Desglosado → simple: enviar `conceptos: []` y un `montoClp` positivo. Se mantienen el id, la propiedad y `createdAt`; `updatedAt` cambia como en cualquier edición.

**D9. Compatibilidad y protección de datos.** Los movimientos existentes no tienen filas hijas y por tanto son simples; no hay relleno. Un cliente que usa el cuerpo actual sigue funcionando; la única diferencia observable es el campo aditivo `conceptos` en las respuestas. Un cliente que desconoce los conceptos y edita un movimiento desglosado **no pierde conceptos**: al omitir `conceptos`, el servidor los conserva; si ese cliente reenvía el `montoClp` que recibió (igual al total) se acepta, y si lo cambia recibe un 422 en lugar de dejar un total que no coincide con la suma. La pérdida de un desglose exige una acción explícita (`conceptos: []`). La UI nunca omite `conceptos` y nunca envía `null`.

**D10. DTO.** `MovimientoDto` añade `conceptos: ConceptoDto[]` con `{ id, nombre, montoClp, orden }` (monto como texto; vacío para simples). Las lecturas usan `include: { conceptos: { orderBy: { orden: "asc" } } }` (Prisma resuelve con una consulta adicional por lote, sin N+1). `listar`, `resumenMensual` y `agregarPorCategoria` siguen calculando con `montoClp` del padre. No se agrega un campo `desglosado`: se deriva de `conceptos.length`.

**D11. Rutas.** Sin rutas nuevas ni lógica de negocio en ellas: delegan en el servicio. El `POST` sigue validando con `movimientoInputSchema`; el `PUT` pasa a validar con `movimientoEdicionSchema`, único cambio en los archivos de rutas, necesario para poder omitir `montoClp` y `conceptos` (D5, D7). No existen rutas de conceptos.

**D12. T09.** Sin cambios de código. `dashboard-service` no incluye la relación `conceptos`, por lo que no puede leerlos. La protección contra doble contabilización son las pruebas de la siguiente decisión, escritas contra la base real.

**D13. Interfaz (`movimientos-panel.tsx`).**
- Casilla «Desglosar en conceptos»: al activarla aparece una lista de filas `nombre` + `monto` (inicia con una fila), botones «Agregar concepto» (hasta 50) y «Quitar» (se conserva al menos una), y el campo de monto del gasto simple se oculta y en su lugar se muestra el **total en vivo** («Total: N CLP»). Los botones de agregar y quitar y el contador «N de 50» se deshabilitan en sus límites, y «Guardar» se deshabilita mientras alguna fila no tenga nombre y un monto entero mayor que 0 (esta comprobación solo habilita el botón; el servidor sigue siendo la fuente de verdad).
- Total en vivo: `sumarConceptos(montos.filter(esMontoEnteroTexto))` importado del dominio. No hay lógica financiera en el componente.
- Al enviar un desglosado se envía `conceptos` con elementos y se omite `montoClp`; al enviar un simple se envían `montoClp` y `conceptos: []` (explícito). Nunca se omite `conceptos` ni se envía `null`, de modo que ninguna edición dependa de la semántica de omisión.
- Al editar un desglosado y desactivar la casilla, un aviso dice que los conceptos se descartarán y el monto total se rellena con el total actual para que el usuario lo confirme o cambie; solo entonces se envía `conceptos: []`.
- Listado: bajo un movimiento desglosado se muestran sus conceptos (nombre y monto); el total de la fila es el del movimiento.
- Errores: el panel ya agrupa errores por clave; se muestran `conceptos.N.nombre` y `conceptos.N.montoClp` junto a su fila, y `conceptos` y los 422 como error general. Lo ingresado se conserva.

**D14. Pruebas contra doble contabilización.**
- *Unitarias:* `sumarConceptos` (ejemplo 150.000, lista vacía, montos grandes, valor inválido), `esMontoEnteroTexto`, esquemas (nombre vacío o largo, 51 conceptos, monto no entero, `conceptos: null` → 400, `conceptos: []` sin `montoClp` → 400, `montoClp` ausente sin conceptos: 400 en el alta y permitido en la edición, ausencia distinta de lista vacía, compatibilidad de la salida simple).
- *Integración de T07:* alta desglosada; la suma como total; total enviado coincidente y discordante (422 sin escribir); suma sobre 14 dígitos (422); conversión en ambos sentidos; **protección contra pérdida accidental de conceptos** (`PUT` sin `conceptos` sobre un desglosado con y sin `montoClp`, con `montoClp` igual al total, con `montoClp` distinto → 422 sin cambios, y edición de solo la fecha o la descripción); `conceptos: []` (convierte de forma atómica, sin `montoClp` → 400, `montoClp` ≤ 0 → 422) y `conceptos: null` (400); un 422 de reemplazo deja conceptos y total originales; reemplazo exacto; orden preservado; cascada al eliminar; `CHECK` del concepto; pertenencia y aislamiento; el listado trae un movimiento, no cuatro, y su total no suma conceptos; registros antiguos con `conceptos: []`.
- *Integración de T09 (solo pruebas):* un desglosado de 150.000 cuenta 150.000 y no 300.000; simples y desglosados en el mismo mes; el flujo neto; cartera igual a la suma de propiedades; la actividad reciente muestra un único elemento; la conversión y la eliminación se reflejan en la siguiente consulta.

## Risks / Trade-offs

- **[El total puede desviarse ante una escritura directa a la base]** → solo la API escribe; atomicidad (D6); consulta de verificación documentada en las tareas; sin trigger por proporcionalidad.
- **[Un cliente que desconoce los conceptos podría borrar un desglose al editar]** → omitir `conceptos` los conserva (D7); solo `conceptos: []` los elimina; el `montoClp` reenviado debe coincidir con el total o se rechaza con 422.
- **[`PUT` deja de ser un reemplazo completo estricto: `conceptos` ausente significa «sin cambios»]** → documentado en D7 y en el spec; la UI no depende de la omisión.
- **[El 400 de «simple sin `montoClp`» depende del estado del registro]** → el servicio lanza un `ZodError` con ruta `montoClp` para conservar el 400 actual y `toHttpResponse` no cambia.
- **[La suma de conceptos puede exceder `NUMERIC(14,0)`]** → regla de servicio (422) antes de escribir; prueba específica.
- **[Un `include` adicional en cada lectura de T07]** → una consulta extra por lote, con decenas de filas por mes; sin impacto en T09, que no lo usa.
- **[Cambiar la salida de Zod rompería las pruebas actuales]** → D5 preserva la forma de salida de los simples.
- **[La casilla y las filas dinámicas complican el formulario]** → se implementa sobre el mismo componente y estilos, sin librerías nuevas.
- **[`ON DELETE CASCADE` es la primera FK que no es `Restrict`]** → justificado por composición; solo aplica a una tabla hija sin consumidores externos.

## Migration Plan

1. Agregar el modelo a `prisma/schema.prisma`; generar el SQL con `prisma migrate diff` (sin conexión) y guardarlo como `prisma/migrations/<timestamp>_add_movimiento_concepto/migration.sql`, con el `CHECK` añadido a mano y la FK en cascada revisada.
2. El usuario aplica la migración a `realtytrack` y `realtytrack_test` y ejecuta `prisma generate`. El agente no ejecuta migraciones y se detiene en este punto hasta que el usuario confirme.
3. Despliegue: `prisma migrate deploy`; tabla nueva, sin tocar datos existentes.
4. Rollback: revertir el código y eliminar la tabla `movimiento_concepto` en una migración posterior. Los movimientos conservan su `monto_clp`, por lo que ningún total se pierde.

## Open Questions

Ninguna bloqueante. Supuestos registrados: los límites de 50 conceptos y 100 caracteres son técnicos y reversibles; el `orden` es el índice del arreglo enviado; el nombre se guarda recortado; `retirar-aportes-dashboard` sigue activo y sin archivar, y no interfiere porque este change solo añade un requisito a `financial-dashboard`.
