## Context

RealtyTrack guarda cuotas y saldos del crédito en UF (`Decimal(12,4)`) y el resto en CLP. Hoy no hay integración con la UF: `server/domain/uf.ts` ya ofrece `convertirUfAClp` (pura, `Decimal` de precisión 40, rechaza valor ≤ 0, sin uso aún) y las páginas del crédito y del registro mensual muestran un texto fijo «No disponible». El dashboard (`dashboard-service`) devuelve `saldoCredito = { periodo, saldoPendienteUf }` sin equivalente. No existen `server/uf/`, el modelo `valor_uf_periodo` ni variables de entorno de UF.

Decisiones ya aprobadas: proveedor `findic.cl` (`GET /api/uf/{dd-mm-yyyy}`; respuesta `{serie:[{fecha,valor}]}`, con `serie: []` si no hay datos), día 1 como referencia del período, persistencia sin sobrescritura, sin estimaciones, conversiones en backend con `Decimal` y sin endpoints nuevos. Arquitectura base: `docs/architecture.md` §12 (puerto `ProveedorUf`, bajo demanda, sin cron) y `docs/data-model.md` §4.12.

Restricciones: T01–T09 no cambian de comportamiento; sin dependencias nuevas; tipado estricto sin `any`; sin cálculo financiero en componentes React.

## Goals / Non-Goals

**Goals:**
- Obtener y conservar el valor de la UF por período, estable en el histórico.
- Mostrar equivalentes en CLP opcionales en crédito, registro mensual y dashboard, con la fecha de referencia de la UF.
- Degradar con `null` / «No disponible» sin estimar ante datos ausentes o fallos del proveedor.

**Non-Goals:**
- Serie diaria de UF, UF «del día del hecho» o último día del mes (otras políticas de día).
- Precarga programada, reintentos, caché en memoria o circuit breaker.
- Cambiar rentabilidad, flujo neto, dividendos o estados de pago.
- Endpoints nuevos, importadores o API de varios proveedores en paralelo.
- Persistir equivalentes en CLP.

## Decisions

**D1 — Estructura `server/uf/`.** `proveedor.ts` (tipo `ProveedorUf` y resultado discriminado), `findic.ts` (cliente HTTP), `uf-service.ts` (`createUfService(prisma, proveedor)`, como el resto de servicios con fábrica) y `equivalente.ts` (helper que combina `convertirUfAClp` con una UF obtenida). Alternativa descartada: llamar a `fetch` dentro de cada servicio de crédito/dashboard; duplicaría validación y errores.

**D2 — Resultado explícito, no excepciones, en el puerto.** `ProveedorUf.obtener(fecha)` devuelve `{ tipo: "ok", valorClp, fechaValor } | { tipo: "sin-datos" } | { tipo: "error", motivo }`. Los fallos esperados (HTTP, timeout, JSON inválido, valor inválido, fecha distinta) no lanzan; el servicio decide. Se registra el motivo con `console.error` sin datos sensibles. Alternativa: excepciones tipadas; obliga a `try/catch` en cada consumidor opcional.

**D3 — Validación con zod y conversión inmediata a Decimal.** findic.cl devuelve `valor` como número JSON, de modo que `res.json()` lo entrega como `number`. El cuerpo se valida con un esquema zod (`serie` de longitud 1, `fecha` igual a la solicitada, `valor` `z.number()` finito y positivo) y de inmediato se convierte a `Prisma.Decimal` (vía su representación textual más corta, p. ej. `new Decimal(String(valor))`); una verificación sobre el `Decimal` exige a lo sumo 2 decimales y un máximo compatible con `NUMERIC(12,2)`. A partir de ahí el valor viaja como `Decimal`/texto y se persiste como `Decimal`; **no se hace ninguna operación monetaria con `number`**, y la conversión a `Decimal` es el único uso del `number` recibido. Sin parsers ni dependencias adicionales (no se parsea el cuerpo como texto crudo). `fetch` con `AbortSignal.timeout(5000)` y `cache: "no-store"` para que Next no cachee la respuesta (la caché es la BD).

**D4 — Día 1 como constante única.** `fechaReferenciaPeriodo(periodo)` devuelve `YYYY-MM-01`; es el único punto donde vive la política (`architecture.md` §12.5). `valor_uf_periodo.periodo` es `DATE` día 1 y `fecha_valor` guarda el día consultado (hoy siempre igual), de modo que cambiar la política no exige cambiar el esquema.

**D5 — Persistencia idempotente.** `createMany({ data, skipDuplicates: true })` (equivale a `INSERT … ON CONFLICT DO NOTHING`) seguido de una relectura por PK; se devuelve lo que quedó almacenado. Dos solicitudes concurrentes terminan con una fila y el mismo valor, sin error de clave duplicada. Nunca `upsert` ni `update`. Alternativa descartada: `findFirst` + `create`, que tiene una ventana de carrera.

