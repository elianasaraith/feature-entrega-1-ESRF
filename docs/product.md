# RealtyTrack — Definición del producto

## 1. Contexto y problema actual

RealtyTrack nace de una necesidad personal real: la administración de tres departamentos
de inversión ubicados en un mismo edificio en Chile.

Que compartan edificio es circunstancial, no estructural. Cada propiedad tiene su propio
crédito hipotecario, su propio contrato de arriendo, su propio arrendatario y su propio
flujo financiero. El edificio común no crea ninguna relación entre ellas.

Cada propiedad acumula seis dimensiones de información: los datos de la propiedad, el
crédito hipotecario y sus condiciones, el contrato de arriendo y su arrendatario, los
pagos mensuales, los gastos e inversiones asociados, y la documentación de respaldo.
Hoy cada dimensión vive en un soporte distinto — una hoja de cálculo, la cartola del
banco, el contrato en PDF, los comprobantes de transferencia — y ninguna fuente sabe de
las otras.

De ahí se derivan cinco problemas concretos:

**El costo está en la consolidación, no en el registro.** Anotar un pago es barato.
Responder *"¿cuánto debía ingresar en marzo y cuánto ingresó realmente?"* obliga a cruzar
varias fuentes a mano. Y el resultado de ese cruce no queda registrado: la próxima vez
hay que repetirlo desde cero.

**El histórico no se consulta, se reconstruye.** No hay forma de preguntar qué ocurrió
financieramente en un mes anterior. Solo se puede rearmar, y una reconstrucción manual no
es reproducible: dos intentos pueden arrojar cifras distintas.

**Los estados intermedios son invisibles.** Un arriendo pagado a medias o vencido no tiene
representación explícita en ninguna parte, así que se detecta tarde y por memoria.

**La información financiera y la documental están desconectadas.** Saber que se pagó una
reparación y encontrar la factura de esa reparación son dos búsquedas distintas.

**El proceso no escala.** Funciona porque son tres propiedades que caben en la cabeza.
Una cuarta multiplica el trabajo manual sin aportar estructura.

Preguntas que hoy exigen consolidación manual y que el producto debe responder de forma
directa:

- cuánto debía ingresar por arriendos durante un mes, y cuánto ingresó realmente;
- qué pagos están pendientes, parciales o vencidos;
- cuánto se pagó en dividendos y en otros gastos;
- cuánto capital propio se ha aportado;
- cuál fue el resultado financiero neto de un mes;
- cuál es el saldo de los créditos hipotecarios;
- qué ocurrió financieramente en un mes anterior;
- dónde está la documentación relacionada con cada propiedad.

## 2. Usuario objetivo

Un **propietario-inversor individual que autogestiona su cartera**: es a la vez dueño,
administrador y quien consulta la información. Tiene conocimiento directo de cada
propiedad, decide sobre cada contrato y responde por cada pago.

El MVP es de **usuario único**. No hay perfiles, roles ni cartera compartida.

No son usuarios del producto, y el diseño no los contempla: administradoras de
propiedades, corredoras, arrendatarios y contadores externos.

El usuario opera en el contexto financiero chileno, lo que determina tres rasgos del
producto: la convivencia de UF y CLP en la misma cartera, el dividendo hipotecario como
egreso recurrente principal, y las contribuciones como gasto periódico propio del
propietario.

## 3. Objetivo del producto

Ofrecer una **fuente única** donde el estado financiero y contractual de cada propiedad
quede registrado y sea consultable por período mensual, sin consolidación manual.

El producto no automatiza la gestión inmobiliaria ni sustituye al banco: **centraliza y
hace consultable** la información que hoy está dispersa, y hace explícita la diferencia
entre lo que se esperaba y lo que ocurrió.

## 4. Propuesta de valor

- **Registro unificado por propiedad.** Propiedad, crédito, contrato, pagos, egresos,
  aportes y documentos en un solo lugar, sin dejar de tratarse cada propiedad de forma
  individual.
- **Esperado frente a recibido.** El sistema conoce lo que debía ocurrir en cada período
  mensual, así que puede señalar por sí mismo lo pendiente, lo parcial y lo vencido.
