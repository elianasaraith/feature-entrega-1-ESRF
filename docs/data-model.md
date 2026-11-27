# RealtyTrack — Modelo de datos

## 1. Propósito y alcance

Este documento define el **modelo de datos lógico del MVP**: qué entidades existen, qué
atributos tienen, cómo se relacionan, qué se persiste y qué se deriva.

Es el tercer eslabón de la cadena documental: [product.md](product.md) fija el problema y
las reglas de negocio, [user-stories.md](user-stories.md) las convierte en criterios
verificables, y aquí se resuelve cómo representarlas en PostgreSQL.

`product.md` §7.3 dejó seis preguntas abiertas para este documento. Todas quedan resueltas:

| Pregunta abierta | Resolución | Sección |
|---|---|---|
| Cómo se materializa el histórico de montos de arriendo | Entidad `contrato_monto`; el monto inicial es su primera fila | §4.7 |
| Cómo se representan los abonos frente al pago esperado | `abono_arriendo` N : 1 `pago_esperado`; el total recibido se deriva | §4.9 · §6 |
| Cómo se conserva la serie mensual de dividendo y saldo | Entidad `credito_registro_mensual`, una fila por crédito y mensualidad | §4.4 |
| Cómo se asocia el valor de UF a cada período mensual | Entidad `valor_uf_periodo`, un valor por período que no se sobrescribe | §4.12 · §8 |
| Qué categorías de movimiento se fijan | ENUM cerrado con valor `OTRO` | §4.10 |
| Cómo se desglosa un gasto en conceptos | Entidad hija `movimiento_concepto`; el total vive en el movimiento | §4.14 |

**Alcance.** Modelo lógico: entidades, atributos, tipos, restricciones y reglas de
derivación. No incluye migraciones, DDL definitivo, índices de rendimiento ajustados a
medición, endpoints, servicios ni componentes.

**Cómo leer este documento.** Toda afirmación es una regla de negocio confirmada en
`product.md` o una decisión técnica justificada, salvo las marcadas explícitamente como
*propuesta a validar*, que están pendientes de confirmación y no deben tratarse como
cerradas. Lo declarado fuera de alcance no existe en el modelo y no debe añadirse sin una
decisión de producto previa.

---

## 2. Convenciones

**Identificadores.** Toda entidad tiene una clave primaria `id UUID`. Las claves foráneas
se nombran `<entidad>_id`.

**Nomenclatura.** Tablas y columnas en español, `snake_case`, singular para la tabla
(`propiedad`, no `propiedades`). *Propuesta a validar*: mantener el español en el esquema
aunque el código sea TypeScript. Se elige por coherencia con el vocabulario de dominio, que
es el que usan `product.md` y `user-stories.md`.

**Importes.** Siempre `NUMERIC`, nunca `FLOAT` ni `DOUBLE PRECISION`: la coma flotante
introduce errores de redondeo inaceptables en cifras financieras.

| Unidad | Tipo | Motivo |
|---|---|---|
| CLP | `NUMERIC(14,0)` | el peso chileno no tiene subunidad; los importes son enteros |
| UF | `NUMERIC(12,4)` | la UF se expresa habitualmente con cuatro decimales |
| Valor de la UF en CLP | `NUMERIC(12,2)` | dos decimales, como lo publica la fuente oficial |
| Importe de **moneda variable** | `NUMERIC(14,4)` | una sola columna que puede contener UF o CLP necesita una precisión común |

La última fila aplica a un único caso: `propiedad.valor_compra_monto` (§4.2), cuya moneda es
un dato del registro y no una constante del modelo. La precisión es la unión de ambas
convenciones —catorce dígitos para el rango del peso, cuatro decimales para la UF—, de modo
que ninguna de las dos unidades pierde información. **Cuando la moneda es CLP, la parte
decimal debe ser cero**, y así se valida: el peso no tiene subunidad y un valor de compra con
centavos indicaría un error de captura.

Las conversiones UF → CLP son **derivadas** (§8) y se redondean solo al presentarlas.

**Período mensual.** Se representa como `DATE` normalizada al **día 1 del mes**, con
`CHECK (EXTRACT(DAY FROM periodo) = 1)`. Marzo de 2026 es `2026-03-01`. Se prefiere a
`CHAR(7)` `'2026-03'` y al par `(anio, mes)` porque ordena correctamente, admite rangos y
funciona con las funciones de fecha nativas sin conversiones.

Esta convención afecta solo a la **representación** del período. Qué valor de UF representa
a ese período es una cuestión distinta y sigue abierta (§8).

**Fechas y marcas de tiempo.** Los hechos del dominio llevan `DATE` —ocurren un día, no un
instante—. Los metadatos técnicos llevan `TIMESTAMPTZ`. Toda entidad registrable tiene
`created_at` y `updated_at TIMESTAMPTZ NOT NULL DEFAULT now()`.

**Enumeraciones.** Tipos `ENUM` de PostgreSQL, no tablas catálogo. Cada enumeración abierta
por naturaleza incluye un valor `OTRO`. Añadir un valor es una migración, no un rediseño.

**Borrado.** Borrado físico, sin `deleted_at`. El MVP es de usuario único y no requiere
papelera ni auditoría.

---

## 3. Diagrama del modelo de datos

