## ADDED Requirements

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

### Requirement: La UF es el dato principal y el equivalente en CLP no está disponible hasta T10
La interfaz SHALL mostrar la cuota y el saldo inicial en UF. El equivalente en CLP SHALL mostrarse como «No disponible» hasta que T10 aporte `valor_uf_periodo`. El sistema SHALL NOT persistir equivalentes en CLP ni usar valores de UF simulados fuera de las pruebas unitarias.

#### Scenario: Visualización del crédito
- **WHEN** se muestra un crédito con cuota y saldo inicial
- **THEN** ambos aparecen en UF y su equivalente en CLP aparece como «No disponible»

#### Scenario: Criterio pendiente de integración
- **WHEN** se revisa el criterio AC3 (equivalente en CLP con el valor de la UF del período)
- **THEN** consta como pendiente de integración con T10 y no como cumplido

### Requirement: Alcance de T02 respecto de T03
El crédito de T02 SHALL almacenar solo condiciones contractuales. `cuotaContractualUf` es la cuota pactada, no un dividendo pagado. El sistema SHALL NOT registrar dividendos pagados, saldos mensuales, saldo actual derivado, amortización ni movimientos financieros en este cambio.

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
