## 1. Servicio y API

- [x] 1.1 `arrendatarioService.obtener` y `actualizar` (404, 409 por RUT, solo cuatro campos)
- [x] 1.2 Ruta `app/api/arrendatarios/[id]/route.ts` con GET y PUT protegidos, sin DELETE

## 2. Interfaz

- [x] 2.1 Página y formulario de edición bajo el contrato y enlace «Editar arrendatario» en la lista de contratos

## 3. Pruebas y verificación

- [x] 3.1 Pruebas de servicio (doble en memoria): actualiza campos, conserva id, 404, 409, vacíos a null
- [x] 3.2 Pruebas de integración con PostgreSQL de pruebas (se omiten sin `TEST_DATABASE_URL`): contratos intactos tras editar, RUT duplicado
- [x] 3.3 tsc, ESLint, suite y `openspec validate edicion-arrendatarios --strict`