```mermaid
erDiagram
    USUARIO {
        uuid id PK
        text email UK "NOT NULL"
        text password_hash "NOT NULL"
        timestamptz created_at "NOT NULL"
        timestamptz updated_at "NOT NULL"
    }

    PROPIEDAD {
        uuid id PK
        text numero_departamento "NOT NULL"
        text direccion "NULL - propuesta a validar"
        numeric superficie_m2 "NOT NULL - 8,2"
        numeric valor_compra_monto "NOT NULL - 14,4 - decimales cero si CLP"
        moneda valor_compra_moneda "NOT NULL - UF o CLP"
        date fecha_compra "NOT NULL"
        text estacionamiento "NULL - ausente si NULL"
        text bodega "NULL - ausente si NULL"
        timestamptz created_at "NOT NULL"
        timestamptz updated_at "NOT NULL"
    }

    CREDITO_HIPOTECARIO {
        uuid id PK
        uuid propiedad_id FK "NOT NULL UNIQUE"
        text banco "NOT NULL"
        text numero_credito "NULL"
        date fecha_otorgamiento "NULL"
        numeric monto_original_uf "NULL - 12,4"
        numeric cuota_contractual_uf "NOT NULL - 12,4"
        numeric tasa_interes_anual "NOT NULL - 6,4"
        integer numero_cuotas_total "NOT NULL"
        numeric seguros_uf "NULL - 12,4"
        smallint dia_vencimiento "NOT NULL - 1 a 31"
        numeric saldo_inicial_uf "NULL - 12,4"
        numeric porcentaje_pie "NULL - 5,2 - 0 a 100"
        timestamptz created_at "NOT NULL"
        timestamptz updated_at "NOT NULL"
    }

    CREDITO_REGISTRO_MENSUAL {
        uuid id PK
        uuid credito_id FK "NOT NULL"
        date periodo "NOT NULL - mensualidad hipotecaria"
        numeric dividendo_pagado_clp "NULL - 14,0"
        date fecha_pago_dividendo "NULL - fecha de caja; presente si y solo si hay dividendo"
        numeric saldo_pendiente_uf "NULL - 12,4"
        timestamptz created_at "NOT NULL"
        timestamptz updated_at "NOT NULL"
    }

    ARRENDATARIO {
        uuid id PK
        text nombre "NOT NULL"
        text rut UK "NULL"
        text email "NULL"
        text telefono "NULL"
        timestamptz created_at "NOT NULL"
        timestamptz updated_at "NOT NULL"
    }

    CONTRATO_ARRIENDO {
        uuid id PK
        uuid propiedad_id FK "NOT NULL"
        uuid arrendatario_id FK "NOT NULL"
        date fecha_inicio "NOT NULL"
        date fecha_termino "NOT NULL"
        numeric garantia_clp "NULL - 14,0"
        smallint dia_esperado_pago "NOT NULL - 1 a 31"
        text observaciones "NULL"
        timestamptz created_at "NOT NULL"
        timestamptz updated_at "NOT NULL"
    }

    CONTRATO_MONTO {
        uuid id PK
        uuid contrato_id FK "NOT NULL"
        numeric monto_mensual_clp "NOT NULL - 14,0"
        date vigente_desde_periodo "NOT NULL"
        text motivo "NULL"
        timestamptz created_at "NOT NULL"
        timestamptz updated_at "NOT NULL"
    }

    PAGO_ESPERADO {
        uuid id PK
        uuid contrato_id FK "NOT NULL"
        date periodo "NOT NULL - mes arrendado"
        numeric monto_esperado_clp "NOT NULL - 14,0"
        date fecha_esperada "NOT NULL"
        timestamptz created_at "NOT NULL"
        timestamptz updated_at "NOT NULL"
    }

    ABONO_ARRIENDO {
        uuid id PK
        uuid pago_esperado_id FK "NOT NULL"
        numeric monto_clp "NOT NULL - 14,0"
        date fecha_recepcion "NOT NULL - fecha de caja"
        text medio "NULL"
        timestamptz created_at "NOT NULL"
        timestamptz updated_at "NOT NULL"
    }

    MOVIMIENTO_FINANCIERO {
        uuid id PK
        uuid propiedad_id FK "NOT NULL"
        date fecha "NOT NULL - fecha de caja"
        categoria_movimiento categoria "NOT NULL"
        numeric monto_clp "NOT NULL - 14,0"
        text descripcion "NULL"
        timestamptz created_at "NOT NULL"
        timestamptz updated_at "NOT NULL"
    }

    MOVIMIENTO_CONCEPTO {
        uuid id PK
        uuid movimiento_financiero_id FK "NOT NULL - ON DELETE CASCADE"
        text nombre "NOT NULL"
        numeric monto_clp "NOT NULL - 14,0 - CHECK > 0"
        int orden "NOT NULL"
        timestamptz created_at "NOT NULL"
        timestamptz updated_at "NOT NULL"
    }

    VALOR_UF_PERIODO {
        date periodo PK
        numeric valor_clp "NOT NULL - 12,2"
        date fecha_valor "NOT NULL - dia concreto usado"
        text fuente "NOT NULL"
        timestamptz obtenido_en "NOT NULL"
    }

    DOCUMENTO {
        uuid id PK
        uuid propiedad_id FK "NOT NULL"
        uuid credito_id FK "NULL - excluyente"
        uuid contrato_id FK "NULL - excluyente"
        uuid abono_arriendo_id FK "NULL - excluyente"
        uuid movimiento_financiero_id FK "NULL - excluyente"
        tipo_documento tipo "NOT NULL"
        text nombre_archivo "NOT NULL"
        text mime_type "NOT NULL"
        bigint tamano_bytes "NOT NULL"
        text storage_key UK "NOT NULL"
        timestamptz subido_en "NOT NULL"
    }

    DOCUMENTO_SUBIDA {
        uuid id PK
        uuid propiedad_id FK "NOT NULL"
        tipo_documento tipo "NOT NULL"
        text nombre_archivo "NOT NULL"
        text mime_type "NOT NULL"
        bigint tamano_bytes "NOT NULL - mayor que 0"
        text clave_temporal UK "NOT NULL"
        text clave_definitiva UK "NOT NULL"
        estado_subida estado "NOT NULL"
        timestamptz expira_en "NOT NULL"
        timestamptz reclamada_en "NULL"
        uuid documento_id FK "NULL - UNIQUE"
        timestamptz creada_en "NOT NULL"
    }

    LOGIN_INTENTO {
        text clave PK "HMAC de cuenta o IP"
        integer contador "NOT NULL"
        timestamptz ventana_inicio "NOT NULL"
        timestamptz actualizado_en "NOT NULL"
    }

    PROPIEDAD ||--o| CREDITO_HIPOTECARIO : "tiene como maximo uno"
    CREDITO_HIPOTECARIO ||--o{ CREDITO_REGISTRO_MENSUAL : "registra mes a mes"
    PROPIEDAD ||--o{ CONTRATO_ARRIENDO : "arrienda mediante"
    ARRENDATARIO ||--o{ CONTRATO_ARRIENDO : "es parte de"
    CONTRATO_ARRIENDO ||--|{ CONTRATO_MONTO : "rige por"
    CONTRATO_ARRIENDO ||--o{ PAGO_ESPERADO : "genera"
    PAGO_ESPERADO ||--o{ ABONO_ARRIENDO : "se cubre con"
    PROPIEDAD ||--o{ MOVIMIENTO_FINANCIERO : "incurre en"
    MOVIMIENTO_FINANCIERO ||--o{ MOVIMIENTO_CONCEPTO : "se desglosa en"
    PROPIEDAD ||--o{ DOCUMENTO : "agrupa"
    CREDITO_HIPOTECARIO ||--o{ DOCUMENTO : "respaldado por"
    CONTRATO_ARRIENDO ||--o{ DOCUMENTO : "respaldado por"
    ABONO_ARRIENDO ||--o{ DOCUMENTO : "respaldado por"
    MOVIMIENTO_FINANCIERO ||--o{ DOCUMENTO : "respaldado por"
    PROPIEDAD ||--o{ DOCUMENTO_SUBIDA : "reserva"
    DOCUMENTO |o--o| DOCUMENTO_SUBIDA : "se completa desde"
```

`USUARIO` y `VALOR_UF_PERIODO` no tienen relaciones: el primero solo guarda credenciales
—el MVP es de usuario único, así que ninguna entidad de dominio lleva `usuario_id`— y el
segundo es una tabla de referencia que se consulta por período.

---

## 4. Entidades

### 4.1 `usuario`

Credenciales del único usuario del sistema.

| Atributo | Tipo | Nulo | Restricción | Descripción |
|---|---|---|---|---|
| `id` | `UUID` | No | PK | |
| `email` | `TEXT` | No | `UNIQUE` | Identificador de acceso |
| `password_hash` | `TEXT` | No | | Hash de la contraseña, nunca la contraseña |
| `created_at`, `updated_at` | `TIMESTAMPTZ` | No | | |

**Por qué no hay `usuario_id` en el resto del modelo.** El MVP es de usuario único
(`product.md` §7.2). Propagar la FK a las trece tablas añadiría trabajo en cada consulta
para expresar algo que ya es cierto por construcción. Si algún día hubiera multiusuario,
añadir la columna es una migración; anticiparla ahora sería sobreingeniería.

### 4.2 `propiedad`

Una unidad de la cartera. Raíz de la que cuelga todo lo demás.

| Atributo | Tipo | Nulo | Restricción | Descripción |
|---|---|---|---|---|
| `id` | `UUID` | No | PK | |
| `numero_departamento` | `TEXT` | No | | Identificación de la unidad |
| `direccion` | `TEXT` | Sí | | *Propuesta a validar*. `product.md` §6.1 no la exige; se incluye nulable porque el modelo es para N propiedades y las tres iniciales comparten edificio por circunstancia, no por diseño |
| `superficie_m2` | `NUMERIC(8,2)` | No | `> 0` | |
| `valor_compra_monto` | `NUMERIC(14,4)` | No | `> 0`; parte decimal cero si la moneda es `CLP` | Valor de adquisición. Precisión común a ambas unidades (§2) |
| `valor_compra_moneda` | `ENUM moneda` | No | `UF` \| `CLP` | En Chile la compra suele pactarse en UF; fijarla a CLP perdería el dato original |
| `fecha_compra` | `DATE` | No | | |
| `estacionamiento` | `TEXT` | Sí | | Identificación del estacionamiento. `NULL` = la propiedad no tiene |
| `bodega` | `TEXT` | Sí | | Identificación de la bodega. `NULL` = la propiedad no tiene |
| `created_at`, `updated_at` | `TIMESTAMPTZ` | No | | |

Estacionamiento y bodega son **columnas nulables**, no una entidad `unidad_anexa`: son
opcionales (HU01 E2) y el producto no les atribuye ningún dato propio más allá de su
identificación.

Añadir una propiedad es insertar una fila: no hay nada en el esquema que dependa de cuántas
haya (HU01 E3).

### 4.3 `credito_hipotecario`

Condiciones contractuales del crédito de una propiedad. **Opcional**: una propiedad sin
crédito es válida (HU01 CL10).

| Atributo | Tipo | Nulo | Restricción | Descripción |
|---|---|---|---|---|
| `id` | `UUID` | No | PK | |
| `propiedad_id` | `UUID` | No | FK → `propiedad`, **`UNIQUE`** | Un crédito por propiedad |
| `banco` | `TEXT` | No | | |
| `numero_credito` | `TEXT` | Sí | | Dato contractual |
| `fecha_otorgamiento` | `DATE` | Sí | | |
| `monto_original_uf` | `NUMERIC(12,4)` | Sí | `> 0` | Monto pactado |
| `cuota_contractual_uf` | `NUMERIC(12,4)` | No | `> 0` | **En UF**: es la cuota pactada, no el desembolso |
| `tasa_interes_anual` | `NUMERIC(6,4)` | No | `>= 0` | Porcentaje anual |
| `numero_cuotas_total` | `INTEGER` | No | `> 0` | |
| `seguros_uf` | `NUMERIC(12,4)` | Sí | `>= 0` | Seguros asociados a la cuota, en UF |
| `dia_vencimiento` | `SMALLINT` | No | `BETWEEN 1 AND 31` | Día de vencimiento de la cuota |
| `saldo_inicial_uf` | `NUMERIC(12,4)` | Sí | `>= 0` | Saldo informado al registrar el crédito |
| `porcentaje_pie` | `NUMERIC(5,2)` | Sí | `BETWEEN 0 AND 100` | Pie declarado: porcentaje del valor de compra aportado como pago inicial. `NULL` = no informado; `0` es un valor válido distinto |
| `created_at`, `updated_at` | `TIMESTAMPTZ` | No | | |

