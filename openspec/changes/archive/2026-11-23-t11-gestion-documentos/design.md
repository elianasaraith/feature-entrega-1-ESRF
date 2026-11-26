## Context

Decisiones ya confirmadas en `docs/`: PostgreSQL solo metadata; object storage compatible con S3, bucket privado, URLs firmadas de vida corta, subida directa del navegador y puerto `AlmacenDocumentos`. El proveedor concreto era «propuesta a validar». Vercel no ofrece filesystem persistente, por lo que no se usa disco local.

## Goals / Non-Goals

**Goals:** subir, listar, descargar y eliminar documentos de una propiedad con la seguridad y consistencia mínimas, probado sin servicios externos.
**Non-Goals:** OCR o extracción con IA, edición de documentos, versionado, reconciliación automática de objetos huérfanos, crear cuentas o buckets.

## Decisions

- **Proveedor:** interfaz S3; **Cloudflare R2 confirmado como objetivo** (path-style, región `auto`, endpoint `https://<cuenta>.r2.cloudflarestorage.com`; las URLs prefirmadas solo funcionan en ese dominio, no en un dominio personalizado). Válido también para AWS S3. Formatos PDF/JPEG/PNG/WebP y máximo 20 MB confirmados.
- **Sin dependencias nuevas:** firma SigV4 por query string con `node:crypto` en `server/storage/s3-sigv4.ts`, verificada con el vector de prueba publicado por AWS. Se firman PUT (subida), GET (lectura), HEAD (comprobación) y DELETE, y el servidor ejecuta HEAD/DELETE con `fetch` sobre URLs firmadas. Alternativa descartada: `@aws-sdk/client-s3` (varias dependencias grandes; requiere autorización).
- **Configuración:** `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, solo servidor, nunca `NEXT_PUBLIC_*`. Sin configuración, las operaciones que necesitan el almacenamiento responden 503 con mensaje explícito; el listado sigue funcionando.
- **Flujo de subida:** (1) `POST .../documentos/subida` valida tipo, formato y tamaño, valida el vínculo y devuelve `storageKey` (`propiedades/{propiedadId}/{uuid}`) y una URL PUT firmada de 5 min que incluye `Content-Type` y `Content-Length` firmados; (2) el navegador sube al bucket; (3) `POST .../documentos` comprueba que el `storageKey` pertenece a esa propiedad, que el objeto existe y que su tamaño coincide con el declarado, y entonces inserta la fila.
- **Lectura:** `GET .../documentos/{docId}` devuelve una URL GET firmada de 5 min con `Content-Disposition` con el nombre original. Nunca hay URLs públicas ni redirecciones permanentes.
- **Eliminación:** se borra primero la fila y luego el objeto; si el borrado del objeto falla se registra el error y queda un objeto huérfano (aceptado por `architecture.md` §13.3), sin dejar metadata que apunte a un archivo inexistente.
- **Inconsistencias:** si el registro no encuentra el objeto o no cumple lo autorizado → 422, el objeto inválido se descarta y no se inserta; si la inserción choca con `storage_key` único → 409; si el almacenamiento falla o no responde → 503.
- **Formatos y tamaño (confirmados):** PDF, JPEG, PNG y WebP; máximo 20 MB; definidos en un único módulo (`server/domain/documento.ts`).
- **Autorización de subida (revisión de seguridad):** la solicitud devuelve un `tokenSubida` (HMAC-SHA256 con `S3_SECRET_ACCESS_KEY`, solo servidor, sobre clave + tipo + tamaño + vencimiento de 10 min). El registro lo exige: el cliente no puede registrar una clave que el servidor no emitió ni cambiar lo autorizado.
- **Validación efectiva del archivo:** al registrar, el servidor inspecciona el objeto (HEAD: tamaño y `Content-Type`) y lee sus primeros 12 bytes (GET con `Range`) para comprobar la firma del formato. Un objeto que no cumple se borra del almacenamiento. El `Content-Length` y el `Content-Type` firmados en la URL de subida impiden subir otra cosa que lo autorizado.
- **Datos:** `documento` según `data-model.md` §4.13 con `CHECK` de exclusividad de los cuatro vínculos y `tamano_bytes > 0`; FK `ON DELETE RESTRICT`. Índice por `propiedad_id`.
- **Vínculos:** el crédito, contrato, abono o movimiento debe pertenecer a la propiedad (abono: abono → pago esperado → contrato → propiedad), validado en la aplicación.
- **UI mínima:** lista con descarga y eliminación (con confirmación) y formulario con archivo, tipo y vínculo (propiedad, crédito o contrato). La API admite además abono y movimiento.

## Risks / Trade-offs

- [Firma SigV4 propia] → acotada (solo query-string presign), verificada con el vector oficial de AWS; no probada contra R2 real (queda para la validación local con el bucket real).
- [El tamaño solo se verifica tras la subida] → el `Content-Length` firmado impide subir un tamaño distinto del declarado y el registro lo vuelve a comprobar.
- [Objetos huérfanos] → aceptados, sin reconciliación (documentado).
- [CORS del bucket] → debe permitir `PUT` desde el origen de la app; es configuración externa pendiente.

## Pendiente fuera del código (requiere decisión/autorización del usuario)

Elegir proveedor y crear el bucket privado, sus credenciales y la regla CORS; definir las variables de entorno en Vercel; aplicar la migración a Neon.
