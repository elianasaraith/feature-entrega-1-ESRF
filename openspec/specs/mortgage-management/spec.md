# mortgage-management Specification

## Purpose

Esta capability define la gestión del crédito hipotecario de una propiedad en RealtyTrack (T02): alta, consulta y edición de sus condiciones contractuales en UF (relación 1 : 0..1 con la propiedad), validación alineada con el modelo de datos y conversión UF → CLP como función pura. La UF es el dato principal del crédito y el equivalente en CLP es opcional: se calcula en el backend con la UF del período correspondiente (T10) y se muestra «No disponible» cuando esa UF no existe; el registro mensual de dividendo y saldo pertenece a T03.
## Requirements
### Requirement: Alta del crédito hipotecario
El sistema SHALL registrar el crédito hipotecario de una propiedad existente con banco, cuota contractual (UF), tasa de interés anual, número total de cuotas y día de vencimiento como datos obligatorios; número de crédito, fecha de otorgamiento, monto original (UF), seguros (UF) y saldo inicial (UF) son opcionales. Una propiedad SHALL tener como máximo un crédito.

#### Scenario: Alta completa
- **WHEN** un usuario autenticado envía todos los datos válidos para una propiedad sin crédito
- **THEN** el sistema responde 201 y el crédito queda asociado únicamente a esa propiedad

#### Scenario: Alta solo con datos obligatorios
- **WHEN** se envían solo los cinco campos obligatorios
- **THEN** el crédito se crea con los opcionales ausentes (`null`)

#### Scenario: Segundo crédito para la misma propiedad
- **WHEN** se hace POST para una propiedad que ya tiene crédito
- **THEN** el sistema responde 409 y no modifica el crédito existente

#### Scenario: Propiedad inexistente
- **WHEN** se hace POST para un identificador que no existe o no es un UUID válido
- **THEN** el sistema responde 404

### Requirement: Consulta del crédito de una propiedad
El sistema SHALL devolver el crédito de una propiedad con la cuota y el saldo inicial en UF, montos y tasa como texto decimal sin pérdida de precisión, y fechas como `YYYY-MM-DD`.

#### Scenario: Propiedad con crédito
- **WHEN** un usuario autenticado consulta una propiedad con crédito
- **THEN** el sistema devuelve sus condiciones, con cuota y saldo inicial expresados en UF

#### Scenario: Propiedad sin crédito
- **WHEN** se consulta el crédito de una propiedad existente que no tiene uno
- **THEN** el sistema responde 404 y la propiedad sigue siendo válida, sin dividendo ni saldo pendiente

#### Scenario: Propiedad inexistente
- **WHEN** se consulta el crédito de una propiedad que no existe o con un id que no es UUID
- **THEN** el sistema responde 404

### Requirement: Edición del crédito existente
El sistema SHALL permitir actualizar, con cuerpo completo, únicamente un crédito ya existente. No SHALL crear un crédito mediante PUT.

#### Scenario: Actualización válida
- **WHEN** se hace PUT con datos válidos para una propiedad que tiene crédito
- **THEN** el sistema responde 200 con las condiciones actualizadas

#### Scenario: PUT sobre propiedad existente sin crédito
- **WHEN** se hace PUT para una propiedad existente que no tiene crédito
- **THEN** el sistema responde 404 y no crea ningún crédito

#### Scenario: PUT sobre propiedad inexistente
- **WHEN** se hace PUT para una propiedad que no existe
- **THEN** el sistema responde 404

### Requirement: Validación de las condiciones del crédito
El sistema SHALL validar la entrada según `docs/data-model.md` §4.3 y responder 400 con errores por campo ante datos inválidos. Los CHECK de PostgreSQL SHALL replicar estas restricciones como red de seguridad. El sistema SHALL NOT aplicar reglas que el modelo no define.

- `banco`: texto obligatorio, no vacío.
- `cuotaContractualUf`: > 0, máximo 4 decimales, dentro de `NUMERIC(12,4)`.
- `tasaInteresAnual`: ≥ 0, máximo 4 decimales, dentro de `NUMERIC(6,4)`.
- `numeroCuotasTotal`: entero > 0.
- `diaVencimiento`: entero entre 1 y 31.
- `montoOriginalUf` (opcional): > 0. `segurosUf` y `saldoInicialUf` (opcionales): ≥ 0; todos con máximo 4 decimales y dentro de `NUMERIC(12,4)`.
- `fechaOtorgamiento` (opcional): fecha calendario real `YYYY-MM-DD`.
- `numeroCredito` (opcional): texto; vacío se guarda como `null`.

