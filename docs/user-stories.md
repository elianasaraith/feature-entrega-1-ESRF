# RealtyTrack — Historias de usuario

Este documento recoge las **tres historias de usuario principales** del MVP. Tres es el
límite documental de la plantilla del proyecto, no el tamaño del backlog: el producto
tiene cinco capacidades must-have y dos funcionalidades transversales, descritas en
[product.md](product.md).

El **actor es único** en todas las historias: el propietario-inversor que autogestiona su
cartera. El MVP no tiene otros perfiles.

## Cobertura

| Capacidad del MVP (product.md §5) | Historia |
|---|---|
| 1. Gestión de propiedades | HU01 |
| 2. Gestión de créditos hipotecarios | HU01 |
| 3. Gestión de contratos y arriendos | HU02 |
| 4. Registro y control de pagos, ingresos y gastos | HU02 · HU03 |
| 5. Dashboard financiero e histórico mensual | HU03 |
| Documentos asociados (transversal) | HU01 · HU02 |
| Acceso protegido de usuario único (transversal) | — |

**No cubierto por estas tres historias**, y por tanto pendiente en el backlog:

- **Acceso protegido de usuario único** (product.md §6.7, §7.2). Forma parte del MVP pero
  no está entre las tres historias documentadas.
- **Carga inicial de datos históricos anonimizados** (product.md §7.2). No es una historia
  de usuario: es un proceso operativo controlado, no una funcionalidad del producto.

## Frontera entre historias

La capacidad 4 se reparte con un corte deliberado:

- **HU02** posee el ciclo de vida del pago de arriendo: monto esperado, abonos, estado.
- **HU03** posee la consolidación financiera: egresos, aportes, flujo neto y dashboard.

Y el dividendo hipotecario aparece en dos historias con roles distintos:

- **HU01** posee el **registro** mensual del dividendo pagado y del saldo pendiente.
- **HU03** posee su **consolidación** dentro del flujo del mes.

---

## HU01 — Administrar una propiedad y su crédito hipotecario

### Historia

Como propietario-inversor que autogestiona su cartera, quiero registrar cada propiedad
junto a su crédito hipotecario y su evolución mensual, para saber en un solo lugar qué
tengo y cuánto debo, sin recurrir a la cartola del banco ni a una hoja de cálculo.

### Contexto y alcance

Hoy los datos de una propiedad y las condiciones de su crédito viven en soportes
distintos, y el saldo pendiente solo se conoce abriendo la cartola del mes. Esta historia
establece el punto de partida de todo lo demás: sin propiedad registrada no hay contrato,
ni pagos, ni flujo financiero.

Cubre el alta y la consulta de propiedades con su información física y de compra, el
crédito hipotecario asociado con sus condiciones contractuales, el registro mensual del
dividendo pagado y del saldo pendiente, y los documentos que respaldan tanto la propiedad
como el crédito.

El sistema **no** calcula amortizaciones ni proyecta saldos: conserva lo que el usuario
registra a partir de la información del banco.

### Criterios de aceptación

**Escenario 1 — Alta de una propiedad**
- **Dado** que una propiedad no está en la cartera
- **Cuando** la registro con número de departamento, superficie, valor y fecha de compra
- **Entonces** queda disponible en la cartera y puedo consultarla

**Escenario 2 — Estacionamiento y bodega son opcionales**
- **Dado** que registro una propiedad sin estacionamiento y sin bodega
- **Cuando** guardo el registro
- **Entonces** la propiedad es válida y ambos elementos constan como ausentes

**Escenario 3 — Cartera de tamaño arbitrario**
- **Dado** una cartera con tres propiedades registradas
- **Cuando** registro una cuarta
- **Entonces** se incorpora como las anteriores, sin ninguna diferencia de trato

**Escenario 4 — Crédito asociado a una propiedad**
- **Dado** una propiedad registrada
- **Cuando** registro su crédito con banco, cuota pactada, saldo pendiente, tasa, número
  de cuotas, seguros, día de vencimiento y datos contractuales
- **Entonces** el crédito queda asociado únicamente a esa propiedad