**D6 — Lectura por lote, solo lo necesario y con concurrencia acotada.** `obtenerValores(periodos: string[])` deduplica, hace un `findMany` por PK y consulta al proveedor únicamente los períodos sin valor almacenado. Esas consultas se ejecutan con un **máximo de 6 llamadas HTTP simultáneas** (`UF_MAX_CONCURRENCIA`, un grupo de trabajadores propio, sin dependencias), con el timeout individual de 5 s. Dentro de cada invocación hay además un **corte anticipado**: tras **6 fallos consecutivos** (error, timeout, excepción o respuesta inconsistente; `UF_UMBRAL_FALLOS`) se deja de *iniciar* consultas, las ya iniciadas terminan normalmente y sus valores válidos se persisten, y los períodos no consultados quedan sin equivalente. «Consecutivos» se mide en orden de finalización; una respuesta válida o una serie vacía (ausencia legítima) reinician el contador, y la serie vacía nunca cuenta como fallo. No hay estado entre invocaciones. Una cota: como mucho se inician umbral + concurrencia − 1 = 11 consultas. Los consumidores reúnen los períodos antes de resolver (el dashboard solo necesita uno: el mes consultado). Un período futuro sin datos no se persiste. Ver «Riesgos / Trade-offs» para la latencia con el proveedor caído. Alternativa descartada: `Promise.all` sin límite, que con un historial largo dispararía decenas de llamadas simultáneas y esperaría varias rondas de timeout.

**D7 — Qué período usa cada equivalente.** Verificado en `prisma/schema.prisma`: el crédito solo tiene `fechaOtorgamiento` (`DATE`, nullable) como fecha propia; el registro mensual tiene `periodo` (día 1).
- Cuota contractual: UF del mes actual (`hoyChile()`), como equivalente «actual».
- Saldo inicial: UF del mes de `fechaOtorgamiento`, tomada como fecha de inicio del crédito (es la única fecha contractual disponible). Si es `null`, el equivalente es `null`, con la limitación indicada («Sin fecha de otorgamiento»); no se usa otro mes.
- «Último saldo registrado» y saldo de cada registro mensual: UF del `periodo` del propio registro.
- Saldo del dashboard: UF del mes consultado (`mes`), de modo que un histórico se vea con la UF de ese mes; el período del registro aplicable se sigue mostrando junto al saldo en UF.
Los montos originales en UF y los cálculos existentes no se modifican. Cada equivalente va con la `fechaReferencia` de la UF usada.

**D8 — DTOs: campos nuevos opcionales.** Se agrega un tipo común `EquivalenteClpDto = { valorClp: string; ufClp: string; fechaReferencia: string } | null` (equivalente exacto como texto, valor de la UF usada y su fecha). Ejemplos: `cuotaContractualClp`, `saldoInicialClp`, `ultimoSaldo.equivalenteClp`, `saldoClp` en el registro mensual y `saldoCredito.equivalenteClp` en el dashboard. Los campos existentes no se tocan ni se renombran, por lo que los clientes y tests actuales siguen válidos. Las rutas de API no cambian; solo crece el cuerpo.

**D9 — Presentación.** Las páginas son componentes de servidor; formatean el texto decimal con helpers puros de `server/uf/equivalente.ts` (redondeo a entero solo al presentar) y no calculan nada. La referencia de la UF utilizada depende de la pantalla, para no repetirla en cada importe:
- **Crédito hipotecario:** sección centralizada «Valores de UF utilizados», debajo del título, que lista cada referencia distinta una sola vez (mes, valor de la UF y fecha exacta). Junto a cada monto solo se muestra el equivalente `CLP: $ X`, y el mes abreviado únicamente cuando hay más de una referencia que distinguir. Si ninguna UF estuvo disponible, la sección no se muestra.
- **Registro mensual:** cada período tiene su propia UF, así que no hay nada que deduplicar: la referencia individual (`UF $ … · fecha`) va como línea secundaria discreta bajo el equivalente de esa fila.
- **Dashboard:** una única referencia compartida bajo la tabla, con la UF del mes consultado, su fecha y la aclaración de que el período de cada saldo puede ser anterior; solo aparece si alguna UF se utilizó.
En todos los casos: «No disponible» cuando falta la UF y «Sin fecha de otorgamiento» para el saldo inicial sin `fechaOtorgamiento`. Sin cálculo monetario en componentes.