#### Scenario: Campo obligatorio ausente
- **WHEN** falta banco, cuota, tasa, número de cuotas o día de vencimiento
- **THEN** el sistema responde 400 indicando el campo

#### Scenario: Valores fuera de rango
- **WHEN** la cuota es ≤ 0, la tasa es negativa, las cuotas no son un entero positivo, el día es 0 o 32, o un monto UF supera 4 decimales o su rango
- **THEN** el sistema responde 400 y no persiste nada

#### Scenario: Cero permitido donde el modelo lo permite
- **WHEN** la tasa, los seguros o el saldo inicial valen 0
- **THEN** el sistema los acepta

#### Scenario: Fecha inexistente
- **WHEN** `fechaOtorgamiento` es `2026-02-30`
- **THEN** el sistema responde 400

#### Scenario: Sin reglas cruzadas inventadas
- **WHEN** el saldo inicial supera el monto original, o la fecha de otorgamiento es anterior a la de compra
- **THEN** el sistema acepta el crédito, porque el modelo no define esas reglas

#### Scenario: Precisión decimal preservada
- **WHEN** se envía `cuotaContractualUf` `"12.3456"` y tasa `"4.1250"`
- **THEN** el valor consultado coincide exactamente, sin conversión a `Number`

### Requirement: Conversión UF a CLP como función pura
El sistema SHALL ofrecer una función pura de dominio que convierte un importe en UF a CLP multiplicando por el valor de la UF recibido como parámetro, sin persistir el resultado y sin obtener la UF por sí misma. La función SHALL operar sin pasar por `Number` y el redondeo SHALL aplicarse solo al presentar.

#### Scenario: Conversión con valor fijo
- **WHEN** se convierte un importe en UF con un valor de UF dado
- **THEN** el resultado es exactamente el producto de ambos

#### Scenario: Valor de UF inválido
- **WHEN** el valor de UF recibido es ≤ 0
- **THEN** la función rechaza la entrada en lugar de devolver una cifra

### Requirement: Alcance de T02 respecto de T03
El crédito de T02 SHALL almacenar solo condiciones contractuales. `cuotaContractualUf` es la cuota pactada, no un dividendo pagado. El registro del dividendo pagado y del saldo mensual SHALL pertenecer a `credit-monthly-record` (T03), no a `credito_hipotecario`. El sistema SHALL NOT registrar dividendos pagados, saldos mensuales, saldo actual derivado, amortización ni movimientos financieros en la tabla del crédito.

#### Scenario: Sin columna de saldo vigente
- **WHEN** se inspecciona el esquema del crédito
- **THEN** no existen columnas de saldo actual, dividendo pagado ni equivalente en CLP

### Requirement: Acceso protegido
Todos los endpoints del crédito SHALL exigir sesión y no SHALL exponer eliminación.

#### Scenario: Sin sesión
- **WHEN** se llama a cualquier método de `/api/propiedades/[id]/credito` sin sesión
- **THEN** el sistema responde 401 JSON

#### Scenario: DELETE no soportado
- **WHEN** se envía DELETE al endpoint del crédito
- **THEN** el sistema responde 405