**Escenario 5 — La cuota y el saldo conservan su unidad en UF**
- **Dado** un crédito cuyas condiciones se pactaron en UF
- **Cuando** consulto la cuota contractual y el saldo pendiente
- **Entonces** ambos se presentan en UF

**Escenario 6 — El equivalente en CLP no reemplaza la UF**
- **Dado** un crédito con cuota y saldo en UF
- **Cuando** consulto su equivalente en CLP
- **Entonces** se muestra el equivalente calculado con el valor de la UF del período y el
  valor original en UF sigue presente

**Escenario 7 — Registro mensual del dividendo y del saldo**
- **Dado** un crédito vigente y un mes determinado
- **Cuando** registro el dividendo efectivamente pagado, en CLP, y el saldo pendiente
  informado por el banco, en UF
- **Entonces** ambos quedan asociados a ese mes

**Escenario 8 — Consulta del histórico mensual**
- **Dado** varios meses con dividendo y saldo registrados
- **Cuando** consulto un mes anterior
- **Entonces** obtengo el dividendo pagado y el saldo pendiente que correspondían a ese
  mes, no los del mes en curso

**Escenario 9 — Documentos de la propiedad y del crédito**
- **Dado** una propiedad con su crédito registrado
- **Cuando** adjunto los documentos de la propiedad y el contrato hipotecario
- **Entonces** quedan localizables partiendo de la propiedad

**Caso límite 10 — Propiedad sin crédito hipotecario**
- **Dado** una propiedad registrada sin crédito asociado
- **Cuando** la consulto
- **Entonces** es una propiedad válida y no presenta dividendo ni saldo pendiente

**Caso límite 11 — Mes sin registro del crédito**
- **Dado** un crédito vigente y un mes para el que no registré dividendo ni saldo
- **Cuando** consulto ese mes
- **Entonces** el dividendo y el saldo constan como no registrados, y el sistema no los
  estima ni los arrastra del mes anterior

**Caso límite 12 — Sin amortización calculada**
- **Dado** un crédito con saldo registrado en un mes
- **Cuando** transcurre el mes siguiente sin que yo registre nada
- **Entonces** el saldo no se recalcula ni se proyecta

### Reglas de negocio relacionadas

- Una propiedad tiene número de departamento, superficie, valor y fecha de compra;
  estacionamiento y bodega son opcionales.
- Cada propiedad puede tener su propio crédito hipotecario, independiente del de las demás.
  El crédito es opcional.
- Los datos contractuales del crédito se expresan en UF cuando corresponde: cuota pactada
  y saldo pendiente informado por el banco. Un equivalente en CLP puede acompañarlos, sin
  reemplazarlos.
- El dividendo efectivamente pagado se registra en CLP: es el desembolso real.
- El sistema no simula ni recalcula la lógica interna del banco. El dividendo pagado y el
  saldo pendiente los registra el usuario; el sistema conserva la serie mensual.
- El producto se modela para N propiedades.

### Fuera de alcance

- Simular el crédito o calcular la amortización: el sistema no reproduce la lógica del
  banco.
- Derivar el dividendo en CLP a partir de la cuota en UF. El dividendo se registra, no se
  calcula.
- Valorización de mercado y tasaciones de la propiedad.
- Conciliación con la cartola bancaria.
- Interpretar el contenido de los documentos adjuntos.
- La consolidación del dividendo dentro del flujo del mes, que pertenece a **HU03**.

### Trazabilidad

`product.md` §5.1 y §5.2 (alcance) · §6.1 (propiedades) · §6.2 (créditos) · §6.6
(documentos) · §7.1 (reglas de propiedad, crédito y moneda) · §7.2 (N propiedades) · §8
(simulador hipotecario, conciliación, OCR).

---

## HU02 — Gestionar contrato de arriendo y pagos mensuales

### Historia

Como propietario-inversor que autogestiona su cartera, quiero registrar el contrato de
arriendo de cada propiedad y controlar mes a mes lo que debía cobrar frente a lo que
efectivamente recibí, para detectar por mí mismo qué está pendiente, parcial o vencido sin
cruzar comprobantes a mano.