- **Histórico consultable y estable.** Un período mensual anterior se consulta como el
  actual, y sus cifras no se mueven por una variación posterior del valor de la UF.
- **Desempeño y financiamiento separados.** El resultado del mes no queda enmascarado por
  el capital propio que se inyectó para cubrirlo.
- **Documentación localizable.** Cada documento queda asociado a la propiedad y al hecho
  que respalda.
- **Diseñado para N propiedades.** Añadir una propiedad es usar el sistema, no
  modificarlo.

## 5. Alcance del MVP

Cinco capacidades must-have. Cada una se delimita por lo que deja fuera:

1. **Gestión de propiedades** — registrar y mantener las propiedades de la cartera, con
   sus datos físicos y de compra. No incluye valorización de mercado ni tasaciones.
2. **Gestión de créditos hipotecarios** — registrar el crédito de cada propiedad y su
   evolución mensual. No incluye simular ni recalcular la amortización del banco.
3. **Gestión de contratos y arriendos** — registrar contratos, arrendatarios, condiciones
   de pago y los montos aplicados durante la vigencia. No incluye generar ni firmar
   contratos.
4. **Registro y control de pagos, ingresos y gastos** — pagos esperados y abonos
   recibidos, egresos por propiedad y aportes de capital. No incluye cobrar, pagar ni
   conciliar con el banco.
5. **Dashboard financiero e histórico mensual** — la situación de un período mensual y la
   consulta de meses anteriores, a nivel de cartera y de cada propiedad. No incluye
   comparar propiedades entre sí ni proyectar a futuro.

Dos funcionalidades transversales completan el MVP: el **almacenamiento de documentos**
asociados a las propiedades, y el **acceso protegido** de usuario único.

## 6. Funcionalidades principales

### 6.1 Propiedades

Registrar una propiedad con su número de departamento, superficie, valor y fecha de
compra, y con estacionamiento y bodega como elementos opcionales. La cartera admite
cualquier número de propiedades; cada una se gestiona de forma independiente.

### 6.2 Créditos hipotecarios

Registrar el crédito asociado a una propiedad: banco, cuota mensual, saldo pendiente,
tasa, número de cuotas, seguros, día de vencimiento y datos contractuales.

Los datos contractuales conservan su **unidad natural en UF** cuando corresponde: la cuota
pactada y el saldo pendiente informado por el banco se registran y se muestran en UF.
Cuando resulte útil puede acompañarse un equivalente en CLP, calculado con el valor de la
UF correspondiente, pero sin reemplazar el valor original.

El **dividendo efectivamente pagado se registra en CLP**: representa el desembolso real
que el usuario constata en su cartola, no una conversión.

Mes a mes, el usuario registra el dividendo pagado y actualiza el saldo pendiente a partir
de la información del banco. El sistema conserva esa serie mensual, que es lo que permite
responder cuál era el saldo en un mes anterior.

El sistema **no** reproduce la lógica de amortización del banco: guarda hechos
registrados, no cálculos propios.

### 6.3 Contratos y arriendos

Registrar el contrato de arriendo de una propiedad con su arrendatario, fechas de inicio
y término, monto mensual, garantía, día esperado de pago, estado y documentos asociados.

Un contrato **conserva su identidad durante toda su vigencia**, incluso si su monto
cambia. Un reajuste no crea un contrato nuevo: actualiza el monto vigente, y el producto
conserva el histórico de los montos aplicados a lo largo del contrato. Eso es lo que
permite que un mes pasado siga mostrando el monto que realmente regía entonces.

Una propiedad puede tener contratos sucesivos a lo largo del tiempo, con períodos sin
arrendatario entre ellos.

La **garantía** forma parte de la información contractual. No es un ingreso recurrente del
flujo mensual.

### 6.4 Pagos, ingresos y gastos

**Pagos de arriendo.** A partir del contrato vigente, el sistema genera el pago esperado
de cada período mensual, con el monto que regía en ese mes y su fecha esperada de pago.
Sin contrato vigente no se espera ingreso por arriendo.