**`porcentaje_pie` es un dato informado, no derivado.** No se deduce del `monto_original_uf`
(el porcentaje financiado por el banco puede diferir del complemento del pie), no altera montos
contractuales, dividendos, saldos, UF, pagos ni dashboard, y el pie no es un egreso mensual. El monto
estimado del pie se calcula al consultar (valor de compra de la propiedad × porcentaje / 100, en la
moneda original del valor de compra) y no se persiste. Migración no destructiva: columna nullable
sin `DEFAULT`; los créditos existentes quedan en `NULL`.

**No existe columna de saldo vigente.** El saldo actual se deriva del registro mensual más
reciente (§6). Una columna `saldo_actual` sería un segundo lugar donde la verdad puede
contradecirse.

**No existe tabla de amortización.** El sistema no reproduce la lógica del banco: guarda
hechos registrados, no cálculos propios (`product.md` §6.2, §8).

`UNIQUE(propiedad_id)` fija la relación 1 : 0..1. Si en el futuro una propiedad necesitara
más de un crédito, retirar la restricción es una migración no destructiva.

### 4.4 `credito_registro_mensual`

Serie mensual del crédito: lo que el usuario registra cada mes a partir de la información
del banco. **Es lo que hace consultable el saldo de un mes anterior.**

| Atributo | Tipo | Nulo | Restricción | Descripción |
|---|---|---|---|---|
| `id` | `UUID` | No | PK | |
| `credito_id` | `UUID` | No | FK → `credito_hipotecario` | |
| `periodo` | `DATE` | No | día 1 del mes | **Mensualidad hipotecaria** a la que corresponde el registro |
| `dividendo_pagado_clp` | `NUMERIC(14,0)` | Sí | `> 0` | **En CLP**: el desembolso real constatado en la cartola |
| `fecha_pago_dividendo` | `DATE` | Sí | Obligatoria si hay dividendo; nula si no lo hay | **Fecha de caja**: cuándo ocurrió la salida efectiva de dinero |
| `saldo_pendiente_uf` | `NUMERIC(12,4)` | Sí | `>= 0` | **En UF**: saldo informado por el banco. Puede llegar a cero al liquidarse |
| `created_at`, `updated_at` | `TIMESTAMPTZ` | No | | |

**Restricciones**

| Restricción | Motivo |
|---|---|
| `UNIQUE (credito_id, periodo)` | Un registro por crédito y mensualidad |
| `CHECK (dividendo_pagado_clp IS NOT NULL OR saldo_pendiente_uf IS NOT NULL)` | Se admite saldo, dividendo o ambos, pero **nunca una fila con ambos nulos**: no registraría ningún hecho |
| `CHECK ((dividendo_pagado_clp IS NULL) = (fecha_pago_dividendo IS NULL))` | La fecha existe **si y solo si** hay dividendo: la fecha determina la imputación al flujo de caja, de modo que sin ella el dividendo no pertenecería a ningún mes, y sin dividendo no hay salida de caja que fechar |

**`periodo` y `fecha_pago_dividendo` son datos funcionales distintos, y ninguno sustituye
al otro.** `periodo` identifica la mensualidad hipotecaria; `fecha_pago_dividendo`
identifica cuándo salió el dinero. Un dividendo de la mensualidad de marzo pagado el 3 de
abril pertenece al histórico hipotecario de **marzo** y al flujo de caja de **abril** (§7).

**La ausencia de fila significa *no registrado*.** El sistema no estima, no proyecta y no
arrastra el valor del mes anterior (HU01 CL11, CL12).

En la misma fila conviven dos unidades deliberadamente: el dividendo en CLP porque es un
desembolso real, el saldo en UF porque es el dato que informa el banco.

### 4.5 `arrendatario`

La persona que arrienda. Entidad propia, reutilizable entre contratos sucesivos.

| Atributo | Tipo | Nulo | Restricción | Descripción |
|---|---|---|---|---|
| `id` | `UUID` | No | PK | |
| `nombre` | `TEXT` | No | | |
| `rut` | `TEXT` | Sí | `UNIQUE` | Nulable porque puede registrarse antes de disponer del dato |
| `email` | `TEXT` | Sí | | |
| `telefono` | `TEXT` | Sí | | |
| `created_at`, `updated_at` | `TIMESTAMPTZ` | No | | |

Se prefiere a denormalizar los datos en el contrato por tres razones: el mismo arrendatario
puede figurar en contratos sucesivos, el RUT admite `UNIQUE`, y la anonimización previa al
versionado que exige `CLAUDE.md` queda acotada a una sola tabla.

### 4.6 `contrato_arriendo`

Contrato de arriendo de una propiedad. Una propiedad puede tener contratos sucesivos, con
períodos sin arrendatario entre ellos.

| Atributo | Tipo | Nulo | Restricción | Descripción |
|---|---|---|---|---|
| `id` | `UUID` | No | PK | |
| `propiedad_id` | `UUID` | No | FK → `propiedad` | |
| `arrendatario_id` | `UUID` | No | FK → `arrendatario` | |
| `fecha_inicio` | `DATE` | No | | |
| `fecha_termino` | `DATE` | No | `>= fecha_inicio` | Una terminación anticipada se registra actualizando esta fecha |
| `garantia_clp` | `NUMERIC(14,0)` | Sí | `>= 0` | Información contractual |
| `dia_esperado_pago` | `SMALLINT` | No | `BETWEEN 1 AND 31` | Día del mes en que se espera el pago |
| `observaciones` | `TEXT` | Sí | | |
| `created_at`, `updated_at` | `TIMESTAMPTZ` | No | | |

**Sin columna de monto.** El monto vive en `contrato_monto` (§4.7), incluido el inicial.

**Sin columna `estado`.** `product.md` §6.3 enumera el «estado» entre la información del
contrato, y aquí **se materializa como vigencia derivada de `fecha_inicio` y
`fecha_termino`** (§6), no como columna persistida. La información no se pierde: se calcula.

El motivo es que una columna sería un segundo lugar donde la vigencia puede contradecir al
rango de fechas, y no aportaría nada que las fechas no digan ya — una terminación anticipada
se registra actualizando `fecha_termino`, y un contrato futuro, terminado o vigente se
distingue comparando su rango con la fecha de consulta.

**La garantía no es un ingreso.** Es información contractual y no figura en el flujo
mensual (HU02 E17). Su devolución, retención o uso está fuera de alcance.

**Restricción de negocio: los contratos de una misma propiedad no se solapan.** Se deduce
de que los contratos son sucesivos con períodos de vacancia entre ellos. Se implementa como
validación de aplicación. Una restricción `EXCLUDE USING gist (propiedad_id WITH =,
daterange(fecha_inicio, fecha_termino, '[]') WITH &&)` la impondría en la base de datos;
queda anotada como opción, no como requisito.

### 4.7 `contrato_monto`

Histórico de los montos aplicados a lo largo de un contrato. Una fila por monto vigente
desde un período.

| Atributo | Tipo | Nulo | Restricción | Descripción |
|---|---|---|---|---|
| `id` | `UUID` | No | PK | |
| `contrato_id` | `UUID` | No | FK → `contrato_arriendo` | |
| `monto_mensual_clp` | `NUMERIC(14,0)` | No | `> 0` | **En CLP**: los arriendos se manejan en pesos |
| `vigente_desde_periodo` | `DATE` | No | día 1 del mes | Primer período en que rige este monto |
| `motivo` | `TEXT` | Sí | | Por ejemplo, "monto inicial" o "reajuste anual" |
| `created_at`, `updated_at` | `TIMESTAMPTZ` | No | | |

`UNIQUE (contrato_id, vigente_desde_periodo)`. Todo contrato tiene **al menos una fila**.

> **Excepción temporal (propuesta a validar).** El monto inicial es **opcional** en el alta
> (T04): un contrato creado sin monto no tiene fila en esta tabla hasta que se le registre
> el primer monto. La invariante «al menos una fila» queda **relajada** mientras tanto, y T05
> la trata así: un contrato sin monto no genera pagos esperados. T05 registra el primer
> monto (siempre con `vigente_desde_periodo` = mes de `fecha_inicio`) y los reajustes como
> filas nuevas: el alta no modifica ni elimina filas anteriores; un período fuera de la vigencia
> del contrato se rechaza (422) y un período repetido también (409). La edición del contrato
> (T04) nunca escribe en esta tabla.

**Corrección y eliminación.** Además del alta, una fila puede corregirse (monto y motivo, no su
período), incluida la inicial. Un reajuste puede eliminarse; el monto inicial no. El alta, la
corrección y la eliminación se rechazan (422), sin cambios parciales, si modificarían el monto
esperado de un pago con abonos; los abonos nunca se modifican.