### Contexto y alcance

Es la historia que resuelve el problema central: hoy el estado de un arriendo pagado a
medias o con retraso no existe en ninguna parte, así que se detecta tarde y por memoria.

Cubre el contrato con su arrendatario, vigencia, monto, garantía y día esperado de pago;
los reajustes de monto durante la vigencia sin perder la identidad del contrato; la
generación del pago esperado de cada mes; el registro de uno o varios abonos; la
determinación del estado del pago; y los documentos contractuales.

El sistema no cobra, no notifica al arrendatario y no genera contratos: registra hechos y
deriva estados.

### Criterios de aceptación

**Escenario 1 — Alta de un contrato**
- **Dado** una propiedad de la cartera
- **Cuando** registro un contrato con arrendatario, fecha de inicio, fecha de término,
  monto mensual en CLP, garantía y día esperado de pago
- **Entonces** el contrato queda vigente en el rango de fechas indicado

**Escenario 2 — Pago esperado del mes**
- **Dado** un contrato vigente durante un mes
- **Cuando** consulto ese mes
- **Entonces** existe un pago esperado por el monto que regía en ese mes, con su fecha
  esperada derivada del día esperado de pago

**Escenario 3 — Reajuste sin crear un contrato nuevo**
- **Dado** un contrato vigente con un monto mensual de 500.000 CLP
- **Cuando** registro un reajuste a 530.000 CLP con vigencia desde un mes determinado
- **Entonces** el contrato conserva su identidad, su arrendatario y su garantía, y el monto
  vigente pasa a ser 530.000 CLP desde ese mes

**Escenario 4 — Un mes anterior conserva el monto que regía**
- **Dado** un contrato con un reajuste aplicado desde un mes determinado
- **Cuando** consulto un mes anterior a esa vigencia
- **Entonces** el pago esperado de ese mes refleja el monto que regía entonces, no el
  vigente hoy

**Escenario 5 — Reajuste con vigencia retroactiva**
- **Dado** un contrato con pagos esperados ya generados para meses transcurridos
- **Cuando** registro un reajuste con fecha de vigencia anterior al mes en curso
- **Entonces** los pagos esperados de los meses comprendidos desde esa fecha se actualizan
  al nuevo monto, y el estado de cada uno se recalcula aplicando las reglas generales sobre
  el monto esperado corregido, los abonos ya registrados y la fecha esperada de pago

**Escenario 6 — Un solo abono cubre el pago**
- **Dado** un pago esperado de 600.000 CLP sin abonos
- **Cuando** registro un abono de 600.000 CLP
- **Entonces** el total recibido es 600.000 CLP y el pago queda **pagado**

**Escenario 7 — Varios abonos suman el total**
- **Dado** un pago esperado de 600.000 CLP
- **Cuando** registro abonos de 300.000, 200.000 y 100.000 CLP
- **Entonces** el total recibido es 600.000 CLP y el pago queda **pagado**

**Escenario 8 — Abono parcial antes del vencimiento**
- **Dado** un pago esperado de 600.000 CLP cuya fecha esperada aún no se ha cumplido
- **Cuando** registro un abono de 300.000 CLP
- **Entonces** el total recibido es 300.000 CLP y el pago queda **parcialmente pagado**

**Escenario 9 — Sin abonos y sin vencer**
- **Dado** un pago esperado sin abonos cuya fecha esperada aún no se ha cumplido
- **Cuando** lo consulto
- **Entonces** queda **pendiente**

**Escenario 10 — Vencido sin abonos**
- **Dado** un pago esperado sin abonos
- **Cuando** la fecha esperada ya pasó
- **Entonces** queda **vencido**

**Caso límite 11 — Vencido con abonos parciales**
- **Dado** un pago esperado de 600.000 CLP con abonos por 300.000 CLP
- **Cuando** la fecha esperada ya pasó
- **Entonces** queda **vencido**, y el producto indica explícitamente que se trata de un
  vencido con abonos parciales, con su total recibido y su saldo pendiente

**Caso límite 12 — El reajuste descubre un pago cuya fecha ya venció**
- **Dado** un pago esperado de 500.000 CLP con un abono de 500.000 CLP, en estado pagado, y
  cuya fecha esperada ya pasó