Un pago esperado puede recibir **uno o varios abonos**. El monto recibido es la suma de
los abonos asociados a ese pago esperado:

```
Esperado:  600.000 CLP
  abono 1: 300.000 CLP
  abono 2: 200.000 CLP
  abono 3: 100.000 CLP
Recibido:  600.000 CLP
```

El estado del pago se determina a partir del monto esperado, los abonos recibidos y la
fecha esperada: **pendiente** sin abonos, **parcialmente pagado** con abonos que no cubren
el total, **pagado** cuando lo cubren, y **vencido** cuando la fecha esperada ya pasó sin
que el monto esté completo.

**Movimientos financieros.** Registrar por propiedad los egresos del mes: dividendos,
reparaciones, equipamiento, seguros, contribuciones, gastos extraordinarios y otros.
Un egreso o una inversión representa **uso de recursos de la propiedad**.

Los gastos comunes ordinarios corresponden normalmente al arrendatario y quedan fuera del
control recurrente del propietario. Si la propiedad está sin arrendatario y el propietario
debe pagarlos, pueden registrarse como un egreso de la propiedad. Esto no convierte los
gastos comunes en una funcionalidad administrada por el producto.

**Aportes de capital.** Registrar el capital propio que el propietario incorpora a una
propiedad: el pie inicial, capital adicional o la cobertura de un déficit del mes. Su
propósito es poder responder cuánto capital propio se ha puesto en la inversión, de forma
acumulada.

Aporte y uso de fondos son conceptos distintos y se registran por separado:

- un **egreso o inversión** es uso de recursos de la propiedad — cuánto se gastó o se
  invirtió;
- un **aporte de capital** es dinero propio que entra — cómo se financió.

Una inversión capitalizable no es un aporte por sí misma. Si el propietario remodela un
departamento con dinero propio, coexisten dos registros: el egreso o inversión por la
remodelación, y el aporte de capital que explica su financiamiento. Mantenerlos separados
es lo que permite conocer por separado cuánto se ha invertido y cuánto capital propio se
ha aportado.

Por eso el aporte **no se cuenta como egreso del mes**: tratarlo como tal duplicaría la
misma salida de dinero y borraría el resultado real del período.

### 6.5 Dashboard e histórico mensual

El producto ofrece dos niveles de consulta.

**Dashboard general de cartera.** Agregados del período mensual para el conjunto de
propiedades:

- ingresos recibidos;
- egresos;
- dividendos efectivamente pagados;
- otros gastos;
- **flujo neto antes de aportes**;
- aportes de capital del mes y acumulados;
- saldo de los créditos hipotecarios;
- estado de los pagos de arriendo.

**Vista por propiedad.** El detalle financiero y contractual de una propiedad concreta:
su crédito, su contrato vigente, sus pagos esperados y recibidos, sus egresos y sus
aportes.

Agregar la cartera y consultar una propiedad individualmente **no es comparar
propiedades**. El producto no ordena, puntúa ni enfrenta propiedades entre sí.

#### Flujo neto antes de aportes

El **flujo neto antes de aportes** es el resultado del período mensual: los ingresos
asociados a la operación menos los egresos asociados a la inversión. Los aportes de
capital se informan como una cifra separada.

```
Ingresos:                        +500.000 CLP
Egresos:                         -650.000 CLP
Flujo neto antes de aportes:     -150.000 CLP
Aporte del propietario:          +150.000 CLP
```

El aporte explica **cómo se financió** el déficit; no convierte el desempeño del mes en
cero. Puede mostrarse además la posición resultante después de aportes, siempre que el
flujo neto antes de aportes siga visible: es la cifra que informa sobre el desempeño.

#### Moneda

Las métricas consolidadas del flujo financiero se expresan en **CLP**: ingresos,
dividendos efectivamente pagados, gastos, aportes y flujo neto antes de aportes.

Los datos contractuales del crédito mantienen su **unidad natural en UF**, en particular la
cuota contractual y el saldo pendiente. Cuando sea útil puede mostrarse además su
equivalente en CLP, calculado con el valor de la UF correspondiente al período, pero sin
reemplazar el valor en UF.