**El monto inicial es la primera fila, no una columna del contrato.** Esta es la decisión
central de la entidad: hay una única fuente de verdad para el monto, y un reajuste deja de
ser un caso especial —es simplemente otra fila—. El contrato conserva su identidad, su
arrendatario y su garantía (HU02 E3).

**La vigencia se expresa en período mensual, no en fecha.** Todo el ciclo del arriendo es
mensual, y así se evita la pregunta del prorrateo a mitad de mes, que está fuera de alcance.

Un **reajuste retroactivo** es una fila con `vigente_desde_periodo` anterior al mes en
curso (HU02 E5). Solo actualiza pagos ya generados si ninguno de los que cambiarían tiene
abonos; sus efectos se describen en §4.8 y §6.

### 4.8 `pago_esperado`

Lo que el sistema espera cobrar por arriendo en un período mensual. Se genera a partir del
contrato vigente.

| Atributo | Tipo | Nulo | Restricción | Descripción |
|---|---|---|---|---|
| `id` | `UUID` | No | PK | |
| `contrato_id` | `UUID` | No | FK → `contrato_arriendo` | |
| `periodo` | `DATE` | No | día 1 del mes | **Mes arrendado** al que corresponde el pago |
| `monto_esperado_clp` | `NUMERIC(14,0)` | No | `> 0` | Monto que regía en ese período |
| `fecha_esperada` | `DATE` | No | | Fecha en que se espera el pago |
| `created_at`, `updated_at` | `TIMESTAMPTZ` | No | | |

`UNIQUE (contrato_id, periodo)`. En la base: `CHECK (monto_esperado_clp > 0)` y período
en día 1 (T05). Sin estado ni abonos: el estado es derivado (T06, §6.1).

**Generación (T05).** Las filas solo las crea una **sincronización explícita** e idempotente,
nunca un `GET` ni un proceso programado: desde el mes de `fecha_inicio` hasta el menor entre
el mes en curso y el mes de `fecha_termino`, y solo si el contrato tiene un monto registrado.
La sincronización no modifica ni elimina filas existentes; el alta, la corrección o la
eliminación de un monto solo actualizan `monto_esperado_clp` (y `updated_at`) de las filas
afectadas desde su período, y nunca de pagos con abonos (§4.7).

**Se persiste, en lugar de derivarse al vuelo**, por dos razones: los abonos necesitan una
clave foránea estable a la que apuntar, y el producto exige que el pago esperado conserve el
monto correspondiente a su mes.

**`monto_esperado_clp` es un snapshot con invariante verificable**: debe coincidir con el
monto que `contrato_monto` da para ese período. Un reajuste retroactivo dispara un
**recálculo explícito** de los períodos afectados, tras el cual la invariante vuelve a
cumplirse. Modificar historia es legítimo: no existe cierre mensual ni inmutabilidad de
períodos (`product.md` §7.2).

**`fecha_esperada` se deriva de `dia_esperado_pago`** al generar la fila. Si el día no
existe en el mes —31 en febrero—, se usa el último día del mes.

**Sin `propiedad_id`.** Es alcanzable por `contrato_id`; denormalizarlo abriría la
posibilidad de que un pago apunte a una propiedad distinta de la de su contrato.

**Sin contrato vigente no hay fila**, y esa ausencia no significa impago: significa que no
se esperaba ingreso por arriendo (HU02 CL15).

### 4.9 `abono_arriendo`

Cada entrega de dinero recibida contra un pago esperado.

| Atributo | Tipo | Nulo | Restricción | Descripción |
|---|---|---|---|---|
| `id` | `UUID` | No | PK | |
| `pago_esperado_id` | `UUID` | No | FK → `pago_esperado` | |
| `monto_clp` | `NUMERIC(14,0)` | No | `> 0` | |
| `fecha_recepcion` | `DATE` | No | | **Fecha de caja**: cuándo entró el dinero |
| `medio` | `TEXT` | Sí | | Transferencia, depósito, efectivo |
| `created_at`, `updated_at` | `TIMESTAMPTZ` | No | | |

Un pago esperado admite **uno o varios abonos** (HU02 E6, E7). El total recibido es su suma,
y se deriva (§6).

**Sin restricción de tope.** Los abonos pueden exceder el monto esperado; el pago queda
cubierto y no se rechaza el registro (HU02 CL14).

El período de arriendo al que corresponde un abono **no se almacena**: se alcanza por
`pago_esperado.periodo` (§7). `medio` es un campo descriptivo y no es el lugar donde anotar
esa correspondencia.

### 4.10 `movimiento_financiero`

Egresos e inversiones de una propiedad.

| Atributo | Tipo | Nulo | Restricción | Descripción |
|---|---|---|---|---|
| `id` | `UUID` | No | PK | |
| `propiedad_id` | `UUID` | No | FK → `propiedad` | |
| `fecha` | `DATE` | No | | **Fecha de caja** del egreso |
| `categoria` | `ENUM categoria_movimiento` | No | | Ver valores abajo |
| `monto_clp` | `NUMERIC(14,0)` | No | `> 0` | |
| `descripcion` | `TEXT` | Sí | | |
| `created_at`, `updated_at` | `TIMESTAMPTZ` | No | | |

Valores de `categoria_movimiento`: `REPARACION` · `EQUIPAMIENTO` · `SEGURO` ·
`CONTRIBUCIONES` · `GASTO_COMUN` · `GASTO_EXTRAORDINARIO` · `OTRO`.

**No existe la categoría `DIVIDENDO`.** El dividendo se registra en
`credito_registro_mensual` (§4.4); una categoría homónima aquí duplicaría la misma salida de
dinero, que es precisamente el error que `product.md` §6.4 advierte.

**No existe columna `tipo` (ingreso/egreso).** Toda fila representa uso de recursos de la
propiedad. Un `tipo` abriría una segunda vía de ingresos que competiría con los abonos y
permitiría contabilizar el mismo dinero dos veces.

`GASTO_COMUN` existe para el caso de vacancia en que los paga el propietario (HU03 CL13).
Una etiqueta de enumeración no convierte los gastos comunes en un módulo administrado por el
producto: su administración ordinaria sigue fuera de alcance.

**`monto_clp` es siempre el total del gasto.** Un movimiento puede estar desglosado en
conceptos (§4.14); en ese caso `monto_clp` es la suma de sus conceptos y lo calcula el
servidor al escribir. Por eso T09 y todas las agregaciones leen solo `monto_clp` del
movimiento y **nunca suman los conceptos**: sumarlos de nuevo contaría el gasto dos veces.
No hay columna que distinga un gasto simple de uno desglosado: un movimiento sin conceptos es
simple.

### 4.11 (retirada) `aporte_capital`

Esta entidad se diseñó para registrar el capital propio incorporado a una propiedad (ticket
T08) y **se canceló por decisión de producto**: el MVP no registra aportes de capital. No
existe tabla ni enumeración de aportes: las migraciones `20261114120000_add_aporte_capital` y
`20261115120000_drop_aporte_capital` son un par de alta y retiro sin efecto neto. Se conserva el número de sección
para no alterar las referencias a §4.12 y §4.13.

### 4.12 `valor_uf_periodo`

Valor de la UF asociado a cada período mensual. Tabla de referencia.

| Atributo | Tipo | Nulo | Restricción | Descripción |
|---|---|---|---|---|
| `periodo` | `DATE` | No | **PK**, día 1 del mes | Período al que se aplica el valor |
| `valor_clp` | `NUMERIC(12,2)` | No | `> 0` | Valor de una UF en pesos |
| `fecha_valor` | `DATE` | No | | **Día concreto** cuyo valor se tomó |
| `fuente` | `TEXT` | No | | API pública chilena de la que se obtuvo |
| `obtenido_en` | `TIMESTAMPTZ` | No | | Cuándo se consultó |

**Regla de negocio decisiva: una vez almacenado, el valor de un período no se sobrescribe
por una consulta posterior a la API.** Esto es lo que hace que consultar dos veces un mes
anterior, sin modificar sus datos, produzca las mismas cifras aunque la UF haya cambiado
entre ambas consultas (`product.md` §10, criterio 4; HU03 E9) — y lo consigue **sin cierre
mensual ni inmutabilidad de períodos**.

`fecha_valor`, `fuente` y `obtenido_en` hacen auditable cualquier conversión histórica: se
sabe exactamente qué valor se usó y de dónde salió.

**Implementación (T10).** Migración `20261118120000_add_valor_uf_periodo`. `periodo` es el día 1
del mes y la PK; `obtenido_en` toma `now()` por defecto; `fuente` guarda `findic.cl`. Los
`CHECK` `valor_clp > 0` y *período = día 1* viven en la migración SQL (Prisma 6 no los expresa).
Una fila solo se crea con un valor que el proveedor devolvió y que pasó la validación; nunca se
persisten estimaciones, errores ni respuestas vacías, y la inserción es idempotente (no
sobrescribe).