- **Cuando** un reajuste con vigencia retroactiva eleva el monto esperado de ese mes a
  530.000 CLP
- **Entonces** el pago queda **vencido**, con la indicación explícita de que tiene abonos
  parciales por 500.000 CLP y un saldo pendiente de 30.000 CLP — no queda simplemente
  parcialmente pagado

**Caso límite 13 — El reajuste descubre un pago que aún no ha vencido**
- **Dado** un pago esperado de 500.000 CLP con un abono de 500.000 CLP, en estado pagado, y
  cuya fecha esperada aún no se ha cumplido
- **Cuando** un reajuste eleva el monto esperado de ese mes a 530.000 CLP
- **Entonces** el pago queda **parcialmente pagado**, con un saldo pendiente de 30.000 CLP

**Caso límite 14 — Los abonos exceden el monto esperado**
- **Dado** un pago esperado de 600.000 CLP
- **Cuando** los abonos suman 620.000 CLP
- **Entonces** el monto esperado queda cubierto y el pago queda **pagado**

**Caso límite 15 — Mes sin contrato vigente**
- **Dado** una propiedad sin contrato vigente durante un mes, por estar entre dos contratos
  sucesivos o antes del primero
- **Cuando** consulto ese mes
- **Entonces** no existe pago esperado de arriendo para esa propiedad, y su ausencia no se
  interpreta como impago

**Escenario 16 — Contratos sucesivos**
- **Dado** un contrato terminado y un contrato posterior con otro arrendatario
- **Cuando** consulto la propiedad
- **Entonces** ambos constan en su histórico, cada uno con su vigencia y su arrendatario

**Escenario 17 — La garantía no es ingreso del mes**
- **Dado** un contrato con garantía registrada
- **Cuando** consulto el mes de inicio del contrato
- **Entonces** la garantía consta como información contractual y no figura entre los
  ingresos del mes

**Escenario 18 — Documentos contractuales**
- **Dado** un contrato registrado
- **Cuando** adjunto el contrato firmado y sus anexos
- **Entonces** quedan localizables desde el contrato y desde su propiedad

> **Precisión sobre el estado del pago.** `product.md` §6.4 define cuatro estados
> mutuamente excluyentes. Los casos límite 11, 12 y 13 mantienen **vencido** como estado
> —el vencimiento prevalece— y añaden la parcialidad como calificación explícita de ese
> estado, no como un quinto estado.
>
> La regla es uniforme y no depende de la causa del cambio: el estado se deriva siempre del
> monto esperado vigente, los abonos registrados y la fecha esperada. Que el monto haya
> cambiado por un reajuste no introduce un tratamiento distinto — por eso un pago
> descubierto por un reajuste queda *vencido con abonos parciales* si su fecha ya pasó, y
> *parcialmente pagado* solo si no ha vencido.
>
> Conviene reflejar esta precisión en `product.md` §6.4.

### Reglas de negocio relacionadas

- Los arriendos se manejan en CLP.
- Un contrato conserva su identidad durante su vigencia aunque cambie su monto. Se conserva
  el histórico de los montos aplicados.
- Una propiedad puede tener contratos sucesivos, con períodos sin arrendatario.
- El pago esperado lo genera el sistema desde el contrato vigente, con el monto que regía
  en ese período mensual. Sin contrato vigente no se espera ingreso por arriendo.
- Un pago esperado puede recibir uno o varios abonos. El monto recibido es la suma de los
  abonos asociados.
- El estado de un pago se determina a partir del monto esperado, los abonos recibidos y la
  fecha esperada de pago: pendiente, parcialmente pagado, pagado o vencido.
- Si el monto esperado cambia por un reajuste, el estado se recalcula con esas mismas
  reglas. Un pago cuya fecha esperada ya pasó y cuyos abonos no cubren el monto corregido
  queda vencido, conservando explícitamente que existen abonos parciales; solo queda
  parcialmente pagado si la fecha aún no ha vencido.
- La garantía es información contractual, no un ingreso recurrente del flujo mensual.