**D10 — Sin error 503 en T10.** Todos los equivalentes son opcionales y degradan a `null`, por lo que no se implementa `UfNoDisponibleError` ni su mapeo a 503: no habría consumidor (YAGNI). El criterio AC4 del ticket (error explícito de dependencia externa si el resultado principal depende de la UF) queda documentado como regla para futuras operaciones y se refleja en la spec; se implementará cuando exista un caso real. `server/errors.ts` no cambia.

**D11 — Configuración.** `UF_API_BASE_URL` con valor por defecto `https://findic.cl/api/uf`, documentada en `.env.example`. La fuente se persiste como `findic.cl`.

**D12 — Base de datos.** Un modelo Prisma `ValorUfPeriodo` mapeado a `valor_uf_periodo` (`@db.Date` para `periodo`/`fecha_valor`, `Decimal(12,2)`, `Timestamptz` para `obtenido_en`) y una migración SQL con `CHECK (valor_clp > 0)` y `CHECK (EXTRACT(DAY FROM periodo) = 1)`, siguiendo la práctica de las migraciones previas de CHECK a mano.

## Risks / Trade-offs

- [findic.cl no oficial y sin SLA] → Cualquier fallo degrada a `null`/«No disponible»; el puerto permite cambiar de proveedor; los períodos ya almacenados no dependen de él.
- [Latencia: una consulta externa en el camino de lectura de páginas] → Timeout de 5 s, deduplicación de períodos, consulta solo de faltantes y persistencia, de modo que cada período se consulta una vez en la vida del sistema.
- [Valor de un período con día 1 puede alejarse del saldo informado por el banco a fin de mes] → Política aprobada; documentada y aislada en D4.
- [Una respuesta inválida o parcial del proveedor se persistiera] → Validación estricta antes de persistir y CHECKs en BD; nunca se persiste un resultado no válido.
- [Historiales largos con el proveedor caído o lento] → Los períodos faltantes se consultan con 6 llamadas simultáneas como máximo (`UF_MAX_CONCURRENCIA`, solo períodos no almacenados) y timeout individual de 5 s. **Corte anticipado** (`UF_UMBRAL_FALLOS` = 6), local a cada invocación de `obtenerValores` y sin estado entre solicitudes: al acumular 6 fallos consecutivos —error, timeout, excepción o respuesta inconsistente—, deja de iniciar consultas; las ya iniciadas terminan y sus valores válidos se persisten; los períodos no consultados quedan sin equivalente (nunca estimados) y no se persiste ningún error. «Consecutivos» se mide en orden de finalización; una respuesta válida o una serie vacía (ausencia legítima: el proveedor respondió) reinician el contador, y la serie vacía nunca cuenta como fallo. Una vez cortada, la invocación no se reanuda; la siguiente empieza de cero. Cota: como mucho umbral + concurrencia − 1 = 11 consultas iniciadas. Peor caso con proveedor sin responder: ≈ 2 rondas de timeout (~10 s) en lugar de ⌈N/6⌉ × 5 s (36 meses ≈ 30 s). Con errores inmediatos el costo es despreciable.
- [Concurrencia] → Inserción idempotente + relectura (D5), con prueba de integración.
- [La cuota se convierte con la UF del mes actual y su equivalente cambia de un mes a otro] → Es la lectura natural de un dato contractual «actual»; se muestra la fecha de referencia.
- [`fechaOtorgamiento` podría no coincidir con el inicio efectivo del crédito o no estar registrada] → Si falta, el equivalente del saldo inicial es `null`; no se infiere otra fecha. Se pide confirmar que se acepta como fecha de inicio.
- [`valor` llega como `number` JSON] → Se convierte a `Decimal` en el borde, con validación de 2 decimales; el riesgo de coma flotante queda acotado a esa lectura.
- [Pruebas de integración usan la base de datos de pruebas] → Las pruebas usan un doble de `ProveedorUf` y limpian solo `valor_uf_periodo`; nunca llaman a findic.cl.

## Migration Plan

1. Crear la migración con la tabla y los CHECK; aplicarla primero en la base de pruebas y luego en desarrollo con el flujo habitual de Prisma (`migrate dev`/`deploy`), a ejecutar durante la implementación.
2. Desplegar el código; la tabla vacía es válida: los períodos se llenan bajo demanda.
3. Rollback: revertir el código (los campos nuevos son opcionales) y, si se requiere, eliminar la tabla con una migración inversa; ningún dato existente depende de ella.

## Open Questions

- ¿Se acepta `fechaOtorgamiento` como fecha de inicio del crédito para el saldo inicial? Es el único campo de fecha del crédito; si prefieres otro criterio, hay que indicarlo (no existe un campo «fecha de inicio» separado).
- ¿Se confirma que el día 1 queda como decisión V3 / P1 aprobada en `architecture.md` y `data-model.md`? Se propone actualizarlos así.