El día que representa al período es **día 1**: decisión confirmada, ver §8.4 y D17.

### 4.13 `documento`

Metadata de los archivos asociados a una propiedad. **PostgreSQL no guarda binarios**: el
archivo vive en object storage compatible con S3, referenciado por `storage_key`.
*Implementado en T11* (migración `20261123120000_add_documento`): el enum se llama
`tipo_documento`; las cuatro FK específicas usan `ON DELETE SET NULL` (un abono o movimiento
eliminado deja el documento localizable desde su propiedad) y `propiedad_id` usa `RESTRICT`;
`CHECK` de exclusividad y `tamano_bytes > 0` en la migración; índice `(propiedad_id, subido_en)`.
*`seguridad-mvp`:* los documentos nuevos guardan en `storage_key` la clave **definitiva** (promovida desde una clave
temporal; ver §4.15); el formato `propiedades/{propiedad_id}/{uuid}` no cambia.

| Atributo | Tipo | Nulo | Restricción | Descripción |
|---|---|---|---|---|
| `id` | `UUID` | No | PK | |
| `propiedad_id` | `UUID` | No | FK → `propiedad` | **Obligatorio**: todo documento pertenece a una propiedad |
| `credito_id` | `UUID` | Sí | FK → `credito_hipotecario` | Vínculo específico, excluyente |
| `contrato_id` | `UUID` | Sí | FK → `contrato_arriendo` | Vínculo específico, excluyente |
| `abono_arriendo_id` | `UUID` | Sí | FK → `abono_arriendo` | Vínculo específico, excluyente |
| `movimiento_financiero_id` | `UUID` | Sí | FK → `movimiento_financiero` | Vínculo específico, excluyente |
| `tipo` | `ENUM tipo_documento` | No | | Ver valores abajo |
| `nombre_archivo` | `TEXT` | No | | Nombre original |
| `mime_type` | `TEXT` | No | | |
| `tamano_bytes` | `BIGINT` | No | `> 0` | |
| `storage_key` | `TEXT` | No | `UNIQUE` | Clave del objeto en el almacenamiento |
| `subido_en` | `TIMESTAMPTZ` | No | | |

Valores de `tipo_documento`: `ESCRITURA` · `CONTRATO_HIPOTECARIO` · `CONTRATO_ARRIENDO` ·
`COMPROBANTE_PAGO` · `FACTURA` · `OTRO`.

**Restricciones**

| Restricción | Motivo |
|---|---|
| `CHECK`: a lo sumo una de las cuatro FK opcionales es no nula | Un documento respalda un solo hecho |
| Validación de aplicación: la entidad vinculada pertenece a `propiedad_id` | Para el abono, la ruta es `abono → pago_esperado → contrato → propiedad` |

**Qué respalda cada vínculo**

| Vínculo | Hecho respaldado |
|---|---|
| `credito_id` | Contrato hipotecario y documentación del crédito |
| `contrato_id` | Contrato de arriendo firmado y sus anexos |
| `abono_arriendo_id` | Comprobante de transferencia: respalda el dinero **efectivamente recibido** |
| `movimiento_financiero_id` | Factura o boleta del egreso |

**El comprobante de arriendo se ancla al abono, no al pago esperado.** El pago esperado es
una expectativa que el sistema genera; el abono es el hecho que el comprobante acredita. El
pago esperado sigue siendo alcanzable por navegación desde el abono, así que no se pierde
nada al no tener un vínculo directo.

**`propiedad_id` obligatorio** garantiza que cualquier documento se localice partiendo de su
propiedad con una sola consulta (`product.md` §10, criterio 9), y el vínculo específico
resuelve el problema de que "saber que se pagó una reparación y encontrar la factura de esa
reparación" sean dos búsquedas distintas (`product.md` §1).

Se descarta la asociación polimórfica `(entidad_tipo, entidad_id)`, que sacrificaría la
integridad referencial para ahorrar cuatro columnas nulables, y también cuatro tablas de
unión, que no aportarían nada sobre las FK directas.

### 4.14 `movimiento_concepto`

Concepto de un gasto desglosado: una línea con nombre y monto dentro de un movimiento.

| Atributo | Tipo | Nulo | Restricción | Descripción |
|---|---|---|---|---|
| `id` | `UUID` | No | PK | |
| `movimiento_financiero_id` | `UUID` | No | FK → `movimiento_financiero`, `ON DELETE CASCADE` | Movimiento al que pertenece |
| `nombre` | `TEXT` | No | 1 a 100 caracteres (validado en la aplicación) | Ej. «Materiales» |
| `monto_clp` | `NUMERIC(14,0)` | No | `> 0` | Monto del concepto, en CLP |
| `orden` | `INTEGER` | No | | Posición en la lista enviada, desde 0; conserva el orden de ingreso |
| `created_at`, `updated_at` | `TIMESTAMPTZ` | No | | |

Índice por `movimiento_financiero_id`. Sin `UNIQUE` sobre `(movimiento, orden)`: un reemplazo
borra y reinserta en la misma transacción y la unicidad no protegería nada que el servicio
no controle.

**Un concepto no es un movimiento.** No tiene fecha, categoría ni propiedad propias, y no
existen rutas para tratarlo por separado: nace, cambia y desaparece con su movimiento
(composición, `ON DELETE CASCADE`).

**Simple o desglosado se deriva, no se almacena.** Un movimiento sin conceptos es un gasto
simple; con uno o más, es desglosado (hasta 50). Los movimientos anteriores a esta entidad
son gastos simples, sin migración de datos.

**El total vive en el movimiento.** `movimiento_financiero.monto_clp` es la suma de los
conceptos y se calcula en el servidor con aritmética entera exacta. Las agregaciones (T09) y
el resumen mensual de T07 leen solo ese campo, nunca la suma de los conceptos, así que un
gasto desglosado se cuenta una sola vez. Como la base no puede expresar «total = suma» entre
dos tablas, se audita con:

```sql
SELECT m.id, m.monto_clp, SUM(c.monto_clp) AS suma_conceptos
FROM movimiento_financiero m
JOIN movimiento_concepto c ON c.movimiento_financiero_id = m.id
GROUP BY m.id, m.monto_clp
HAVING SUM(c.monto_clp) <> m.monto_clp;   -- esperado: 0 filas
```

**Reglas de edición.** El campo `conceptos` del `PUT` decide el desglose: **ausente** lo
conserva (y solo acepta un `monto_clp` igual al total vigente); **`[]`** convierte el gasto en
simple, exige un monto positivo y elimina los conceptos; **una lista** lo reemplaza por
completo y el total se recalcula; **`null`** es un error de formato. Todo ocurre de forma
atómica: o se aplica el movimiento con todos sus conceptos, o no cambia nada.

### 4.15 `documento_subida`

Reserva de subida de un solo uso (`seguridad-mvp`; migración `20261125120100_add_documento_subida`,
aplicada en Neon). Soporta la subida en dos fases (`docs/architecture.md` §13.2): el navegador
solo escribe en `clave_temporal` y el backend promueve el objeto validado a `clave_definitiva`. Las
reservas `PENDIENTE` y `EN_PROCESO` vigentes cuentan para las cuotas de documentos. **No guarda binarios
ni credenciales.** Los documentos registrados antes de este cambio no tienen reserva y no la necesitan:
`documento.storage_key` conserva su clave `propiedades/{propiedad_id}/{uuid}`.

| Atributo | Tipo | Nulo | Restricción | Descripción |
|---|---|---|---|---|
| `id` | UUID | no | PK | Identificador; forma parte del token de subida |
| `propiedad_id` | UUID | no | FK → `propiedad`, `ON DELETE CASCADE` | Propiedad a la que se sube |
| `tipo` | `tipo_documento` | no | | Tipo autorizado |
| `nombre_archivo` | texto | no | | Nombre autorizado |
| `mime_type` | texto | no | | Formato autorizado |
| `tamano_bytes` | entero grande | no | `> 0` (CHECK) | Tamaño autorizado |
| `clave_temporal` | texto | no | única | `tmp/propiedades/{propiedad_id}/{uuid}` |
| `clave_definitiva` | texto | no | única; distinta de la temporal (CHECK) | `propiedades/{propiedad_id}/{uuid}` |
| `estado` | `estado_subida` | no | `PENDIENTE` \| `EN_PROCESO` \| `COMPLETADA` \| `EXPIRADA` | Ciclo de vida de la reserva |
| `expira_en` | fecha-hora con zona | no | | Fin de la vigencia (10 min); libera cupo |
| `reclamada_en` | fecha-hora con zona | sí | | Inicio de la confirmación en curso (se reclama de nuevo pasados 60 s) |
| `documento_id` | UUID | sí | única; FK → `documento`, `ON DELETE SET NULL` | Documento creado al completar (idempotencia) |
| `creada_en` | fecha-hora con zona | no | por defecto ahora | Retención de las completadas (1 día) |

