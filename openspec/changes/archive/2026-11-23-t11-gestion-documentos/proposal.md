## Why

T11 es el único requisito del MVP sin implementar: guardar y recuperar los documentos de una propiedad (escrituras, contrato hipotecario, contratos de arriendo, comprobantes, facturas) sin binarios en PostgreSQL (`docs/product.md` §6.6, `docs/data-model.md` §4.13, `docs/architecture.md` §13).

## What Changes

- Nueva tabla `documento` (metadata) y enum `tipo_documento`, con migración nueva (no se aplica a ninguna base en este change).
- Puerto `AlmacenDocumentos` (URL firmada de subida, URL firmada de lectura, borrado, comprobación del objeto) con una implementación compatible con S3/Cloudflare R2 que firma con SigV4 usando solo `node:crypto` (sin dependencias nuevas) y un doble en memoria para pruebas.
- Subida directa navegador → bucket privado mediante URL firmada; el servidor solo emite URLs y registra metadata tras comprobar que el objeto existe y su tamaño coincide.
- API protegida: solicitar URL de subida, registrar documento, listar, obtener URL de lectura y eliminar.
- Vínculos: siempre a la propiedad; opcionalmente a crédito, contrato, abono o movimiento (excluyentes; deben pertenecer a la propiedad).
- Validación de formato y tamaño; errores de almacenamiento traducidos a 503/422; configuración solo por variables de entorno del servidor.
- Interfaz mínima `/propiedades/{id}/documentos`.

## Capabilities

### New Capabilities
- `document-management`: metadata y archivos de documentos de una propiedad con almacenamiento privado S3-compatible.

### Modified Capabilities
<!-- ninguna -->

## Impact

`prisma/schema.prisma` y nueva migración, `server/storage/*`, `server/services/documento-service.ts`, `server/schemas/documento.ts`, `server/errors.ts` (503), rutas bajo `app/api/propiedades/[id]/documentos`, página y componente cliente de documentos, enlace en el detalle de propiedad, pruebas. Sin dependencias nuevas. Requiere después, fuera del código: crear el bucket privado, sus credenciales y la regla CORS (ver design).