### Fuera de alcance

- Generar, redactar o firmar contratos.
- Cobrar el arriendo, ejecutar pagos o conciliar con el banco.
- Gestionar la devolución, retención o uso de la garantía.
- Extraer datos del contrato mediante OCR o IA: el documento se almacena, no se interpreta.
- Administración ordinaria de gastos comunes, que corresponde al arrendatario.
- La consolidación de los ingresos de arriendo en el flujo del mes, que pertenece a **HU03**.

### Trazabilidad

`product.md` §5.3 y §5.4 (alcance) · §6.3 (contratos y arriendos) · §6.4, apartado de pagos
de arriendo · §6.6 (documentos) · §7.1 (reglas de contrato, pago y garantía) · §8 (OCR,
pagos automáticos, gestión de la garantía, gastos comunes).

---

## HU03 — Gestionar y consultar el flujo financiero mensual

### Historia

Como propietario-inversor que autogestiona su cartera, quiero consultar el flujo financiero
de un mes con los ingresos, los egresos y los aportes de capital claramente separados, para
saber cuál fue el resultado real del período y cuánto capital propio he puesto, sin
consolidar información a mano.

### Contexto y alcance

Responde a la pregunta que hoy más trabajo cuesta: qué ocurrió financieramente en un mes.
Y la responde sin enmascarar el resultado: el capital propio inyectado explica cómo se
financió un déficit, no lo hace desaparecer.

Cubre los ingresos de arriendo recibidos, los dividendos efectivamente pagados, los demás
egresos e inversiones, los aportes de capital como concepto separado, el flujo neto antes
de aportes, el dashboard general de cartera, la vista individual por propiedad, el
histórico mensual y el tratamiento de las unidades UF y CLP.

### Criterios de aceptación

**Escenario 1 — Ingresos del mes**
- **Dado** un mes con abonos de arriendo registrados en varias propiedades
- **Cuando** consulto el dashboard de cartera de ese mes
- **Entonces** los ingresos recibidos corresponden a la suma de esos abonos, en CLP

**Escenario 2 — Egresos diferenciados**
- **Dado** un mes con dividendos pagados, una reparación y las contribuciones registradas
- **Cuando** consulto el dashboard de ese mes
- **Entonces** los dividendos efectivamente pagados y los otros gastos se presentan por
  separado, en CLP

**Escenario 3 — Flujo neto antes de aportes**
- **Dado** un mes con 500.000 CLP de ingresos y 650.000 CLP de egresos
- **Cuando** consulto el flujo neto antes de aportes
- **Entonces** obtengo −150.000 CLP

**Escenario 4 — El aporte no neutraliza el resultado**
- **Dado** ese mismo mes con un aporte de capital de 150.000 CLP
- **Cuando** consulto el dashboard
- **Entonces** el flujo neto antes de aportes sigue siendo −150.000 CLP y el aporte figura
  como una cifra separada de 150.000 CLP

**Escenario 5 — Inversión financiada con capital propio**
- **Dado** una remodelación de 2.000.000 CLP financiada con dinero propio
- **Cuando** consulto el mes
- **Entonces** el egreso por la remodelación figura entre los egresos y el aporte de
  capital de 2.000.000 CLP figura aparte, sin que ninguno sustituya al otro

**Escenario 6 — Aportes del mes y acumulados**
- **Dado** varios meses con aportes de capital registrados
- **Cuando** consulto el dashboard
- **Entonces** obtengo el aporte del mes y el acumulado histórico de capital propio

**Escenario 7 — Vista individual por propiedad**
- **Dado** un mes y una propiedad de la cartera
- **Cuando** consulto la vista de esa propiedad
- **Entonces** obtengo su crédito, su contrato vigente, sus pagos esperados y recibidos,
  sus egresos y sus aportes de ese mes

**Escenario 8 — El saldo de los créditos se mantiene en UF**
- **Dado** un mes con saldos de crédito registrados
- **Cuando** consulto el dashboard de cartera
- **Entonces** el saldo de los créditos se presenta en UF, y un equivalente en CLP puede
  acompañarlo sin reemplazarlo