Índices: `(propiedad_id, estado, expira_en)` y `(estado, expira_en)`.

### 4.16 `login_intento`

Contador de intentos de acceso por ventana fija (`seguridad-mvp`; migración
`20261125120000_add_login_intento`, aplicada en Neon). Una fila por cuenta o por IP.

| Atributo | Tipo | Nulo | Restricción | Descripción |
|---|---|---|---|---|
| `clave` | texto | no | PK | `cuenta:<HMAC>` o `ip:<HMAC>`; **nunca** el email ni la IP en claro. Los emails inexistentes usan la cuenta genérica |
| `contador` | entero | no | `>= 0` (CHECK) | Intentos en la ventana actual |
| `ventana_inicio` | fecha-hora con zona | no | índice | Inicio de la ventana de 15 min; al vencer, el contador vuelve a 1 |
| `actualizado_en` | fecha-hora con zona | no | por defecto ahora | Última actualización |

Límites: 5 por cuenta y 20 por IP por ventana. Se eliminan de forma acotada (50 por ejecución) los registros
con ventana anterior a 1 día. Sin relaciones con el resto del modelo.

---

## 5. Relaciones y cardinalidades

| Origen | Cardinalidad | Destino | Tipo | Nota |
|---|---|---|---|---|
| `propiedad` | 1 : 0..1 | `credito_hipotecario` | Identificante opcional | `UNIQUE(propiedad_id)` |
| `credito_hipotecario` | 1 : 0..N | `credito_registro_mensual` | Composición | Serie mensual |
| `propiedad` | 1 : 0..N | `contrato_arriendo` | Composición | Contratos sucesivos |
| `arrendatario` | 1 : 0..N | `contrato_arriendo` | Asociación | Reutilizable |
| `contrato_arriendo` | 1 : 1..N | `contrato_monto` | Composición | Mínimo el monto inicial |
| `contrato_arriendo` | 1 : 0..N | `pago_esperado` | Composición | Uno por período vigente |
| `pago_esperado` | 1 : 0..N | `abono_arriendo` | Composición | |
| `propiedad` | 1 : 0..N | `movimiento_financiero` | Composición | |
| `propiedad` | 1 : 0..N | `documento` | Composición | Obligatoria |
| `credito_hipotecario` | 1 : 0..N | `documento` | Asociación opcional | Excluyente |
| `contrato_arriendo` | 1 : 0..N | `documento` | Asociación opcional | Excluyente |
| `abono_arriendo` | 1 : 0..N | `documento` | Asociación opcional | Excluyente |
| `movimiento_financiero` | 1 : 0..N | `documento` | Asociación opcional | Excluyente |
| `movimiento_financiero` | 1 : 0..N | `movimiento_concepto` | Composición | `ON DELETE CASCADE`; sin conceptos = gasto simple |
| `propiedad` | 1 : 0..N | `documento_subida` | Composición | `ON DELETE CASCADE` |
| `documento` | 0..1 : 0..1 | `documento_subida` | Asociación opcional | `documento_id` único, `ON DELETE SET NULL` |

### 5.1 Restricciones que la base de datos no impone

Se validan en la capa de aplicación y se comprueban con tests:

1. **Los contratos de una misma propiedad no se solapan en el tiempo.**
2. **La entidad vinculada de un documento pertenece a su `propiedad_id`.**
3. **`monto_esperado_clp` coincide con el monto que `contrato_monto` da para su período.**
   Se restablece tras cada alta, corrección o eliminación de un monto.
4. **El primer `contrato_monto` de un contrato tiene `vigente_desde_periodo` igual al mes
   de `fecha_inicio`**, y ninguna fila tiene vigencia anterior al inicio del contrato. Mientras
   exista esa fila, T04 rechaza (409) editar el mes de `fecha_inicio`, para no desalinearla
   sin sobrescribir el monto.
5. **`pago_esperado.periodo` cae dentro de la vigencia de su contrato.**
6. **En un gasto desglosado, `movimiento_financiero.monto_clp` es igual a la suma de los
   `monto_clp` de sus conceptos.** Lo garantiza el servicio al escribir, dentro de una
   transacción; no hay trigger. Se audita con una consulta (§4.14).

### 5.2 Índices previstos

Además de los que crean PK y `UNIQUE`: FK de cada tabla, y los que sirven la consulta por
mes, que es el patrón dominante — `abono_arriendo(fecha_recepcion)`,
`movimiento_financiero(propiedad_id, fecha)`, `movimiento_concepto(movimiento_financiero_id)`,
`credito_registro_mensual(fecha_pago_dividendo)`, `contrato_arriendo(propiedad_id,
fecha_inicio)`.

---

## 6. Datos derivados

Se persisten **hechos registrados**. Todo lo que se puede calcular a partir de ellos se
deriva en el momento de la consulta y **no se almacena**.

| Derivado | Regla |
|---|---|
| Monto recibido de un pago | `SUM(abono_arriendo.monto_clp)` de sus abonos |
| Saldo pendiente de un pago | `max(0, monto_esperado_clp − recibido)` |
| **Estado del pago** | Precedencia de cuatro reglas (§6.1) |
| **Fecha de completitud** | Día en que el acumulado de abonos alcanza el esperado (§6.1) |
| Calificación *vencido con abonos parciales* | `estado = VENCIDO` y `recibido > 0` |
| Calificación *pagado con atraso* | `estado = PAGADO` y `fecha_completitud > fecha_esperada` |
| Período de arriendo de un abono | `abono_arriendo → pago_esperado → periodo` |
| Mensualidad hipotecaria de un dividendo | `credito_registro_mensual.periodo` |
| Mes de caja de un hecho | `date_trunc('month', <fecha real del hecho>)` |
| Monto vigente del contrato en un mes | Fila de `contrato_monto` con `max(vigente_desde_periodo) <= periodo` |
| Contrato vigente de una propiedad en un mes | Solapamiento de `[fecha_inicio, fecha_termino]` con el mes |
| Vacancia de una propiedad en un mes | Ausencia de contrato vigente |
| Saldo actual del crédito | `saldo_pendiente_uf` del `periodo` máximo registrado |
| Equivalente en CLP de un importe en UF | `monto_uf × valor_uf_periodo.valor_clp` del período |
| Ingresos recibidos del mes | `SUM(abono_arriendo.monto_clp)` con `fecha_recepcion` en el mes |
| Egresos del mes | `SUM(movimiento_financiero.monto_clp)` por `fecha` **+** `SUM(dividendo_pagado_clp)` por `fecha_pago_dividendo`. El `monto_clp` de un gasto desglosado ya incluye sus conceptos: **no se suman de nuevo** |
| Flujo neto | Ingresos − egresos |
| Agregados del dashboard | Consulta sobre lo anterior |

### 6.1 Estado del pago de arriendo

Con `recibido` = suma de los abonos del pago, y *vencida* = `fecha_esperada < hoy`. Las
reglas se evalúan **en orden**; la primera que se cumple determina el estado:

| # | Condición | Estado | Calificación derivada |
|---|---|---|---|
| 1 | `recibido >= esperado` | `PAGADO` | ***pagado con atraso*** si `fecha_completitud > fecha_esperada` |
| 2 | `recibido < esperado` y fecha vencida | `VENCIDO` | ***vencido con abonos parciales*** si `recibido > 0` |
| 3 | `0 < recibido < esperado` y fecha no vencida | `PARCIALMENTE_PAGADO` | — |
| 4 | `recibido = 0` y fecha no vencida | `PENDIENTE` | — |

**Cuatro estados mutuamente excluyentes.** Las dos calificaciones matizan un estado; no lo
sustituyen ni añaden un quinto. Un pago vencido con abonos parciales se presenta como
`VENCIDO`, indicando explícitamente su total recibido y su saldo pendiente (HU02 CL11).

**Fecha de completitud.** Es **el día en que el acumulado de abonos alcanza el monto
esperado**. Se obtiene ordenando los abonos del pago por `fecha_recepcion` ascendente,
acumulando, y tomando la `fecha_recepcion` del primer abono cuyo acumulado alcanza o supera
`monto_esperado_clp`. Si el acumulado nunca lo alcanza, no hay fecha de completitud y el
pago no está en `PAGADO`.

Cuando varios abonos comparten la misma `fecha_recepcion`, el orden entre ellos se resuelve
por `created_at` y, en último término, por `id`. Ese desempate es **puramente técnico**:
sirve para que el cálculo sea determinista y no dependa del orden en que la base devuelva
las filas. Funcionalmente es indiferente cuál de los abonos del día se considere el que
completa el pago, porque la fecha de completitud es ese mismo día en todos los casos, y es
la fecha —no el abono— la que determina la calificación *pagado con atraso*.

