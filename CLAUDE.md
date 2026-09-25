# RealtyTrack — Contexto del proyecto

Proyecto Final AI4Devs. Aplicación web personal para gestionar una cartera de
propiedades inmobiliarias en Chile. Evoluciona un proceso de gestión basado actualmente en hojas de cálculo hacia una plataforma centralizada. Se diseña para N propiedades; los datos iniciales son 3 departamentos.

## Estado actual

**Entrega 1 = solo documentación.** No se implementa código de aplicación.

Entrega 1 no implementa tests ni despliegue, pero **sí documenta**:

- la estrategia de testing prevista;
- la arquitectura de infraestructura y despliegue propuesta.

Distinguir siempre **diseñado/propuesto** de **implementado**. Las evidencias de tests
ejecutados, despliegue real, instrucciones de instalación definitivas, UX funcionando y
pull requests se completan en las entregas siguientes.

## Estructura documental

Dos niveles, coherentes entre sí y sin duplicación innecesaria:

- **`readme.md` (raíz)** — entregable principal de la plantilla AI4Devs. Conserva todas
  las secciones oficiales (0–7) y su numeración. Debe ser **autocontenido**: un evaluador
  comprende el proyecto leyendo solo el README. Resume e integra el contenido de `docs/`;
  no se limita a enlazarlo.
- **`prompts.md` (raíz)** — registro del uso de IA. Misma plantilla oficial.
- **`docs/`** — documentación técnica detallada; además es fuente de contexto durante el
  desarrollo:
  - `product.md` — problema, objetivo, alcance, funcionalidades, MVP y fuera de alcance
  - `architecture.md` — arquitectura, componentes, decisiones técnicas, infraestructura,
    seguridad
  - `data-model.md` — modelo de dominio, entidades, atributos, relaciones, restricciones
  - `user-stories.md` — historias de usuario y criterios de aceptación
  - `work-tickets.md` — tickets técnicos representativos
  - `diagrams/` — fuentes Mermaid versionables: `architecture.mmd`, `data-model.mmd`

No crear `adr/`, `api/`, `research/` ni otras carpetas hasta que exista una necesidad
real.

## Stack (confirmado)

- Aplicación: Next.js (App Router) + TypeScript — full-stack, un único despliegue
- UI: React + Tailwind CSS
- API: REST mediante Route Handlers de Next.js
- Persistencia: PostgreSQL (Neon), acceso con Prisma
- Archivos: object storage compatible con S3 — nunca binarios en PostgreSQL
- Externo: API pública chilena para el valor de la UF
- Despliegue: Vercel

## Dominio

Conceptos del dominio: Propiedad · Crédito hipotecario · Arrendatario · Contrato de
arriendo · Pago de arriendo · Movimiento financiero · Aporte de inversión · Documento.

**Aporte de inversión** se mantiene como concepto explícito: hace falta representar el
histórico de capital aportado y usarlo en el dashboard.

Todavía **no** está decidido si cada concepto será una tabla independiente. Eso se
resuelve al diseñar el modelo de datos (`docs/data-model.md`).

Reglas confirmadas:

- Una propiedad tiene número de departamento, superficie, valor y fecha de compra;
  estacionamiento y bodega son opcionales.
- Cada propiedad puede tener su propio crédito hipotecario (banco, cuota mensual, saldo
  pendiente, tasa, nº de cuotas, seguros, día de vencimiento, datos contractuales).
- **Créditos en UF; arriendos en CLP.** La moneda es parte del modelo de datos, no un
  detalle de presentación.
- El valor de la UF se obtiene de una API pública chilena. El sistema **no** simula ni
  recalcula la lógica interna del banco.
- Un contrato de arriendo tiene arrendatario, fecha de inicio y término, monto mensual,
  garantía, día esperado de pago, estado y documentos asociados.
- Un pago de arriendo distingue siempre **esperado** vs **recibido**.
  Estados: pendiente · pagado · parcialmente pagado · vencido.
- Movimientos financieros por propiedad: dividendos, reparaciones, equipamiento, seguros,
  contribuciones, gastos extraordinarios, otros.
- Los gastos comunes ordinarios los paga el arrendatario: fuera del control recurrente
  del propietario.
- El histórico financiero se consulta **por mes**.
- Documentos: PostgreSQL guarda solo metadata; el archivo vive en object storage.

## MVP (must-have)

1. Gestión de propiedades
2. Gestión de créditos hipotecarios
3. Gestión de contratos y arriendos
4. Registro y control de pagos, ingresos y gastos
5. Dashboard financiero e histórico mensual

Dashboard: ingresos recibidos, egresos, dividendos, otros gastos, flujo neto mensual,
aportes históricos de capital, saldo de créditos, estado de pagos de arriendos.
No hay comparación entre propiedades.

Autenticación: single-user — email + contraseña + JWT.

## Fuera de alcance (no proponer ni implementar)

Multiusuario y cartera compartida · integración bancaria · conciliación bancaria · pagos
automáticos · OCR · extracción de contratos con IA · simulador hipotecario · comparación
entre propiedades · administración ordinaria de gastos comunes · declaración tributaria ·
proyecciones financieras avanzadas · importador de Excel.

## Reglas de trabajo

- **Consultar antes de cambiar.** Antes de modificar requisitos, arquitectura o dominio,
  leer en este orden: `CLAUDE.md` → `readme.md` → los documentos relevantes de `docs/`.
  La documentación es la fuente de verdad; el código la sigue.
- **No inventar requisitos de negocio.** Si falta una decisión funcional que impide
  avanzar, señalarla explícitamente antes de implementar. Para decisiones técnicas
  reversibles no especificadas, usar la alternativa más simple, indicar el supuesto
  utilizado y evitar sobreingeniería. Si la plantilla obliga a documentar una decisión
  todavía no confirmada, marcarla como *propuesta a validar*, nunca como decisión
  confirmada.
- **Coherencia sin duplicación.** Un cambio de dominio o arquitectura se refleja en
  `docs/` (detalle) y en `readme.md` (versión integrada y autocontenida). El README nunca
  queda desactualizado respecto a `docs/`.
- **Simple antes que sobreingeniería.** La solución más directa que cumpla el requisito.
  Sin capas de abstracción especulativas ni patrones "por si acaso".
- **Datos del Excel: anonimizar antes de versionar.** Nombres de arrendatarios, RUT,
  direcciones, montos reales y documentos no entran al repositorio sin anonimizar.
  La carga se hace por seeds o scripts controlados, no por un importador.
- **Registrar los prompts.** El trabajo asistido por IA se documenta en `prompts.md` a
  medida que se hace, no al final.
- **Siguientes entregas**: tipado estricto (sin `any`), lógica de negocio en servicios
  testeables, sin cálculo financiero dentro de componentes React.

## Restricciones documentales de la plantilla AI4Devs

- En `readme.md` se documentan **3 historias de usuario** principales, aunque el backlog
  funcional puede contener más.
- Se documentan **3 tickets** representativos: uno backend, uno frontend y uno de base de
  datos.
- En la sección OpenAPI del `readme.md` se documentan **como máximo 3 endpoints**
  representativos, aunque la API real puede contener los endpoints necesarios para el MVP.
- En `prompts.md` se documentan **como máximo 3 prompts** principales por sección.

Estos límites son **documentales**: no son restricciones funcionales ni arquitectónicas
del producto.
