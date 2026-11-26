## ADDED Requirements

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