**Escenario 9 — Estabilidad frente a variaciones posteriores de la UF**
- **Dado** un mes histórico que ya consulté
- **Cuando** el valor de la UF cambia después y vuelvo a consultar ese mes sin modificar
  ninguno de sus datos
- **Entonces** obtengo las mismas cifras que la primera vez

**Escenario 10 — Una cifra histórica cambia solo por edición explícita**
- **Dado** un mes histórico ya consultado
- **Cuando** modifico explícitamente un egreso de ese mes
- **Entonces** las cifras del mes reflejan esa modificación

**Escenario 11 — Estado de los pagos de arriendo en el dashboard**
- **Dado** un mes con pagos en distintos estados
- **Cuando** consulto el dashboard de cartera
- **Entonces** obtengo el estado de los pagos de arriendo del mes

**Caso límite 12 — Mes sin movimientos**
- **Dado** un mes sin ingresos, egresos ni aportes registrados
- **Cuando** lo consulto
- **Entonces** el mes se presenta con sus cifras en cero, incluido un flujo neto antes de
  aportes de 0 CLP

**Caso límite 13 — Gastos comunes durante la vacancia**
- **Dado** una propiedad sin arrendatario durante un mes, cuyos gastos comunes pagó el
  propietario
- **Cuando** los registro como egreso de esa propiedad
- **Entonces** figuran entre los egresos del mes de esa propiedad

**Caso límite 14 — Agregar no es comparar**
- **Dado** un mes y varias propiedades en la cartera
- **Cuando** consulto el dashboard de cartera
- **Entonces** obtengo los agregados del conjunto y puedo abrir cada propiedad por
  separado, sin ranking, puntuación ni indicador que ordene una propiedad frente a otra

### Reglas de negocio relacionadas

- Un egreso o inversión es uso de recursos de la propiedad. Un aporte de capital es dinero
  propio incorporado por el propietario. Son conceptos distintos: una inversión
  capitalizable no es un aporte por sí misma, y financiar una inversión con dinero propio
  genera ambos registros.
- El aporte de capital no se cuenta como egreso del mes.
- El flujo neto antes de aportes es el resultado del período mensual: ingresos de la
  operación menos egresos de la inversión. Los aportes se informan aparte y no lo
  neutralizan.
- Las métricas consolidadas del flujo se expresan en CLP; los datos contractuales del
  crédito conservan su unidad en UF.
- El valor de la UF se obtiene de una API pública chilena. El sistema no lo estima ni lo
  calcula.
- No existe cierre mensual ni inmutabilidad de períodos. La estabilidad del histórico
  proviene de conservar los datos registrados y el valor de UF asociado a cada período
  mensual.
- Los gastos comunes ordinarios corresponden al arrendatario. Si la propiedad está
  desocupada y los paga el propietario, se registran como egreso de la propiedad.
- El histórico financiero se consulta por período mensual.
- El dashboard agrega la cartera y permite consultar cada propiedad individualmente; no
  compara propiedades entre sí.

### Fuera de alcance

- Comparación entre propiedades: rankings, enfrentamientos de una propiedad frente a otra
  e indicadores destinados a determinar cuál rinde mejor.
- Proyecciones financieras: el flujo describe lo ocurrido, no lo previsto.
- Cierre mensual, reapertura o bloqueo de períodos.
- Conciliación bancaria y pagos automáticos.
- Declaración tributaria.
- Importación de archivos como funcionalidad del producto.
- El registro mensual del dividendo y del saldo del crédito, que pertenece a **HU01**.
- La determinación del estado de un pago de arriendo, que pertenece a **HU02**. HU03 lo
  presenta, no lo calcula.

### Trazabilidad

`product.md` §5.4 y §5.5 (alcance) · §6.4, apartados de movimientos financieros y aportes
de capital · §6.5 completo, incluidos flujo neto antes de aportes, moneda y
reproducibilidad del histórico · §7.1 (reglas de egreso, aporte, flujo y moneda) · §7.2
(sin comparación, sin cierre) · §8 (comparación, proyecciones, cierre mensual, tributario,
importador).