### Requirement: La UF es el dato principal y el equivalente en CLP es opcional
La interfaz SHALL mostrar la cuota contractual, el saldo inicial y el «Último saldo registrado» en UF como dato principal. El equivalente en CLP SHALL calcularse en el backend con el valor de la UF de `valor_uf_periodo` y SHALL mostrarse junto a la UF, sin reemplazarla ni modificar el monto original. La referencia temporal SHALL ser: para la cuota contractual, el mes actual (`hoyChile()`); para el saldo inicial, el mes de `fechaOtorgamiento` (único campo de fecha del crédito); para el último saldo registrado, el período de su registro. Si `fechaOtorgamiento` es `null`, el equivalente del saldo inicial SHALL ser `null` y la interfaz SHALL indicar la limitación («Sin fecha de otorgamiento»), sin inventar otra referencia. Cuando no exista UF para el período requerido, el equivalente SHALL ser `null` y la interfaz SHALL mostrar «No disponible». La interfaz SHALL mostrar la fecha de referencia de la UF usada. El sistema SHALL NOT persistir equivalentes en CLP, estimar la UF ni usar el valor de otro período. La página del crédito SHALL además mostrar el «Último saldo registrado» en UF con su período, tomado del registro mensual de período máximo con saldo no nulo, diferenciado del saldo inicial, o «No registrado» si no existe; SHALL NOT rotularlo «Saldo actual» ni calcular o proyectar saldos. La consulta del crédito SHALL conservar sus campos actuales y SHALL añadir los equivalentes en CLP y la UF usada como campos opcionales.

#### Scenario: Cuota con UF del mes actual
- **WHEN** se muestra un crédito y existe la UF del mes actual
- **THEN** la cuota contractual aparece en UF con su equivalente en CLP, y la UF utilizada y su fecha de referencia se presentan en la sección centralizada «Valores de UF utilizados» (una sola vez por referencia distinta)

#### Scenario: Saldo inicial con UF del mes de otorgamiento
- **WHEN** el crédito tiene `fechaOtorgamiento` en marzo de 2024 y saldo inicial, y existe la UF de marzo de 2024
- **THEN** el saldo inicial aparece en UF con su equivalente en CLP calculado con la UF del 1 de marzo de 2024, y esa referencia consta en la sección «Valores de UF utilizados»

#### Scenario: Saldo inicial sin fecha de otorgamiento
- **WHEN** el crédito tiene saldo inicial pero `fechaOtorgamiento` es `null`
- **THEN** el equivalente del saldo inicial es `null`, la interfaz indica «Sin fecha de otorgamiento» y no se usa el mes actual ni otro mes como sustituto

#### Scenario: Visualización sin UF
- **WHEN** no existe UF para el período requerido y el proveedor no aporta dato
- **THEN** la respuesta es 200, los importes en UF se muestran y el equivalente en CLP aparece como «No disponible»

#### Scenario: Último saldo registrado distinto del saldo inicial
- **WHEN** un crédito con saldo inicial tiene un saldo mensual registrado
- **THEN** la página muestra ambos por separado: «Saldo inicial» y «Último saldo registrado» con su período, este último con su equivalente en CLP calculado con la UF de ese período o «No disponible»

#### Scenario: Sin saldo mensual registrado
- **WHEN** el crédito no tiene ningún registro mensual con saldo
- **THEN** «Último saldo registrado» aparece como «No registrado»

#### Scenario: Compatibilidad de la consulta
- **WHEN** se consulta el crédito con la UF no disponible
- **THEN** todos los campos previos de la respuesta se mantienen iguales, los montos en UF no cambian y los campos de equivalente son `null`

### Requirement: Porcentaje de pie del crédito
El sistema SHALL permitir registrar en el crédito hipotecario el `porcentajePie` como dato opcional: porcentaje del valor de compra aportado como pago inicial. Se persiste como `NUMERIC(5,2)` (`porcentaje_pie`), con `CHECK` entre 0 y 100 inclusive. `null` SHALL significar «no informado» y `0` SHALL ser un valor válido distinto de `null`. El campo SHALL ser aceptado en el alta (POST) y la edición (PUT) y SHALL devolverse como texto decimal (o `null`) en la consulta, que SHALL conservar todos sus campos previos. Valor vacío, `null` o ausente SHALL guardarse como `null`; como el PUT es de cuerpo completo, omitirlo en una edición lo deja en `null`. El sistema SHALL NOT deducir el porcentaje a partir del monto original, asignar valores a créditos existentes ni modificar ningún monto contractual.

#### Scenario: Alta con porcentaje válido
- **WHEN** se crea un crédito con `porcentajePie` `"20.5"`
- **THEN** el sistema responde 201 y la consulta devuelve `porcentajePie` `"20.5"`

#### Scenario: Edición, cambio y retiro del porcentaje
- **WHEN** se edita un crédito cambiando `porcentajePie` y luego se edita enviándolo vacío o `null`
- **THEN** el valor se actualiza y después queda en `null`