#### Reproducibilidad del histórico

No existe cierre mensual ni inmutabilidad de períodos: un mes anterior sigue siendo
editable como cualquier otro dato.

Lo que el producto garantiza es estabilidad frente a lo que no depende del usuario: con
los mismos datos registrados y el mismo valor de UF asociado al período mensual, una
consulta histórica produce el mismo resultado. Una cifra histórica puede cambiar si el
usuario modifica explícitamente información de ese mes, pero **no** debe cambiar solo
porque el valor de la UF varió después.

Cualquier mes anterior se consulta con el mismo detalle que el mes en curso.

### 6.6 Documentos

Almacenar y recuperar los documentos asociados a una propiedad: documentos de la
propiedad, contratos hipotecarios, contratos de arriendo, comprobantes y facturas. Cada
documento queda vinculado a la propiedad y, cuando corresponde, al contrato o al pago que
respalda.

### 6.7 Acceso

Acceso protegido mediante email y contraseña. Un solo usuario: no hay registro público,
invitaciones ni perfiles.

## 7. Reglas y restricciones del producto

### 7.1 Reglas de negocio confirmadas

- Una propiedad tiene número de departamento, superficie, valor y fecha de compra;
  estacionamiento y bodega son opcionales.
- Cada propiedad puede tener su propio crédito hipotecario, independiente del de las
  demás.
- Los datos contractuales del crédito se expresan en **UF** cuando corresponde: cuota
  pactada y saldo pendiente informado por el banco. Un equivalente en CLP puede
  acompañarlos, sin reemplazarlos.
- El **dividendo efectivamente pagado se registra en CLP**: es el desembolso real.
- Los arriendos se manejan en **CLP**.
- El valor de la UF se obtiene de una API pública chilena. El sistema no lo estima ni lo
  calcula.
- El sistema no simula ni recalcula la lógica interna del banco. El dividendo pagado y el
  saldo pendiente los registra el usuario; el sistema conserva la serie mensual.
- Un contrato de arriendo conserva su identidad durante su vigencia aunque cambie su
  monto. Se conserva el histórico de los montos aplicados.
- Una propiedad puede tener contratos sucesivos, con períodos sin arrendatario.
- El pago esperado lo genera el sistema desde el contrato vigente, con el monto que regía
  en ese período mensual.
- Un pago esperado puede recibir uno o varios abonos. El monto recibido es la suma de los
  abonos asociados.
- El estado de un pago se determina a partir del monto esperado, los abonos recibidos y la
  fecha esperada de pago: pendiente, parcialmente pagado, pagado o vencido.
- La garantía es información contractual, no un ingreso recurrente del flujo mensual.
- Un **egreso o inversión** es uso de recursos de la propiedad. Un **aporte de capital** es
  dinero propio incorporado por el propietario. Son conceptos distintos: una inversión
  capitalizable no es un aporte por sí misma, y financiar una inversión con dinero propio
  genera ambos registros.
- El aporte de capital no se cuenta como egreso del mes.
- El **flujo neto antes de aportes** es el resultado del período mensual: ingresos de la
  operación menos egresos de la inversión. Los aportes se informan aparte y no lo
  neutralizan.
- Los gastos comunes ordinarios corresponden al arrendatario. Si la propiedad está
  desocupada y los paga el propietario, se registran como egreso de la propiedad.
- El histórico financiero se consulta **por período mensual**.

### 7.2 Restricciones del producto

- **Usuario único** en el MVP.
- **Sin comparación entre propiedades.** El dashboard agrega la cartera y permite consultar
  cada propiedad individualmente; no ordena ni enfrenta propiedades entre sí.
- El producto se modela para **N propiedades**. Las tres iniciales son datos, no una
  característica del diseño.
- Las métricas consolidadas del flujo van en CLP; los datos contractuales del crédito
  conservan su unidad en UF.
- **No existe cierre mensual ni inmutabilidad de períodos.** La estabilidad del histórico
  proviene de conservar los datos registrados y el valor de UF asociado a cada período
  mensual, no de bloquear nada.
