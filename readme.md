## Índice

0. [Ficha del proyecto](#0-ficha-del-proyecto)
1. [Descripción general del producto](#1-descripción-general-del-producto)
2. [Arquitectura del sistema](#2-arquitectura-del-sistema)
3. [Modelo de datos](#3-modelo-de-datos)
4. [Especificación de la API](#4-especificación-de-la-api)
5. [Historias de usuario](#5-historias-de-usuario)
6. [Tickets de trabajo](#6-tickets-de-trabajo)
7. [Pull requests](#7-pull-requests)

---

> **Nota sobre el estado del proyecto.** RealtyTrack ya tiene funcionalidades
> implementadas: autenticación de usuario único (T12), propiedades (T01), créditos
> hipotecarios y su registro mensual (T02, T03), contratos de arriendo (T04) y montos,
> reajustes y pagos esperados (T05), con pruebas automatizadas ejecutadas y una interfaz
> funcional para esas capacidades. **El MVP no está terminado**: siguen pendientes, entre
> otros, abonos y estado del pago (T06), movimientos financieros (T07), aportes de capital
> (T08), dashboard (T09), integración con la API de UF (T10) y documentos (T11), además del
> despliegue. Lo que describen las secciones para esas capacidades es diseño propuesto; cada
> sección distingue lo implementado de lo propuesto. El detalle técnico completo vive en
> `docs/`; este documento lo resume e integra, sin duplicarlo.

## 0. Ficha del proyecto

### **0.1. Tu nombre completo:**

Eliana Rodriguez

### **0.2. Nombre del proyecto:**

RealtyTrack

### **0.3. Descripción breve del proyecto:**

Aplicación web personal para centralizar y consultar el estado financiero y
contractual de una cartera de propiedades de inversión en Chile —propiedades,
créditos hipotecarios, contratos de arriendo, pagos, egresos y aportes de
capital—, evolucionando un proceso hoy basado en hojas de cálculo y
consolidación manual.

### **0.4. URL del proyecto:**

No existe un despliegue público. La aplicación se evalúa **localmente** siguiendo
las instrucciones de la sección 1.4, o mediante el **video explicativo** incluido en el
repositorio: [`realtytrack-entrega2.mp4`](realtytrack-entrega2.mp4) (archivo en la raíz;
en GitHub se reproduce desde el enlace, o descargando el repositorio). El despliegue en
Vercel descrito en la sección 2.4 es un diseño propuesto, no implementado.

### 0.5. URL o archivo comprimido del repositorio

`https://github.com/elianasaraith/feature-entrega-1-ESRF.git`

Esta entrega (Entrega 2) se desarrolla en la rama `feature/entrega-2-ESRF` —rama de
trabajo, no parte de la URL del repositorio—; la documentación de la Entrega 1 se
conserva en `feature/entrega-1-ESRF` y la rama por defecto del remoto es `main`.

---

## 1. Descripción general del producto

### **1.1. Objetivo:**

RealtyTrack está dirigido a un **propietario-inversor individual** que
autogestiona su propia cartera de propiedades de inversión: es a la vez
dueño, administrador y quien consulta la información, sin equipo ni terceros
involucrados.

Hoy cada propiedad acumula seis dimensiones de información —datos de la
propiedad, crédito hipotecario, contrato de arriendo, pagos mensuales,
egresos e inversiones, y documentación de respaldo— repartidas en hojas de
cálculo, cartolas bancarias, contratos en PDF y comprobantes sueltos, sin que
ninguna fuente sepa de las otras. El costo no está en registrar un dato, sino
en consolidarlo: responder qué pasó financieramente en un mes exige cruzar
varias fuentes a mano, y ese cruce no queda registrado para la próxima vez.

El objetivo del producto es ofrecer una **fuente única** donde el estado
financiero y contractual de cada propiedad quede registrado y sea consultable
por período mensual, sin consolidación manual. No automatiza la gestión
inmobiliaria ni sustituye al banco: centraliza y hace consultable la
información que hoy está dispersa, y hace explícita la diferencia entre lo
que se esperaba y lo que ocurrió.

Detalle completo: [docs/product.md](docs/product.md) §1–§3.

### **1.2. Características y funcionalidades principales:**

1. **Gestión de propiedades** — alta y consulta de cada propiedad de la
   cartera, con sus datos físicos y de compra; diseñado para N propiedades.
2. **Gestión de créditos hipotecarios** — condiciones contractuales en UF y
   registro mensual del dividendo pagado (CLP) y el saldo pendiente (UF),
   conservando la serie histórica.
3. **Gestión de contratos y arriendos** — contrato con su arrendatario e
   histórico de montos y reajustes, sin perder la identidad del contrato.
4. **Registro y control de pagos, ingresos y gastos** — pago esperado frente
   a abonos recibidos, con cuatro estados derivados (pendiente, parcialmente
   pagado, pagado, vencido); egresos e inversiones por propiedad; aportes de
   capital como concepto separado del gasto que financian.
5. **Dashboard financiero e histórico mensual** — ingresos, egresos, flujo
   neto antes de aportes, aportes acumulados, saldo de créditos y estado de
   las obligaciones de arriendo, a nivel de cartera y por propiedad, estable
   frente a variaciones posteriores de la UF.
6. **Almacenamiento de documentos** (transversal) — cada documento asociado a
   su propiedad y, cuando corresponde, al crédito, contrato o abono que
   respalda.
7. **Acceso protegido** (transversal) — usuario único, email y contraseña.

Detalle completo: [docs/product.md](docs/product.md) §5–§6.

### **1.3. Diseño y experiencia de usuario:**

**Estado:** la interfaz está implementada para acceso (`/login`), propiedades,
crédito hipotecario con su registro mensual, contratos y montos de arriendo
(`app/propiedades/**`, `app/(auth)/login`). Un recorrido de la aplicación en
funcionamiento está en el video [`realtytrack-entrega2.mp4`](realtytrack-entrega2.mp4);
este documento no incluye capturas. Las vistas de abonos, movimientos, aportes, documentos y el dashboard siguen
*pendientes*. El siguiente diagrama resume el **flujo de navegación previsto** (los
nodos `app/dashboard` y `app/contratos` son diseño; en la aplicación actual los
contratos viven bajo `app/propiedades/[id]/contratos`), construido a partir de las
vistas definidas en
[docs/architecture.md](docs/architecture.md) §7 y la estructura de `app/` de
§6:

```mermaid
flowchart TD
    Login["Pantalla de acceso<br/>(auth)/login"] --> Cartera["Cartera<br/>app/propiedades"]
    Cartera --> Detalle["Detalle de propiedad<br/>crédito · contrato · pagos · egresos · aportes · documentos"]
    Cartera --> Dashboard["Dashboard mensual<br/>app/dashboard"]
    Detalle --> Registro["Registro mensual del crédito<br/>app/propiedades/[id]/credito/registro-mensual"]
    Detalle --> Contrato["Contratos, reajustes, pagos y abonos<br/>app/contratos"]
    Dashboard -.->|"abrir propiedad"| Detalle
```

Las vistas de consulta se complementarán con los formularios de registro
previstos (alta de propiedad, crédito, contrato, reajuste, abono, movimiento,
aporte). Ningún cálculo financiero pertenece a la UI: los importes llegan ya
derivados desde la capa de servicios (`docs/architecture.md` §7).

### **1.4. Instrucciones de instalación:**

La aplicación se ejecuta **en local**; no hay despliegue público (sección 0.4). Si prefieres
no instalarla, el video [`realtytrack-entrega2.mp4`](realtytrack-entrega2.mp4) muestra la
aplicación funcionando.

**Stack implementado** (`package.json`): Next.js 16 (App Router) + React 19 +
TypeScript, Tailwind CSS 4, Route Handlers como API REST, Prisma 6 sobre
PostgreSQL, Auth.js (`next-auth` 5 beta, proveedor de credenciales con sesión JWT),
`argon2` para el hash de la contraseña, Zod 4 para validar entradas, y pruebas con el
ejecutor nativo `node --test` (+ `tsx`). **Aún no implementado** (diseño propuesto):
object storage S3, integración con la API de UF, Vercel/Neon.

**Requisitos previos:** Node.js (≥ 20; desarrollado con 23.11) con npm, y Docker con
Docker Compose para la base de datos local.

**1. Instalar dependencias**

```bash
npm install
```

**2. Configurar variables de entorno.** Copia la plantilla y completa los valores
(`.env` está ignorado por Git; nunca lo versiones):

```bash
cp .env.example .env
```

Variables que usa el código: `DATABASE_URL` y `DIRECT_URL` (conexión a PostgreSQL;
Prisma las lee de `.env`), `SEED_USER_EMAIL` y `SEED_USER_PASSWORD` (credenciales del
usuario único que crean los seeds), el secreto de sesión de Auth.js (`AUTH_SECRET`,
estándar de Auth.js v5; confirma su nombre en `.env.example`) y, solo para las pruebas
de integración, `TEST_DATABASE_URL`. Para la base local de Docker Compose la URL tiene
la forma `postgresql://realtytrack:<contraseña de docker-compose.yml>@localhost:5436/realtytrack`.

**3. Iniciar PostgreSQL con Docker Compose** (PostgreSQL 16, puerto `5436`, base y
usuario `realtytrack`; la contraseña de desarrollo local está en `docker-compose.yml`):

```bash
docker compose up -d db
```

**4. Aplicar las migraciones de Prisma**

```bash
npx prisma migrate deploy
npm run db:verify        # opcional: comprueba la conexión Prisma↔PostgreSQL
```

**5. Cargar los seeds** (datos ficticios; el usuario solo se crea si no existe):

```bash
npm run db:seed          # usuario único + 3 propiedades ficticias (ejecutar una sola vez)
# o bien, solo el usuario:
npm run db:seed:user
```

**6. Iniciar la aplicación**

```bash
npm run dev              # http://localhost:3000 → redirige a /login
```

Inicia sesión con `SEED_USER_EMAIL` / `SEED_USER_PASSWORD`. Otros scripts: `npm run build`,
`npm start`, `npm run lint`.

**7. Ejecutar las pruebas**

```bash
npm test
```

Las pruebas unitarias no requieren base de datos. Las de integración **solo escriben en
`TEST_DATABASE_URL`**, que debe apuntar a una base distinta de `DATABASE_URL` y
`DIRECT_URL` (`tests/setup/test-db.ts` lo verifica); si no está definida o no puede
comprobarse el aislamiento, esas pruebas se omiten. Para ejecutarlas, crea una base
aparte —por ejemplo `docker compose exec db createdb -U realtytrack realtytrack_test`—,
aplícale las migraciones con `DATABASE_URL` y `DIRECT_URL` apuntando a ella y define
`TEST_DATABASE_URL` en `.env`. Resultado verificado en el desarrollo de T05:
144 pruebas, 0 fallidas, 0 omitidas.

**Estado funcional.** Implementado: acceso de usuario único (T12), propiedades (T01),
crédito hipotecario (T02) y su registro mensual (T03), arrendatarios y contratos (T04),
y montos, reajustes y pagos esperados (T05). **Pendiente del MVP:** abonos y estado del
pago (T06), movimientos financieros (T07), aportes de capital (T08), dashboard mensual
(T09), valor de la UF (T10), documentos (T11) y despliegue.

---

## 2. Arquitectura del Sistema

### **2.1. Diagrama de arquitectura:**

```mermaid
flowchart TB
    Navegador["Navegador<br/>propietario-inversor"]

    subgraph Vercel["Vercel — aplicación Next.js"]
        direction TB
        UI["app/<br/>Server Components + Client Components"]
        API["app/api/<br/>Route Handlers — API REST"]
        SRV["server/services/<br/>Lógica de negocio y orquestación"]
        DOM["server/domain/<br/>Funciones puras — derivaciones"]
        DB["server/db/<br/>Prisma Client"]
        UF["server/uf/<br/>Puerto ProveedorUf"]
        ST["server/storage/<br/>Puerto AlmacenDocumentos"]
        AUTH["auth<br/>Auth.js + middleware"]
    end

    PG[("Neon<br/>PostgreSQL")]
    APIUF["API pública de UF<br/>proveedor a validar"]
    S3[("Object storage<br/>compatible con S3<br/>proveedor a validar")]

    Navegador -->|"HTTP · lectura"| UI
    Navegador -->|"HTTP · escritura"| API
    Navegador -.->|"subida directa<br/>URL firmada"| S3

    AUTH -.->|"protege"| UI
    AUTH -.->|"protege"| API

    UI -->|"lectura directa"| SRV
    API --> SRV
    SRV --> DOM
    SRV --> DB
    SRV --> UF
    SRV --> ST

    DB --> PG
    UF --> APIUF
    ST -->|"firma URLs"| S3
```

*(Diagrama de la arquitectura del MVP: la aplicación, la API REST, Prisma/PostgreSQL y
Auth.js están implementados; el almacenamiento de documentos, la API de la UF y el
despliegue siguen siendo diseño propuesto. Fuente versionable: [docs/diagrams/architecture.mmd](docs/diagrams/architecture.mmd).)*

RealtyTrack es una **aplicación full-stack única** —un repositorio, un
despliegue, una base de datos—, organizada en cuatro capas (UI, API,
servicios, dominio) con la regla de que la lógica de negocio vive en una sola
de ellas (`docs/architecture.md` §5).

No sigue un patrón de microservicios ni CQRS/event sourcing: es un **monolito
por capas**. La justificación es el propio producto (`docs/architecture.md`
§2): un usuario único, una cartera de pocas propiedades, sin concurrencia
relevante ni múltiples consumidores de la API. Cualquier forma de
distribución añadiría operación sin resolver ningún problema real del
producto.

**Beneficios.** Un solo despliegue y una sola fuente de lógica de negocio
—sin contratos duplicados entre servicios—; operación simple para un
proyecto de una sola persona.

**Déficits reconocidos.** Menor aislamiento entre componentes, y ausencia de
despliegue o escalado independiente por servicio. Se acepta porque el
producto no lo necesita: la alternativa —por ejemplo, un backend separado en
NestJS, descartada en `docs/architecture.md` §22— duplicaría despliegue,
contrato y configuración para servir a un único consumidor.

### **2.2. Descripción de componentes principales:**

| Componente | Tecnología | Responsabilidad |
|---|---|---|
| UI (`app/`) | React (Server + Client Components), Tailwind CSS | Presentar y capturar; ningún cálculo financiero |
| API (`app/api/`) | Route Handlers de Next.js, REST | Validar entrada, autenticar, invocar el servicio, traducir errores a HTTP |
| Servicios (`server/services/`) | TypeScript | Orquestar: leer, aplicar reglas, escribir; agregaciones mensuales y regla de caja |
| Dominio (`server/domain/`) | TypeScript, funciones puras | Reglas con precedencia: estado del pago, fecha de completitud, monto vigente, conversión UF→CLP |
| Persistencia (`server/db/`) | Prisma + PostgreSQL (Neon) | Acceso a datos, tipado generado desde el esquema |
| Integración UF (`server/uf/`) | Puerto `ProveedorUf` | Obtener el valor de la UF por fecha; proveedor concreto *propuesta a validar* |
| Documentos (`server/storage/`) | Puerto `AlmacenDocumentos`, API S3 | URL firmada de subida/lectura, borrado; proveedor concreto *propuesta a validar* |
| Autenticación (`auth`) | Auth.js, JWT, middleware | Sesión de usuario único; protege UI y API |

Detalle: [docs/architecture.md](docs/architecture.md) §3, §5.

### **2.3. Descripción de alto nivel del proyecto y estructura de ficheros**

```
app/
  (auth)/login/     pantalla de acceso                                  [implementado]
  propiedades/      cartera, detalle, crédito y registro mensual,
                    contratos y montos (propiedades/[id]/…)             [implementado]
  api/              Route Handlers — API REST                           [implementado]
  dashboard/        flujo financiero mensual de cartera                 [previsto]
server/
  auth/             verificación de credenciales y sesión requerida     [implementado]
  domain/           funciones puras: UF, vigencia de contrato, montos   [implementado]
  schemas/          validación Zod por entidad                          [implementado]
  services/         orquestación de propiedades, créditos, contratos    [implementado]
  db/               Prisma Client                                       [implementado]
  errors.ts         errores de dominio tipados → HTTP                   [implementado]
  uf/, storage/     puertos de la UF y del object storage               [previstos]
prisma/
  schema.prisma     esquema, espejo de docs/data-model.md
  migrations/       migraciones versionadas
  seed.ts           carga inicial ficticia (usuario + propiedades)
tests/              unitarias e integración (node --test)
openspec/           especificaciones y cambios archivados (Spec-Driven Development)
```

La estructura sigue las capas de §2.2 (`docs/architecture.md` §5), no un
patrón importado. `server/` es una convención de organización, no una
frontera que Next.js imponga por sí solo: los módulos exclusivamente de
servidor se marcan con `server-only`, de modo que una importación accidental
desde el cliente falle en tiempo de compilación en vez de filtrarse en
silencio (`docs/architecture.md` §6).

### **2.4. Infraestructura y despliegue**

> Diseño propuesto; a la fecha no existe despliegue real (la aplicación se ejecuta en
> local, sección 1.4).

```mermaid
flowchart LR
    Dev["Repositorio Git"] -->|"push a rama"| Preview["Vercel<br/>despliegue de vista previa"]
    Dev -->|"merge a main"| Prod["Vercel<br/>producción"]
    Prod --> NeonProd[("Neon<br/>base de producción")]
    Prod --> S3P[("Object storage")]
    Preview --> NeonPrev[("Base para vistas previa<br/>estrategia pendiente")]
```

| Aspecto | Decisión prevista |
|---|---|
| Alojamiento | Vercel, conectado al repositorio |
| Vistas previa | Cada PR genera un despliegue propio |
| Producción | Despliegue desde `main` |
| Base de datos | Neon (PostgreSQL) |
| Migraciones | Paso deliberado, no encadenado al build |

Pendiente de decisión (*propuesta a validar*): aislamiento de datos entre
despliegues de vista previa —base compartida vs. Neon *branching* por PR—
(`docs/architecture.md` §15.2).

Detalle: [docs/architecture.md](docs/architecture.md) §15.

### **2.5. Seguridad**

**Implementado** (T12 y capas posteriores):

- Acceso protegido con Auth.js: proveedor de credenciales y sesión JWT.
- Contraseña con hash Argon2 (`argon2`); verificación propia en
  `server/auth/verify-credentials.ts`, con pruebas.
- `proxy.ts` protege toda ruta salvo la pantalla de acceso y cada Route Handler exige
  sesión (`requireSession`, 401 sin ella); usuario único creado por seed, sin endpoint
  de registro.
- Validación de entradas con Zod en el borde de la API y errores de dominio traducidos a
  HTTP en un único punto (`server/errors.ts`).
- Ningún secreto versionado: `.env*` está en `.gitignore` salvo `.env.example`.
- Pruebas de integración aisladas: solo escriben en `TEST_DATABASE_URL`, distinta de la
  base de desarrollo.

**Previsto, no implementado:**

- Atributos de cookie `httpOnly` + `Secure` + `SameSite` verificados en despliegue.
- Bucket de documentos privado; el acceso es siempre por URL firmada de vida
  corta, nunca público.
- Sin prefijo público de Next.js en credenciales (regla de diseño aplicable a las
  futuras variables del object storage y de la UF).

**Regla de datos (vigente):** los datos reales de las propiedades se anonimizan antes de
versionar (nombres, RUT, direcciones, montos, documentos) y se cargan por un script de
seed controlado, no por un importador; el seed actual solo contiene datos ficticios.

Detalle: [docs/architecture.md](docs/architecture.md) §11, §16.

### **2.6. Tests**

> **Estado real:** hay pruebas automatizadas ejecutables con `npm test` (`node --test`):
> **144 pruebas, 0 fallidas, 0 omitidas** en la última ejecución verificada (desarrollo
> de T05), cubriendo unitarias de esquemas y dominio, integración de servicios contra
> PostgreSQL de pruebas aislada, y control de acceso de la API (`tests/auth/proxy.test.ts`).
> No hay pruebas extremo a extremo automatizadas ni de componentes de interfaz; la
> interfaz se verificó manualmente. La tabla describe la estrategia completa, incluidos
> los niveles aún no implementados.

| Nivel | Qué cubriría | Por qué ahí |
|---|---|---|
| Unitario sobre el dominio | Precedencia de los cuatro estados del pago y sus calificaciones, fecha de completitud, monto vigente ante reajuste retroactivo, conversión UF→CLP | Funciones puras; se prueban con tablas de casos, sin base de datos |
| Integración de servicios | Invariantes que la base no impone: no solapamiento de contratos, documento coherente con su propiedad, monto esperado alineado con `contrato_monto` | Requieren PostgreSQL real |
| API | Códigos de estado, validación de entrada, control de acceso | Es el contrato de la capa REST |
| Extremo a extremo | Un recorrido por HU01, HU02 y HU03 | *Propuesta a validar*: el valor está en los dos primeros niveles |

Los casos límite ya documentados en
[docs/user-stories.md](docs/user-stories.md) (HU01 CL10–CL12, HU02 CL11–CL15,
HU03 CL12–CL14) están escritos para traducirse directamente en casos de
prueba, sin reinterpretarlos.

Detalle: [docs/architecture.md](docs/architecture.md) §18.

---

## 3. Modelo de Datos

### **3.1. Diagrama del modelo de datos:**

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

    APORTE_CAPITAL {
        uuid id PK
        uuid propiedad_id FK "NOT NULL"
        uuid movimiento_financiero_id FK "NULL"
        date fecha "NOT NULL - fecha de caja"
        numeric monto_clp "NOT NULL - 14,0"
        motivo_aporte motivo "NOT NULL"
        text descripcion "NULL"
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

    PROPIEDAD ||--o| CREDITO_HIPOTECARIO : "tiene como maximo uno"
    CREDITO_HIPOTECARIO ||--o{ CREDITO_REGISTRO_MENSUAL : "registra mes a mes"
    PROPIEDAD ||--o{ CONTRATO_ARRIENDO : "arrienda mediante"
    ARRENDATARIO ||--o{ CONTRATO_ARRIENDO : "es parte de"
    CONTRATO_ARRIENDO ||--|{ CONTRATO_MONTO : "rige por"
    CONTRATO_ARRIENDO ||--o{ PAGO_ESPERADO : "genera"
    PAGO_ESPERADO ||--o{ ABONO_ARRIENDO : "se cubre con"
    PROPIEDAD ||--o{ MOVIMIENTO_FINANCIERO : "incurre en"
    PROPIEDAD ||--o{ APORTE_CAPITAL : "recibe"
    MOVIMIENTO_FINANCIERO ||--o{ APORTE_CAPITAL : "es financiado por"
    PROPIEDAD ||--o{ DOCUMENTO : "agrupa"
    CREDITO_HIPOTECARIO ||--o{ DOCUMENTO : "respaldado por"
    CONTRATO_ARRIENDO ||--o{ DOCUMENTO : "respaldado por"
    ABONO_ARRIENDO ||--o{ DOCUMENTO : "respaldado por"
    MOVIMIENTO_FINANCIERO ||--o{ DOCUMENTO : "respaldado por"
```

*(Modelo lógico del MVP: están en el esquema Prisma las entidades de propiedad, crédito y
registro mensual, usuario, arrendatario, contrato, `contrato_monto` y `pago_esperado`; el
resto (abonos, movimientos, aportes, documentos, UF) es diseño propuesto. Fuente versionable:
[docs/diagrams/data-model.mmd](docs/diagrams/data-model.mmd).)*

`USUARIO` y `VALOR_UF_PERIODO` no tienen relaciones: el primero solo guarda
credenciales de un usuario único, y el segundo es una tabla de referencia
consultada por período.

### **3.2. Descripción de entidades principales:**

| Entidad | Propósito | Claves | Restricción destacada |
|---|---|---|---|
| `usuario` | Credenciales del único usuario del sistema | PK `id`; `email` UNIQUE | Sin `usuario_id` en el resto del modelo: el MVP es de usuario único |
| `propiedad` | Unidad de la cartera; raíz de la que cuelga todo lo demás | PK `id` | `valor_compra_monto NUMERIC(14,4)` con `valor_compra_moneda` explícita (UF o CLP) |
| `credito_hipotecario` | Condiciones contractuales del crédito de una propiedad | PK `id`; FK `propiedad_id` | `UNIQUE(propiedad_id)` — como máximo un crédito por propiedad |
| `credito_registro_mensual` | Serie mensual del dividendo pagado y el saldo informado por el banco | PK `id`; FK `credito_id` | `UNIQUE(credito_id, periodo)`; dos `CHECK` — no ambos datos nulos; `fecha_pago_dividendo` presente si y solo si hay dividendo |
| `arrendatario` | Persona que arrienda, reutilizable entre contratos sucesivos | PK `id`; `rut` UNIQUE nulable | — |
| `contrato_arriendo` | Contrato de arriendo de una propiedad, con su vigencia y garantía | PK `id`; FK `propiedad_id`, `arrendatario_id` | Sin columna `estado`: la vigencia se deriva de `fecha_inicio`/`fecha_termino` |
| `contrato_monto` | Histórico de los montos aplicados a lo largo de un contrato | PK `id`; FK `contrato_id` | `UNIQUE(contrato_id, vigente_desde_periodo)`; el monto inicial es su primera fila, no una columna del contrato (el monto inicial es opcional en el alta: sin él el contrato no tiene fila y no genera pagos esperados hasta registrar el primer monto, T05; propuesta a validar). Los reajustes agregan filas y nunca modifican las anteriores |
| `pago_esperado` | Lo que se espera cobrar por arriendo en un período mensual | PK `id`; FK `contrato_id` | `UNIQUE(contrato_id, periodo)`; `CHECK` monto > 0 y período día 1; snapshot del monto vigente en ese mes. Lo crea una sincronización explícita e idempotente (T05) y un reajuste solo actualiza `monto_esperado_clp` desde su período |
| `abono_arriendo` | Cada entrega de dinero recibida contra un pago esperado | PK `id`; FK `pago_esperado_id` | Sin tope: los abonos pueden exceder el monto esperado sin rechazar el registro |
| `movimiento_financiero` | Egresos e inversiones de una propiedad | PK `id`; FK `propiedad_id` | `ENUM categoria_movimiento` sin valor `DIVIDENDO`, para no duplicar esa salida de dinero |
| `aporte_capital` | Capital propio que el propietario incorpora a una propiedad | PK `id`; FK `propiedad_id`; FK opcional `movimiento_financiero_id` | Nunca entra en el flujo neto antes de aportes |
| `valor_uf_periodo` | Valor de la UF asociado a cada período mensual | PK `periodo` | No se sobrescribe por una consulta posterior a la API, una vez almacenado |
| `documento` | Metadata de los archivos; el binario vive en object storage | PK `id`; FK `propiedad_id` obligatoria + 4 FK específicas opcionales | `CHECK`: a lo sumo una de las cuatro FK opcionales es no nula |

Detalle exhaustivo de cada atributo, tipo y restricción:
[docs/data-model.md](docs/data-model.md) §4.

El modelo distingue además **dos dimensiones temporales** que conviven sin
competir: el período de origen de un hecho (por ejemplo,
`credito_registro_mensual.periodo`, la mensualidad hipotecaria) y el mes de
caja en que realmente ocurrió (por ejemplo, `fecha_pago_dividendo`). El
siguiente diagrama, con un ejemplo marzo → abril, resume esa separación
(detalle completo en [docs/data-model.md](docs/data-model.md) §7):

```mermaid
flowchart TB
    subgraph OBL["PERIODO DE ORIGEN — marzo 2026"]
        direction TB
        PE["ARRIENDO<br/>pago_esperado<br/>periodo = 2026-03<br/>monto_esperado_clp = 600.000"]
        CRM1["HIPOTECA<br/>credito_registro_mensual<br/>periodo = 2026-03<br/>mensualidad hipotecaria"]
    end

    subgraph CAJA["MES DE CAJA — abril 2026"]
        direction TB
        AB["ARRIENDO<br/>abono_arriendo<br/>fecha_recepcion = 05-04-2026<br/>monto_clp = 600.000"]
        CRM2["HIPOTECA<br/>credito_registro_mensual<br/>fecha_pago_dividendo = 03-04-2026<br/>dividendo_pagado_clp = 850.000"]
    end

    VMAR["Consulta de MARZO<br/>esperado vs recibido<br/>serie mensual del credito"]
    VABR["Flujo financiero de ABRIL<br/>ingresos y egresos del mes"]
    ROT["Rotulo derivado en pantalla<br/>Correspondiente a marzo 2026<br/>NINGUNA columna lo almacena"]

    PE ==>|"periodo de origen"| VMAR
    CRM1 ==>|"periodo de origen"| VMAR
    AB ==>|"fecha de caja"| VABR
    CRM2 ==>|"fecha de caja"| VABR

    PE -. "dos tablas unidas por clave foranea 1:N" .-> AB
    CRM1 -. "dos columnas de la MISMA fila" .-> CRM2

    AB -. "abono_arriendo a pago_esperado a periodo" .-> ROT
    CRM2 -. "periodo de la propia fila" .-> ROT
```

*(Fuente versionable:
[docs/diagrams/financial-flow.mmd](docs/diagrams/financial-flow.mmd).)*

---

## 4. Especificación de la API

La API es REST (`docs/architecture.md` §8), diseñada **por caso de uso**, no
como CRUD por entidad. De las capacidades que cubre (`docs/architecture.md`
§8.3), estos tres endpoints se documentan como representativos porque cada
uno ilustra una regla de diseño distinta del modelo: una operación de
producto que orquesta varias escrituras, la frontera entre lo que se escribe
y lo que se deriva, y la agregación mensual que respeta la regla de caja.

Estos son los contratos del MVP. El endpoint 4.1 (T05) está **implementado y
verificado**; los endpoints 4.2 (abonos, T06) y 4.3 (dashboard, T09) siguen siendo
**contratos propuestos**, aún no implementados. Donde el detalle exacto de un campo no está fijado por
`docs/architecture.md` o `docs/data-model.md`, se marca explícitamente como
**contrato API propuesto de Entrega 1**, para no presentarlo como una
decisión ya cerrada.

### 4.1 `POST /api/propiedades/{propiedadId}/contratos/{contratoId}/montos`

Registrar el primer monto o un reajuste del monto de arriendo (T05, **implementado**).
Escribe una nueva fila en `contrato_monto` —nunca modifica ni elimina las anteriores— y
actualiza `monto_esperado_clp` de los `pago_esperado` ya existentes desde su período, sin
alterar los meses anteriores (`docs/data-model.md` §4.7–§4.8). No crea pagos: eso lo hace la
operación explícita `POST .../pagos-esperados/sincronizar`, que genera los pagos faltantes
desde el mes de inicio hasta el mes en curso (o el de término), es idempotente y solo
actúa si el contrato tiene un monto registrado. No registra abonos ni calcula el estado del
pago (T06).

```yaml
paths:
  /api/propiedades/{propiedadId}/contratos/{contratoId}/montos:
    post:
      summary: Registrar el primer monto o un reajuste del monto de arriendo
      parameters:
        - name: propiedadId
          in: path
          required: true
          schema: { type: string, format: uuid }
        - name: contratoId
          in: path
          required: true
          schema: { type: string, format: uuid }
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [montoMensualClp, vigenteDesdePeriodo]
              properties:
                montoMensualClp: { type: string, description: "CLP entero > 0, hasta NUMERIC(14,0)" }
                vigenteDesdePeriodo: { type: string, description: "Mes en formato YYYY-MM; se almacena como día 1" }
                motivo: { type: string, nullable: true }
      responses:
        "201": { description: "Fila de contrato_monto creada" }
        "400": { description: "Entrada inválida (monto o período mal formado)" }
        "404": { description: "Propiedad o contrato inexistente, o el contrato no pertenece a la propiedad" }
        "409": { description: "Ya existe un monto para ese período" }
        "422": { description: "Primer monto distinto del mes de inicio, o período fuera de la vigencia del contrato" }
```

Ejemplo:

`POST /api/propiedades/3c1d…/contratos/6f2b…/montos`

```json
{ "montoMensualClp": "530000", "vigenteDesdePeriodo": "2026-09", "motivo": "reajuste anual" }
```

Respuesta `201`:

```json
{
  "id": "...",
  "montoMensualClp": "530000",
  "vigenteDesdePeriodo": "2026-09-01",
  "motivo": "reajuste anual",
  "createdAt": "..."
}
```

Verificado: `npm test` (144 pruebas, 0 fallidas), TypeScript, lint y revisión manual de
la interfaz de montos. El borrado y la edición de filas de monto no existen (405).

### 4.2 `POST /api/pagos-esperados/{pagoEsperadoId}/abonos`

Registrar un abono contra un pago esperado. Inserta una fila en
`abono_arriendo`; no escribe ningún estado — el estado del pago se deriva en
la respuesta a partir del monto esperado, los abonos y la fecha de
referencia (`docs/data-model.md` §6.1; `docs/architecture.md` §19).

```yaml
paths:
  /api/pagos-esperados/{pagoEsperadoId}/abonos:
    post:
      summary: Registrar un abono contra un pago esperado
      parameters:
        - name: pagoEsperadoId
          in: path
          required: true
          schema: { type: string, format: uuid }
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [monto_clp, fecha_recepcion]
              properties:
                monto_clp: { type: string, description: "CLP, > 0, sin tope frente al monto esperado; representación sin pérdida (docs/architecture.md §9.1)" }
                fecha_recepcion: { type: string, format: date }
                medio: { type: string, nullable: true }
      responses:
        "201": { description: "Abono registrado, con el estado derivado del pago tras aplicarlo" }
        "400": { description: "Entrada inválida" }
        "404": { description: "Pago esperado inexistente" }
```

Ejemplo:

`POST /api/pagos-esperados/9c1e.../abonos`

```json
{ "monto_clp": "300000", "fecha_recepcion": "2026-03-03", "medio": "transferencia" }
```

Respuesta `201`:

```json
{
  "abono": { "id": "...", "monto_clp": "300000", "fecha_recepcion": "2026-03-03" },
  "pago_esperado": {
    "monto_esperado_clp": "600000",
    "monto_recibido_clp": "300000",
    "estado": "PARCIALMENTE_PAGADO",
    "calificacion": null
  }
}
```

Devolver el pago junto al abono es **contrato API propuesto de Entrega 1**;
lo confirmado por los documentos fuente es que `estado` y
`monto_recibido_clp` son campos derivados, nunca columnas
(`docs/data-model.md` §6, §6.1).

### 4.3 `GET /api/dashboard?periodo=YYYY-MM`

Consultar el flujo financiero de la cartera en un período mensual.
Agregación en PostgreSQL que respeta la regla de caja: ingresos por
`fecha_recepcion`, egresos por `fecha` / `fecha_pago_dividendo` — nunca por
`periodo` (`docs/data-model.md` §7; `docs/architecture.md` §10).

```yaml
paths:
  /api/dashboard:
    get:
      summary: Consultar el flujo financiero de la cartera en un período mensual
      parameters:
        - name: periodo
          in: query
          required: true
          schema: { type: string, pattern: "^[0-9]{4}-(0[1-9]|1[0-2])$", example: "2026-03" }
      responses:
        "200": { description: "Agregados del período, en cero si no hay movimientos" }
        "401": { description: "Sin sesión" }
```

Ejemplo:

`GET /api/dashboard?periodo=2026-03`

Respuesta `200`:

```json
{
  "periodo": "2026-03",
  "ingresos_clp": "500000",
  "egresos_clp": "650000",
  "flujo_neto_antes_de_aportes_clp": "-150000",
  "aportes_mes_clp": "150000",
  "aportes_acumulados_clp": "4500000",
  "saldo_creditos_uf": "812.4"
}
```

El nombre exacto de cada campo y el desglose por propiedad son **contrato
API propuesto de Entrega 1**; las cifras y su regla de cálculo sí están
confirmadas por `docs/product.md` §6.5 y `docs/data-model.md` §6.

---

## 5. Historias de Usuario

**Historia de Usuario 1 — HU01: Administrar una propiedad y su crédito hipotecario**

Como propietario-inversor que autogestiona su cartera, quiero registrar cada
propiedad junto a su crédito hipotecario y su evolución mensual, para saber
en un solo lugar qué tengo y cuánto debo, sin recurrir a la cartola del banco
ni a una hoja de cálculo.

Criterios de aceptación representativos:

- Al registrar una propiedad con número de departamento, superficie, valor y
  fecha de compra, queda disponible y consultable en la cartera (Escenario 1).
- La cuota contractual y el saldo pendiente del crédito se presentan en UF;
  un equivalente en CLP puede acompañarlos sin reemplazarlos (Escenarios
  5–6).
- Al registrar el dividendo pagado (CLP) y el saldo pendiente (UF) de un mes,
  ambos quedan asociados a ese mes; un mes sin registro consta como no
  registrado, sin estimarlo ni arrastrar el mes anterior (Escenario 7; Caso
  límite 11).

Detalle íntegro (9 escenarios, 3 casos límite):
[docs/user-stories.md](docs/user-stories.md) — HU01.

**Historia de Usuario 2 — HU02: Gestionar contrato de arriendo y pagos mensuales**

Como propietario-inversor que autogestiona su cartera, quiero registrar el
contrato de arriendo de cada propiedad y controlar mes a mes lo que debía
cobrar frente a lo que efectivamente recibí, para detectar por mí mismo qué
está pendiente, parcial o vencido sin cruzar comprobantes a mano.

Criterios de aceptación representativos:

- Un reajuste de monto no crea un contrato nuevo: el contrato conserva su
  identidad, su arrendatario y su garantía, y el monto vigente cambia desde
  el mes indicado (Escenario 3).
- El estado de un pago se determina por precedencia a partir del monto
  esperado, los abonos recibidos y la fecha esperada: pendiente, parcialmente
  pagado, pagado o vencido (Escenarios 6–10).
- Un pago vencido con abonos parciales se presenta como vencido, indicando
  explícitamente el total recibido y el saldo pendiente — nunca como un
  quinto estado (Caso límite 11).
- Un reajuste retroactivo recalcula el monto esperado y, con él, el estado ya
  derivado de los pagos afectados (Escenario 5; Casos límite 12–13).

Detalle íntegro (13 escenarios, 5 casos límite):
[docs/user-stories.md](docs/user-stories.md) — HU02.

**Historia de Usuario 3 — HU03: Gestionar y consultar el flujo financiero mensual**

Como propietario-inversor que autogestiona su cartera, quiero consultar el
flujo financiero de un mes con los ingresos, los egresos y los aportes de
capital claramente separados, para saber cuál fue el resultado real del
período y cuánto capital propio he puesto, sin consolidar información a
mano.

Criterios de aceptación representativos:

- El flujo neto antes de aportes es el resultado del período: ingresos menos
  egresos; el aporte de capital se informa aparte y no lo neutraliza
  (Escenarios 3–4).
- Un mes histórico produce las mismas cifras en dos consultas sucesivas,
  aunque el valor de la UF cambie entre ambas (Escenario 9).
- El dashboard agrega la cartera y permite abrir cada propiedad por separado,
  sin ranking ni comparación entre propiedades (Caso límite 14).

Detalle íntegro (11 escenarios, 3 casos límite):
[docs/user-stories.md](docs/user-stories.md) — HU03.

---

## 6. Tickets de Trabajo

El backlog técnico completo (T01–T12,
[docs/work-tickets.md](docs/work-tickets.md)) se organiza **principalmente en
rebanadas verticales**, con tickets backend y capacidades transversales
cuando corresponde. Esta plantilla exige, en cambio, un ejemplo por capa
—backend, frontend, base de datos—. Para cumplir ambas cosas sin contradecirlas, esta sección no
fragmenta el backlog ni reclasifica ningún ticket: **selecciona, dentro de
tickets ya verticales, el trabajo que mejor ilustra cada capa**. T09 y T03
siguen siendo full-stack en `docs/work-tickets.md`; lo que sigue es un
recorte de lectura de cada uno, no un ticket nuevo.

### Ticket 1 (backend) — T06: Registro de abonos y estado del pago de arriendo

El ticket completo, sin recortar — es en sí mismo de tipo backend en
`docs/work-tickets.md` §4.6.

**Objetivo.** Registrar uno o varios abonos contra un pago esperado y derivar
su estado —cuatro estados excluyentes más dos calificaciones— sin persistir
ninguno de los dos.

**Historia relacionada.** HU02.

**Alcance.**
- Alta de uno o varios `abono_arriendo` contra un `pago_esperado`, sin tope
  sobre el monto esperado.
- Dominio puro que deriva monto recibido, saldo pendiente, estado
  (`PENDIENTE` · `PARCIALMENTE_PAGADO` · `VENCIDO` · `PAGADO`), fecha de
  completitud y las dos calificaciones, con la fecha de referencia inyectada,
  nunca leída del reloj del sistema.

**Criterios de aceptación:**
| # | Escenario | Resumen |
|---|---|---|
| AC1 | E6/E7 | Un abono o la suma de varios que alcanza el esperado deja el pago en `PAGADO` |
| AC2 | E8/E9/E10 | Pendiente sin abonos y sin vencer; parcial sin vencer; vencido sin abonos |
| AC3 | CL11 | Un pago con abonos parciales cuya fecha ya pasó queda `VENCIDO`, con su total recibido y saldo pendiente |
| AC4 | CL12/CL13 | Un reajuste que descubre un pago aplica la misma precedencia, sin tratamiento especial |
| AC5 | CL14 | Abonos que superan el monto esperado dejan el pago `PAGADO` |

**Entidades:** `abono_arriendo`; lee `pago_esperado`.

**Componentes y capas:** dominio (precedencia de estados, fecha de
completitud), API (Route Handler de abonos), persistencia (`abono_arriendo`
sin tope de monto).

**Dependencias:** T05 (`pago_esperado_id`).

**Fuera de alcance:** cobrar o ejecutar el pago; consolidación del ingreso en
el flujo del mes (T09); comprobante del abono como documento (T11, no
bloqueante).

**Estrategia de pruebas:** unitario de dominio — tabla de verdad completa de
las cuatro reglas de precedencia y las dos calificaciones.

Detalle íntegro: [docs/work-tickets.md](docs/work-tickets.md) §4.6.

### Ticket 2 (frontend) — Interfaz del dashboard financiero mensual

Corresponde a la **capa frontend de T09** — Dashboard financiero mensual,
full-stack en `docs/work-tickets.md` §4.9. No es un ticket independiente: el
servicio de agregación mensual que esta interfaz consume sigue siendo
propiedad de T09.

**Objetivo de esta capa.** Presentar el flujo financiero mensual —ingresos,
egresos, flujo neto antes de aportes, aportes del mes y acumulados, saldo de
los créditos y estado de las obligaciones de arriendo del período
consultado— en la vista de cartera y en la vista por propiedad, consumiendo
los datos que ya entrega el servicio de agregación de T09. No calcula nada:
formatea y presenta.

**Historia relacionada.** HU03 (la misma de T09).

**Alcance de esta capa.**
- Vistas `app/dashboard/` (cartera) y la porción de `app/propiedades/[id]/`
  que muestra el resumen mensual.
- Selector del período mensual a consultar.
- Presentación de las cifras ya calculadas por el servicio de T09.
- Server Components por defecto; rutas dinámicas, sin caché estática, por la
  regla de `docs/architecture.md` §7.1 —el estado de un pago cambia con el
  paso del tiempo, sin que nadie escriba nada—.

**Criterios de aceptación** (los escenarios de HU03 que son de presentación
pura):
| # | Escenario | Resumen |
|---|---|---|
| AC1 | E1 | Los ingresos ya calculados se muestran en la vista de cartera |
| AC2 | E3 | El flujo neto ya calculado se presenta sin recalcularlo en el componente |
| AC3 | CL12 | La vista presenta cifras en cero cuando el mes no tiene movimientos |
| AC4 | CL14 | La vista de cartera no ordena ni puntúa propiedades entre sí |

**Entidades:** ninguna propia — consume la salida del servicio de T09.

**Componentes y capas:** solo UI (`app/dashboard/`, componentes de
presentación); ningún servicio ni dominio propio.

**Dependencias:** el servicio de agregación de T09, que esta interfaz
consume sin poseerlo.

**Fuera de alcance:** cualquier cálculo financiero; la agregación mensual en
sí (la posee el servicio de T09); la derivación del estado del pago (la
posee T06) — esta capa la presenta, no la calcula.

**Estrategia de pruebas:** pruebas de presentación —formato de cifras,
selector de período, estado vacío de CL12—; no repite las pruebas de
integración de la agregación, que ya cubre T09.

Ticket de origen, con el alcance full-stack completo:
[docs/work-tickets.md](docs/work-tickets.md) §4.9.

### Ticket 3 (base de datos) — Persistencia e invariantes del registro mensual hipotecario

Corresponde a la **capa de base de datos de T03** — Registro mensual de
dividendo y saldo del crédito, full-stack en `docs/work-tickets.md` §4.3. No
es un ticket independiente: el servicio y la consulta del histórico por
período siguen siendo propiedad de T03.

**Objetivo de esta capa.** Definir el esquema de `credito_registro_mensual`
—columnas, tipos, restricciones— y la separación entre `periodo`
(mensualidad hipotecaria) y `fecha_pago_dividendo` (fecha de caja), que
`docs/data-model.md` §4.4 exige sin excepción.

**Historia relacionada.** HU01 (la misma de T03).

**Alcance de esta capa.**
- Migración Prisma de `credito_registro_mensual`: `id`, `credito_id` FK,
  `periodo DATE` (día 1 del mes), `dividendo_pagado_clp NUMERIC(14,0)`
  nulable, `fecha_pago_dividendo DATE` nulable, `saldo_pendiente_uf
  NUMERIC(12,4)` nulable, `created_at`/`updated_at`.
- `UNIQUE (credito_id, periodo)`.
- `CHECK (dividendo_pagado_clp IS NOT NULL OR saldo_pendiente_uf IS NOT NULL)`.
- `CHECK ((dividendo_pagado_clp IS NULL) = (fecha_pago_dividendo IS NULL))`: la fecha
  de pago existe si y solo si hay dividendo.
- Índice para la consulta por mes de caja: `(fecha_pago_dividendo)`.

**Criterios de aceptación** (derivados de las restricciones de
`docs/data-model.md` §4.4):
| # | Regla | Resultado esperado |
|---|---|---|
| AC1 | Ambos campos de hecho nulos | El `CHECK` rechaza la fila |
| AC2 | Dividendo sin `fecha_pago_dividendo`, o fecha sin dividendo | El `CHECK` rechaza la fila |
| AC3 | Mismo `credito_id` y `periodo` dos veces | `UNIQUE` rechaza el segundo registro |
| AC4 | Fila válida, con uno o ambos datos presentes | Se acepta |

**Entidades:** `credito_registro_mensual` únicamente.

**Componentes y capas:** `prisma/schema.prisma`, `prisma/migrations/` — nada
de `server/services`, `server/domain` ni `app/`.

**Dependencias:** T02 (`credito_hipotecario` debe existir para la FK
`credito_id`).

**Fuera de alcance:** el servicio de lectura/escritura y la consulta del
histórico (los posee T03); la API que los expone; la UI de registro mensual;
el saldo actual derivado, que no vive en el esquema.

**Estrategia de pruebas:** integración a nivel de esquema — los dos `CHECK`
y el `UNIQUE` rechazan exactamente las filas de AC1–AC3.

Ticket de origen, con el alcance full-stack completo:
[docs/work-tickets.md](docs/work-tickets.md) §4.3.

---

## 7. Pull Requests

Pendiente: no hay pull requests de este trabajo todavía. El desarrollo se versiona por
commits en `feature/entrega-2-ESRF` (ver `git log`); la evidencia de PR se añadirá
cuando se abra. Las únicas fusiones visibles en
el historial de este repositorio (`#107`, `#111`) corresponden a trabajo de
otros colaboradores sobre el repositorio base, ya revertido, y no son pull
requests de esta entrega.