**Por qué el estado no puede ser una columna.** Depende de la fecha actual: una columna
quedaría obsoleta por sí sola, sin que nadie edite nada, y *pendiente → vencido* dejaría de
ocurrir por el mero paso del tiempo.

**Por qué la fecha de completitud tampoco.** Derivarla es lo que la mantiene correcta cuando
se edita o elimina un abono: si el acumulado deja de alcanzar el monto esperado, el pago
abandona `PAGADO` por la regla 2 o la 3, y la fecha de completitud se recalcula desde los
abonos vigentes. Los cambios de montos no pueden alterar el esperado de un pago con abonos
(§4.7).

**El orden de las reglas resuelve por sí solo los casos límite**, cualquiera sea la causa:

| Caso | Resultado | Por qué |
|---|---|---|
| Abonos por 620.000 sobre un esperado de 600.000 (HU02 CL14) | `PAGADO` | La regla 1 no exige igualdad exacta |
| Pago cubierto cuya fecha ya pasó | `PAGADO`, *pagado con atraso* | La regla 1 se evalúa antes que la 2 |
| Abonos por 500.000 sobre un esperado de 530.000 y fecha vencida | `VENCIDO`, *con abonos parciales*, saldo 30.000 | La regla 2 se evalúa antes que la 3 |
| El mismo caso con fecha no vencida | `PARCIALMENTE_PAGADO`, saldo 30.000 | La regla 2 no aplica; decide la 3 |

### 6.2 Ejemplo

```
Pago esperado (marzo 2026):  600.000 CLP   fecha esperada: 05-03-2026
  abono 1   03-03-2026:      300.000 CLP   acumulado: 300.000  → PARCIALMENTE_PAGADO
  abono 2   04-03-2026:      200.000 CLP   acumulado: 500.000  → PARCIALMENTE_PAGADO
  abono 3   09-03-2026:      100.000 CLP   acumulado: 600.000  → PAGADO
Recibido: 600.000 · Saldo: 0 · Fecha de completitud: 09-03-2026
Estado: PAGADO — calificación: pagado con atraso (completado tras el 05-03-2026)
```

### 6.3 Tres cosas que no se almacenan, y por qué

1. **Los equivalentes en CLP de importes en UF.** El valor de la UF del período ya es
   estable, así que la conversión es reproducible en cualquier momento. Persistirla
   duplicaría la verdad y abriría la posibilidad de divergencia. La UF acompaña, nunca
   reemplaza (HU01 E5, E6; HU03 E8).
2. **Ningún resumen mensual.** El histórico es estable porque se conservan los datos
   registrados y el valor de UF del período, no porque se congelen resultados. No existe
   cierre mensual.
3. **Ninguna columna de "mes de caja".** El período de origen ya es explícito y el mes de
   caja se deriva de la fecha real del hecho.

---

## 7. Período de origen y mes de caja

El modelo distingue **dos dimensiones temporales** y conserva ambas. No compiten: un mismo
hecho pertenece a un período de origen y a un mes de caja, y el producto necesita las dos
lecturas.

### 7.1 Regla de caja, uniforme y sin excepciones

Todo hecho financiero se imputa al flujo del mes de su **fecha real**:

| Hecho | Fecha que lo imputa al mes de flujo |
|---|---|
| Abono de arriendo | `abono_arriendo.fecha_recepcion` |
| Egreso o inversión | `movimiento_financiero.fecha` |
| Dividendo hipotecario | `credito_registro_mensual.fecha_pago_dividendo` |

`credito_registro_mensual.periodo` **no interviene en el flujo de caja**: identifica la
mensualidad hipotecaria a la que corresponde el registro, y es la clave por la que se
consulta la serie del crédito.

### 7.2 Período de origen

| Hecho | Dónde vive su período de origen |
|---|---|
| Abono de arriendo | `pago_esperado.periodo`, alcanzable por `abono_arriendo → pago_esperado` |
| Dividendo hipotecario | `credito_registro_mensual.periodo` |

### 7.3 Los dos casos de desfase

**Arriendo de marzo cobrado el 5 de abril de 2026.** Aparece en el *esperado vs recibido* de
marzo, porque su `pago_esperado.periodo` es marzo, y en los ingresos de caja de abril,
porque su `fecha_recepcion` cae en abril.

**Dividendo de la mensualidad de marzo pagado el 3 de abril de 2026.** Aparece en la serie
mensual del crédito de marzo, porque su `periodo` es marzo, y en los egresos de caja de
abril, porque su `fecha_pago_dividendo` cae en abril.

### 7.4 Referencia temporal derivada

Cuando el período de origen no coincide con el mes de caja, la aplicación puede rotularlo
automáticamente —*"Correspondiente a marzo 2026"*— **sin que nadie lo escriba**:

| Hecho | Período de origen | Condición para mostrar el rótulo |
|---|---|---|
| Abono | `abono_arriendo → pago_esperado → periodo` | Difiere del mes de `fecha_recepcion` |
| Dividendo | `credito_registro_mensual.periodo` | Difiere del mes de `fecha_pago_dividendo` |

Esta información **no se almacena como texto**. Los campos descriptivos
—`abono_arriendo.medio`, `movimiento_financiero.descripcion`— no son su sitio: si hubiera
que teclear "corresponde a marzo" para que el dato existiera, el modelo estaría incompleto y
el rótulo dependería de que alguien se acordara de escribirlo.

---

## 8. UF y CLP

### 8.1 Qué se guarda en cada unidad

| Dato | Unidad | Motivo |
|---|---|---|
| Cuota contractual del crédito | **UF** | Es lo pactado con el banco |
| Saldo pendiente del crédito | **UF** | Es lo que el banco informa |
| Monto original y seguros del crédito | **UF** | Datos contractuales |
| Dividendo efectivamente pagado | **CLP** | Es el desembolso real de la cartola, no una conversión |
| Monto de arriendo, abonos y egresos | **CLP** | Los arriendos y el flujo se manejan en pesos |
| Valor de compra de la propiedad | **UF o CLP** | Según lo pactado; la moneda es parte del dato |

Las métricas consolidadas del dashboard se expresan en CLP. Los datos contractuales del
crédito conservan su unidad en UF, y un equivalente en CLP puede acompañarlos **sin
reemplazarlos** (HU01 E5, E6; HU03 E8).

### 8.2 Cómo se asocia la UF al período

Una fila de `valor_uf_periodo` por período mensual. La conversión de un importe en UF
correspondiente a un período usa el `valor_clp` de ese período, y se calcula al consultar.

Se descarta almacenar una **serie diaria** de la UF: obligaría igualmente a decidir qué día
representa al mes, multiplicaría el volumen de datos y no la pide ninguna historia de
usuario — el histórico financiero se consulta por período mensual.

### 8.3 Por qué el histórico es estable sin cierre mensual

`product.md` §7.2 es explícito: no existe cierre, reapertura ni bloqueo de períodos, y un
mes anterior sigue siendo editable. La estabilidad viene de otro sitio.

El valor de la UF de un período **se almacena una vez y no se sobrescribe** por consultas
posteriores a la API. Como la conversión depende solo de ese valor y de los importes
registrados, consultar dos veces un mes anterior sin modificar sus datos produce siempre las
mismas cifras, aunque la UF haya cambiado entre ambas consultas (criterio de éxito 4;
HU03 E9). Una cifra histórica cambia únicamente si el usuario edita explícitamente algún
dato de ese mes (HU03 E10).

### 8.4 Regla del día de referencia — *decisión: día 1 del período (T10)*

**Confirmado**: el valor efectivamente utilizado para cada período queda almacenado con su
`fecha_valor`, su `fuente` y el instante de obtención, y no cambia por consultas
posteriores.

**Decisión (T10, D17): el día 1 del mes representa al período.** Se eligió la primera opción
de la tabla de abajo, que no cambia el esquema; se conserva el análisis porque justifica por
qué las otras dos no se adoptaron. Es siempre un valor disponible y estable desde que empieza
el mes. La convención vive en un único punto del código, así que cambiarla a «último día del
mes» sería una modificación local. El importe convertido usa la UF del período que cada
consulta indica: para el saldo del crédito del dashboard, el **mes consultado**, y para el
saldo de un registro mensual, el `periodo` del registro (`architecture.md` §12.5).

**Las tres opciones no son equivalentes en coste.** Las dos primeras son convenciones sobre
qué día se consulta a la API y qué valor se guarda en `fecha_valor`: el esquema actual las
soporta sin ninguna modificación. La tercera **no**: exigiría evolucionar el modelo hacia
valores diarios de la UF o hacia un valor de UF asociado a cada hecho, y por tanto abandonar
la premisa de "un valor por período" sobre la que está construida `valor_uf_periodo`.