#### Scenario: Valores límite
- **WHEN** `porcentajePie` es `0`, `"0.00"`, `100` o `"100.00"`
- **THEN** el sistema los acepta y `0` se conserva como `0`, no como `null`

#### Scenario: Valores decimales
- **WHEN** `porcentajePie` es `"12.34"` o `"12.5"`
- **THEN** el sistema los acepta sin pérdida de precisión

#### Scenario: Fuera de rango o con formato inválido
- **WHEN** `porcentajePie` es negativo, mayor que 100 (por ejemplo `"100.01"` o `101`), tiene más de dos decimales o no es numérico
- **THEN** el sistema responde 400 indicando el campo y no persiste nada

#### Scenario: Campo omitido o null
- **WHEN** se crea un crédito sin `porcentajePie` o con `null`
- **THEN** el crédito se crea con `porcentajePie` `null`

#### Scenario: Compatibilidad con créditos existentes
- **WHEN** se aplica la migración sobre créditos ya registrados
- **THEN** su `porcentajePie` es `null` y el resto de sus campos no cambia

### Requirement: Monto estimado del pie
La consulta del crédito con equivalentes SHALL añadir `pieEstimado` cuando `porcentajePie` no es `null`: el monto estimado del pie calculado como valor de compra registrado de la propiedad × `porcentajePie` / 100, expresado en la moneda original del valor de compra (CLP redondeado a entero, UF a 4 decimales, redondeo half-up solo al final), más el porcentaje restante `100 − porcentajePie`. El cálculo SHALL ser una función pura con aritmética decimal, SHALL NOT usar `Number` y SHALL NOT convertir monedas. `pieEstimado` SHALL ser `null` si `porcentajePie` es `null`. El monto SHALL NOT persistirse ni contabilizarse como egreso, y SHALL NOT afectar dividendos, saldos, equivalentes en CLP, pagos ni dashboard.

#### Scenario: Valor de compra en UF
- **WHEN** la propiedad vale `2000` UF y `porcentajePie` es `"20"`
- **THEN** `pieEstimado` es `400` UF y el restante `80`

#### Scenario: Valor de compra en CLP
- **WHEN** la propiedad vale `$ 100.000.001` y `porcentajePie` es `"12.5"`
- **THEN** el monto estimado es un entero CLP redondeado half-up, sin conversión a UF

#### Scenario: Porcentaje cero
- **WHEN** `porcentajePie` es `0`
- **THEN** `pieEstimado` existe con monto `0` y restante `100`

#### Scenario: Sin porcentaje
- **WHEN** `porcentajePie` es `null`
- **THEN** `pieEstimado` es `null`

### Requirement: Presentación del porcentaje de pie
Los formularios de creación y edición del crédito SHALL incluir el campo opcional «Porcentaje de pie (%)» con el texto de ayuda «Porcentaje del valor de compra aportado como pago inicial», que permita registrar, modificar y quitar el valor. El detalle del crédito SHALL mostrar el porcentaje de pie, el monto estimado del pie en la moneda del valor de compra con los formateadores existentes, y una barra con dos segmentos: pie y porcentaje restante del valor de compra. La barra SHALL NOT presentarse como porcentaje financiado por el banco. Cuando `porcentajePie` sea `null`, la interfaz SHALL mostrar «No informado», nunca 0 %, y SHALL omitir monto y barra.

#### Scenario: Detalle con pie informado
- **WHEN** el crédito tiene `porcentajePie` `"20"` y la propiedad vale `2000` UF
- **THEN** el detalle muestra «20 %», el monto estimado «400 UF» y una barra con 20 % de pie y 80 % restante del valor de compra

#### Scenario: Detalle sin pie informado
- **WHEN** `porcentajePie` es `null`
- **THEN** el detalle muestra «No informado» y no muestra monto estimado ni barra

#### Scenario: Pie en 0 %
- **WHEN** `porcentajePie` es `0`
- **THEN** el detalle muestra «0 %», distinto de «No informado»

#### Scenario: Quitar el porcentaje desde el formulario
- **WHEN** se vacía el campo en la edición y se guarda
- **THEN** el crédito queda con `porcentajePie` `null`

