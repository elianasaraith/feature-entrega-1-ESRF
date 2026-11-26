## 1. Base de datos

- [x] 1.1 Añadir a `prisma/schema.prisma` el enum `CategoriaMovimiento` (`@@map("categoria_movimiento")`, 7 valores, sin `DIVIDENDO`) y el modelo `MovimientoFinanciero` (`@@map("movimiento_financiero")`, FK a `Propiedad` con `onDelete: Restrict`, `@@index([propiedadId, fecha])`), más la relación inversa en `Propiedad`
- [x] 1.2 Generar con `prisma migrate dev --create-only --name add_movimiento_financiero`, añadir `CHECK ("monto_clp" > 0)` y revisar el SQL antes de aplicarlo
- [x] 1.3 Aplicar la migración a la base de desarrollo y a la de pruebas, y regenerar el cliente Prisma

## 2. Dominio y validación

- [x] 2.1 Crear `server/domain/movimiento-agregacion.ts` con `CATEGORIAS_MOVIMIENTO`, `agregarPorCategoria` (suma `bigint`, siempre las 7 claves) y `rangoDelMes` (`desde` inclusivo, `hasta` exclusivo)
- [x] 2.2 Crear `server/schemas/movimiento.ts`: `movimientoInputSchema` (fecha real, `z.enum` de las 7 categorías, monto entero en texto de hasta 14 dígitos, `descripcion` con `optionalText`) y el esquema del parámetro `mes` (`yearMonth` de `shared.ts`)

## 3. Servicio y API

- [x] 3.1 Crear `server/services/movimiento-service.ts` con `crear`/`editar` (reglas 422: monto > 0, fecha ≤ `hoy` inyectado), `obtener`/`eliminar` (búsqueda por `{ id, propiedadId }`, id no UUID → 404), `listar` (filtro `mes`, orden `fecha desc, createdAt desc`, total y desglose vía `agregarPorCategoria`) y `resumenMensual`; DTO con fechas ISO y montos como texto
- [x] 3.2 Registrar `movimientoService` en `server/services/index.ts`
- [x] 3.3 Crear `app/api/propiedades/[id]/movimientos/route.ts` (GET con `?mes`, POST → 201) con `requireSession` y `toHttpResponse`
- [x] 3.4 Crear `app/api/propiedades/[id]/movimientos/[movId]/route.ts` (GET, PUT con `hoyChile()`, DELETE → 204)

## 4. Interfaz

- [x] 4.1 Crear `app/propiedades/[id]/movimientos/page.tsx` (server component): lee `?mes` (inválido o ausente → mes actual de `hoyChile()`), llama a `movimientoService.listar` y maneja `NotFoundError` con `notFound()`
- [x] 4.2 Crear `app/propiedades/[id]/movimientos/movimientos-panel.tsx` (client): filtro de mes, total y desglose recibidos del servidor, tabla, formulario de alta/edición con errores por campo y eliminación con `window.confirm`, siguiendo `pagos-panel.tsx`
- [x] 4.3 Añadir el enlace "Movimientos financieros" en `app/propiedades/[id]/page.tsx`

## 5. Pruebas

- [x] 5.1 `tests/movimientos/movimiento-schema.test.ts`: formato válido, descripción opcional, rechazo de `DIVIDENDO`, categoría desconocida, monto no entero, fecha inexistente e ignorado del campo `tipo`; `0`/negativos pasan el formato
- [x] 5.2 `tests/movimientos/movimiento-agregacion.test.ts`: desglose por categoría, lista vacía con 7 claves en `"0"`, suma exacta de montos grandes, `rangoDelMes` (diciembre → enero siguiente, febrero bisiesto)
- [x] 5.3 `tests/movimientos/movimiento-service.integration.test.ts` (patrón de `pago-service.integration.test.ts`, limpieza por id): CRUD completo; 422 por monto ≤ 0 y fecha futura; fecha de hoy aceptada; 404 por propiedad inexistente, movimiento de otra propiedad y id no UUID; filtro mensual con extremos 1 y último día; aislamiento entre propiedades; `GASTO_COMUN` en mes sin contrato; `resumenMensual`; el `CHECK` rechaza monto ≤ 0 en la base
- [x] 5.4 Prueba de no duplicación: con un dividendo en `credito_registro_mensual` y un movimiento en el mismo mes, el listado y el resumen de movimientos incluyen solo el movimiento
- [x] 5.5 Ejecutar `npm test`, `npm run lint` y `npm run build`, y corregir lo que falle

## 6. Documentación

- [x] 6.1 Corregir en `CLAUDE.md` la línea de movimientos financieros: listar solo las 7 categorías manuales y aclarar que el dividendo se registra en el registro mensual del crédito (`docs/data-model.md` §4.10, D1)
- [x] 6.2 Registrar el uso de IA de T07 en `prompts.md`, si corresponde según las reglas del proyecto
