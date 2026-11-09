## 1. Base de datos

- [x] 1.1 Agregar el modelo `AbonoArriendo` (`abono_arriendo`) a `prisma/schema.prisma` y la relación en `PagoEsperado`, con FK `onDelete: Restrict` e índices por `pago_esperado_id` y `fecha_recepcion`
- [x] 1.2 Crear la migración con `CHECK (monto_clp > 0)` y verificar que aplica sobre la base de pruebas
- [x] 1.3 NO APLICABLE (decisión del usuario, no implementada): el seed actual no crea contratos ni pagos; ampliarlo queda fuera de T06

## 2. Dominio

- [x] 2.1 Crear `server/domain/pago-estado.ts` con `calcularEstadoPago` (recibido, saldo, estado, fecha de completitud, calificaciones), fechas como `YYYY-MM-DD` y montos `bigint`
- [x] 2.2 Pruebas unitarias `tests/pagos/pago-estado.test.ts`: tabla de precedencia de los cuatro estados, fecha esperada igual a hoy, sobrepago, completitud con varios abonos y mismo día, y casos CL11–CL14

## 3. Esquemas y servicio

- [x] 3.1 Crear `server/schemas/abono.ts` (Zod: monto decimal, fecha `YYYY-MM-DD`, medio opcional) con errores de formato → 400
- [x] 3.2 Crear `server/services/pago-service.ts` con el resolvedor de pertenencia propiedad → contrato → pago → abono (404 si no coincide) y registrarlo en `server/services/index.ts`
- [x] 3.3 Implementar `listarPagos` (sin escritura, estado derivado con `hoy`) y `listarAbonos` (orden por fecha, `createdAt`, `id`)
- [x] 3.4 Implementar `crearAbono`, `editarAbono` y `eliminarAbono` con bloqueo por propiedad, monto <= 0 y fecha futura → `UnprocessableError` (422), y borrado físico
- [x] 3.5 Pruebas de integración `tests/pagos/pago-service.integration.test.ts`: alta, edición, eliminación, pertenencia cruzada, pago parcial, sobrepago, cambio de estado al editar o eliminar, que el alta no sincroniza y reajustes CL12–CL14 conservando abonos

## 4. API

- [x] 4.1 `GET .../contratos/[contratoId]/pagos-esperados/route.ts` (listado con estado)
- [x] 4.2 `GET` y `POST .../pagos-esperados/[pagoId]/abonos/route.ts` (201 al crear)
- [x] 4.3 `PUT` y `DELETE .../abonos/[abonoId]/route.ts` (204 al eliminar), todas con `requireSession` y `toHttpResponse`
- [x] 4.4 Pruebas de esquema y de mapeo de errores a HTTP (`toHttpResponse`) para 400, 404 y 422, y prueba del 401 sin sesión de las rutas nuevas en `tests/auth/proxy.test.ts`; los Route Handlers no se invocan directamente porque `requireSession` solo funciona en el runtime de Next.js

## 5. Interfaz

- [x] 5.1 Página `app/propiedades/[id]/contratos/[contratoId]/pagos/page.tsx` que consulta el servicio y muestra pagos con estado, recibido, saldo y calificaciones
- [x] 5.2 Panel cliente con formulario de registro, edición de abono y eliminación con confirmación; muestra errores 400/422
- [x] 5.3 Enlazar la página desde la lista de contratos y desde la página de montos (donde está el botón de sincronizar)
- [x] 5.4 Revisión manual del flujo en el navegador: registrar, editar, eliminar y ver el cambio de estado

## 6. Documentación y cierre

- [x] 6.1 Actualizar `docs/work-tickets.md` T06 con «Estado de implementación» y `docs/architecture.md` (ruta anidada en §19 y capacidad «Pagos de arriendo»)
- [x] 6.2 Actualizar `readme.md` (endpoint y estado de T06) y registrar el trabajo en `prompts.md`
- [x] 6.3 Ejecutar `npm test`, TypeScript y lint sin errores, y registrar el resultado