| Opción | A favor | En contra | Impacto en el esquema |
|---|---|---|---|
| Día 1 del período | Siempre disponible y estable desde que empieza el mes | Se aleja del valor con que el banco informa el saldo a fin de mes | **Ninguno**: solo cambia qué día se consulta y se guarda en `fecha_valor` |
| Último día del mes | Más próximo al saldo informado por el banco | No existe mientras el mes está en curso; el valor del mes corriente cambia hasta que el mes cierra | **Ninguno**: misma tabla, distinta `fecha_valor` |
| Día del hecho convertido | Máxima fidelidad a cada operación | Rompe la premisa de un valor por período | **Cambio de modelo**: obligaría a una serie diaria de UF, o a asociar un valor de UF a cada hecho convertible. `valor_uf_periodo` dejaría de ser suficiente |

Si se eligiera la tercera opción habría que revisar además §8.2, que descarta explícitamente
la serie diaria, y §6, donde la conversión UF → CLP se define por período y no por hecho.

---

## 9. Trazabilidad

### 9.1 Entidades por historia de usuario

| Entidad | HU01 Propiedad y crédito | HU02 Contrato y pagos | HU03 Flujo financiero |
|---|:---:|:---:|:---:|
| `usuario` | — | — | — |
| `propiedad` | ● | ○ | ○ |
| `credito_hipotecario` | ● | | ○ |
| `credito_registro_mensual` | ● | | ● |
| `arrendatario` | | ● | |
| `contrato_arriendo` | | ● | ○ |
| `contrato_monto` | | ● | |
| `pago_esperado` | | ● | ○ |
| `abono_arriendo` | | ● | ● |
| `movimiento_financiero` | | | ● |
| `movimiento_concepto` | | | ● |
| `valor_uf_periodo` | ○ | | ● |
| `documento` | ● | ● | |

● la historia posee la entidad · ○ la consulta

### 9.2 Criterios de éxito de `product.md` §10

| # | Criterio | Cómo lo satisface el modelo |
|---|---|---|
| 1 | Registrar una propiedad sin modificar el sistema | `propiedad` no depende del tamaño de la cartera |
| 2 | Esperado vs ingresado en un mes | `pago_esperado.periodo` frente a la suma de sus abonos |
| 3 | Determinar el estado de un pago | Precedencia de §6.1 sobre datos ya registrados |
| 4 | Mismas cifras al reconsultar un mes | `valor_uf_periodo` no se sobrescribe (§8.3) |
| 5 | Flujo neto sin sumar a mano | Derivación de ingresos y egresos (§6) |
| 6 | Registrar un gasto simple o desglosado en conceptos | Entidad hija `movimiento_concepto` (§4.14); el total vive en `movimiento_financiero.monto_clp` |
| 7 | Un gasto desglosado se cuenta una sola vez en los egresos | Las agregaciones leen solo `monto_clp` del movimiento, que ya es la suma de sus conceptos (§4.10, §6) |
| 8 | Saldo de un crédito en un mes anterior | `credito_registro_mensual` por `periodo` |
| 9 | Localizar un documento desde su propiedad | `documento.propiedad_id` obligatorio |
| 10 | Inicializar con datos históricos anonimizados | Todas las entidades admiten carga por seeds; sin importador |

---

## 10. Decisiones y supuestos

### 10.1 Decisiones confirmadas

| # | Decisión | Justificación |
|---|---|---|
| D1 | El dividendo se registra solo en `credito_registro_mensual`, sin categoría `DIVIDENDO` en `movimiento_financiero` | Un único punto de registro; una categoría homónima duplicaría la misma salida de dinero |
| D2 | `periodo` (mensualidad hipotecaria) y `fecha_pago_dividendo` (caja) son datos distintos, y el flujo imputa por la fecha de pago | Mantiene la regla de caja uniforme para los tres tipos de hecho |
| D3 | `arrendatario` es entidad propia | Reutilizable entre contratos sucesivos; RUT único; anonimización acotada a una tabla |
| D4 | Los ingresos del mes se imputan por `fecha_recepcion` | Coherente con el resto de la regla de caja. La vista esperado vs recibido usa `pago_esperado.periodo` |
| D5 | El monto inicial del arriendo es la primera fila de `contrato_monto` | Única fuente de verdad; el reajuste deja de ser un caso especial |
| D6 | La vigencia del monto se expresa en período mensual | Evita el prorrateo intramensual, fuera de alcance |
| D7 | `pago_esperado` se persiste con el monto del mes como snapshot | Los abonos necesitan una FK estable; el reajuste retroactivo dispara un recálculo explícito |
| D8 | El estado del pago y la fecha de completitud se derivan | Dependen de la fecha actual y del monto esperado vigente |
| D9 | El comprobante de arriendo se vincula al abono, no al pago esperado | El comprobante acredita un hecho, no una expectativa |
| D10 | *(retirada)* `aporte_capital` se canceló por decisión de producto (T08) | El MVP no registra aportes de capital; se conserva el número para no alterar referencias |
| D11 | `UNIQUE(propiedad_id)` en el crédito | Un crédito por propiedad; retirarlo sería una migración no destructiva |
| D12 | Vigencia del contrato derivada de las fechas, sin columna `estado` | Una terminación anticipada se registra actualizando `fecha_termino` |
| D13 | Categorías y tipos como `ENUM` con valor `OTRO` | Añadir un valor es una migración, no un rediseño |
| D14 | Valor de compra con moneda explícita | En Chile la compra suele pactarse en UF |
| D15 | El desglose de un gasto es una entidad hija (`movimiento_concepto`) y el total se guarda en `movimiento_financiero.monto_clp` | T09 y las agregaciones no cambian ni pueden contar un gasto dos veces; los movimientos existentes quedan como gastos simples sin migrar datos |
| D16 | Al editar un movimiento, `conceptos` ausente conserva el desglose, `[]` lo convierte en simple y una lista lo reemplaza | Un cliente que desconoce los conceptos no los pierde por omisión; la pérdida exige una acción explícita |
| D17 | El día 1 del mes representa al período en `valor_uf_periodo` | Siempre disponible y estable; no cambia el esquema ni la premisa de un valor por período (§8.4) |

### 10.2 Propuestas a validar

| # | Propuesta | Qué está en juego |
|---|---|---|
| P1 | **Regla del día de referencia de la UF** (§8.4) | *Cerrada en T10: día 1 del período (D17).* Se conserva para trazabilidad |
| P2 | `propiedad.direccion` como campo nulable | `product.md` §6.1 no lo exige; se propone porque el modelo es para N propiedades |
| P3 | Nomenclatura en español para tablas y columnas | Coherencia con el vocabulario de dominio frente a la convención habitual del stack |

---

## 11. Fuera del modelo

Lo siguiente **no existe** en el modelo de datos y no debe añadirse sin una decisión previa.
Cada exclusión evita una fuente concreta de error o de complejidad injustificada:

| No existe | Motivo |
|---|---|
| Tabla de resumen mensual o de cierre | No hay cierre (`product.md` §8); sería una caché que puede divergir del dato |
| Columnas para estado del pago, fecha de completitud, monto recibido, saldo actual del crédito o equivalentes en CLP | Quedan obsoletas por sí solas |
| Columna `periodo_caja` o equivalente | El mes de caja se deriva de la fecha real del hecho |
| Un quinto estado del pago | *Vencido con abonos parciales* y *pagado con atraso* son calificaciones derivadas |
| Rótulos de correspondencia temporal como texto libre | Son derivables de la relación con el pago esperado |
| Tablas catálogo para categorías, tipos, motivos o bancos | Las enumeraciones bastan para un usuario único y un puñado de valores |
| Documentos polimórficos o EAV | Sacrificaría la integridad referencial a cambio de cuatro columnas nulables |
| Entidades `moneda` y `tipo_cambio` genéricas | Hay dos unidades y una conversión mensual |
| Tabla de amortización o desarrollo del crédito | El sistema no reproduce la lógica del banco |
| Entidad `garantia` con movimientos | Es un atributo del contrato; su gestión está fuera de alcance |
| `usuario_id` en las entidades de dominio, roles, permisos | Usuario único |
| Auditoría, event sourcing, borrado lógico, versionado | Fuera de las necesidades del MVP |
| Serie diaria de UF | El histórico se consulta por mes |
| Tabla dimensión de períodos | El período se deriva de una fecha |
| Entidad genérica para estacionamiento y bodega | Dos columnas nulables bastan |
| Columna `tipo` (ingreso/egreso) en `movimiento_financiero` | Abriría una segunda vía de ingresos que competiría con los abonos |
| `propiedad_id` denormalizado en `pago_esperado` o `abono_arriendo` | Alcanzable por la relación; denormalizarlo permitiría incoherencias |
| Binarios en PostgreSQL | Los archivos viven en object storage; la base guarda metadata |

---

## 12. Referencias

- [product.md](product.md) — problema, alcance, funcionalidades y reglas de negocio
- [user-stories.md](user-stories.md) — HU01, HU02 y HU03 con sus criterios de aceptación
- `CLAUDE.md` — contexto del proyecto, stack y reglas de trabajo