- Los datos históricos reales se cargan mediante procesos controlados y **anonimizados**;
  no existe importación de archivos como funcionalidad del producto.

### 7.3 Pendiente de decisión en el diseño

No quedan decisiones de producto abiertas. Lo que resta por resolver es de nivel de
diseño, y se aborda en docs/user-stories.md y docs/data-model.md:

- cómo se materializa el histórico de montos de arriendo dentro de un mismo contrato;
- cómo se representan los abonos frente al pago esperado;
- cómo se conserva la serie mensual de dividendo pagado y saldo pendiente;
- cómo se asocia el valor de UF a cada período mensual;
- cómo se vinculan un egreso y el aporte de capital que lo financia;
- qué categorías de movimiento financiero se fijan y cuáles quedan abiertas.

## 8. Fuera de alcance del MVP

No forman parte del producto y no deben documentarse como si existieran:

- **Multiusuario y cartera compartida** — el MVP es de usuario único por definición.
- **Integración bancaria y conciliación bancaria** — los datos del banco los registra el
  usuario.
- **Pagos automáticos** — el sistema registra pagos, no los ejecuta.
- **OCR y extracción de contratos con IA** — los documentos se almacenan, no se
  interpretan.
- **Simulador hipotecario** — el sistema no recalcula la lógica del banco.
- **Comparación entre propiedades** — incluye rankings, comparativas de una propiedad
  frente a otra e indicadores destinados a determinar cuál rinde mejor.
- **Gestión de la garantía** — devolución, retención o uso de la garantía queda fuera del
  MVP, salvo decisión posterior.
- **Administración ordinaria de gastos comunes** — corresponde al arrendatario. Registrar
  un pago puntual durante la vacancia no constituye un módulo de gastos comunes.
- **Declaración tributaria**.
- **Proyecciones financieras avanzadas** — el producto describe lo ocurrido, no lo
  previsto.
- **Importador de Excel** — la carga inicial es un proceso controlado, no una
  funcionalidad.
- **Cierre mensual** — no existe cierre, reapertura ni bloqueo de períodos.

## 9. Evolución posterior (no comprometida)

Esta sección no es un roadmap. La lista de fuera de alcance de §8 tampoco lo es: son
exclusiones, no funcionalidades diferidas.

Lo que el alcance del MVP deja abierto sin costo adicional:

- **Crecimiento de la cartera.** Al modelarse para N propiedades, incorporar una cuarta no
  requiere cambios en el producto.
- **Profundidad del histórico.** El registro mensual es acumulativo: cada mes suma
  información consultable sin alterar lo anterior.
- **Nuevas categorías de movimiento.** El registro de egresos admite categorías
  adicionales sin redefinir el modelo financiero.

Cualquier capacidad más allá de esto exige una decisión de producto explícita.

## 10. Criterios de éxito del MVP

Verificables funcionalmente, sin métricas estimadas:

1. Registrar una propiedad nueva en la cartera sin modificar el sistema.
2. Para un período mensual dado, consultar cuánto debía ingresar por arriendos y cuánto
   ingresó, sin abrir ninguna otra fuente.
3. El sistema puede determinar el estado de un pago de arriendo a partir del monto
   esperado, los abonos recibidos y la fecha esperada de pago.
4. Consultar dos veces un mes anterior, sin modificar sus datos, y obtener las mismas
   cifras — incluso si el valor de la UF cambió entre ambas consultas.
5. Obtener el flujo neto antes de aportes de un mes sin sumar importes a mano.
6. Para un mes con déficit, distinguir el resultado de la operación del capital propio
   aportado para cubrirlo.
7. Para una inversión financiada con dinero propio, ver por separado el monto invertido y
   el aporte de capital que lo financió.
8. Consultar el saldo de un crédito en un mes anterior, no solo el vigente.
9. Localizar cualquier documento cargado partiendo de la propiedad a la que pertenece.
10. Inicializar el sistema con datos históricos anonimizados anonimizados de las tres propiedades reales y comprobar que las cifras mensuales coinciden con las de la fuente original.
