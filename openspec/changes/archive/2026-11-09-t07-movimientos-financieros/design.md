## Context

T07 implementa `movimiento_financiero` (`docs/data-model.md` §4.10), ya diseñado en `docs/`: egreso manual por propiedad, `monto_clp NUMERIC(14,0) > 0`, `fecha` de caja, ENUM de 7 categorías sin `DIVIDENDO`, sin columna `tipo` (D1). Hoy no existe modelo Prisma, migración, servicio ni UI.

Patrones que se reutilizan tal cual (sin refactorizar):
- **T06 (abonos)**: `server/schemas/abono.ts` (formato → 400; monto ≤ 0 y fecha futura se dejan al servicio → 422), `pago-service.ts` (`validarAbono(input, hoy)`, `hoy` inyectado desde `hoyChile()`), Route Handlers con `requireSession` + `toHttpResponse`, DELETE físico → 204, `pagos-panel.tsx` (formulario cliente, `window.confirm`, `router.refresh()`).
- **T03 (registro mensual)**: `asegurarPropiedad` (id no UUID o inexistente → 404), `YYYY-MM` ↔ día 1 (`periodoADate`), DTO con montos como texto (Decimal nunca pasa por `Number`).
- **Tests**: unitarios con `node:test`; integración con `resolveTestDatabase()` (se omiten sin `TEST_DATABASE_URL`) y limpieza por id.

Consumidores futuros: T08 (FK opcional `aporte_capital.movimiento_financiero_id`) y T09 (egresos del mes = suma de movimientos + dividendos de T03).

## Goals / Non-Goals

**Goals:**
- CRUD completo de egresos manuales por propiedad, con validación de monto y fecha.
- Agregación mensual por categoría como función pura, reutilizable por T09.
- Que sea imposible duplicar dividendos (T03) o ingresos (T06) por construcción del modelo.

**Non-Goals:**
- Ingresos, dividendos, aportes de capital y su vínculo (T08), adjuntos (T11) y dashboard (T09).
- Paginación, búsqueda, exportación, auditoría o borrado lógico.
- Conversión UF: los movimientos son siempre CLP.
- Cambios a `docs/` (ya definen el modelo) y refactorizaciones de código existente.

## Decisions

**D1. Rutas anidadas bajo la propiedad.** `GET|POST /api/propiedades/[id]/movimientos` y `GET|PUT|DELETE /api/propiedades/[id]/movimientos/[movId]`. El movimiento se busca con `{ id: movId, propiedadId }`; si no coincide → 404, igual que `asegurarAbono`. *Alternativa*: ruta plana `/api/movimientos/[id]`; descartada por romper la convención y por perder la verificación de pertenencia gratis.

**D2. Validación en dos capas, como T06.** `server/schemas/movimiento.ts` (Zod) valida formato → 400: `fecha` calendario real `YYYY-MM-DD` (`isRealCalendarDate`), `categoria` como `z.enum` de las 7 (rechaza `DIVIDENDO`), `descripcion` con `optionalText`, `montoClp` entero en texto con signo opcional y máximo 14 dígitos (mismo esquema de monto que `abono.ts`). El servicio aplica reglas de negocio → 422: `monto > 0` y `fecha <= hoy`. `hoy` llega por parámetro desde `hoyChile()` (el servicio nunca lee el reloj); la fecha de hoy se acepta. Zod elimina claves desconocidas, por lo que un `tipo` enviado se ignora. *Alternativa*: duplicar `montoClp` en `shared.ts`; descartada para no tocar código existente (la repetición es de ~8 líneas).

**D3. Edición con PUT de cuerpo completo.** Reemplaza `fecha`, `categoria`, `montoClp`, `descripcion`; la propiedad no es editable. Mismas validaciones que el alta. Sin PATCH.

**D4. Borrado físico, sin auditoría** (`DELETE` → 204), con `window.confirm` en la UI. El FK futuro de T08 será `ON DELETE SET NULL`/`RESTRICT` según decida T08; T07 no lo anticipa.

**D5. Modelo Prisma y migración.** `enum CategoriaMovimiento @@map("categoria_movimiento")` y `model MovimientoFinanciero @@map("movimiento_financiero")` con `montoClp Decimal @db.Decimal(14,0)`, `fecha @db.Date`, `descripcion String?`, timestamps `@db.Timestamptz(6)`, FK a `Propiedad` con `onDelete: Restrict`, `@@index([propiedadId, fecha])`. La migración `20261109120000_add_movimiento_financiero` añade `CHECK ("monto_clp" > 0)` a mano, como las migraciones anteriores (Prisma 6 no lo expresa). Se genera con `prisma migrate dev --create-only`, se revisa el SQL y recién entonces se aplica.

**D6. Agregación pura en `server/domain/movimiento-agregacion.ts`.**
- `CATEGORIAS_MOVIMIENTO`: lista de las 7 (fuente única para Zod y UI).
- `agregarPorCategoria(movs: { categoria; montoClp: string }[]): { totalClp: string; porCategoria: Record<Categoria, string> }`. Suma con `bigint`, siempre devuelve las 7 claves (`"0"` si vacías). Sin reloj ni BD.
- `rangoDelMes(mes: "YYYY-MM"): { desde: string; hasta: string }` con `hasta` exclusivo (día 1 del mes siguiente), para filtrar con `fecha >= desde AND fecha < hasta` sin aritmética de zonas horarias.
*Alternativa*: `SUM ... GROUP BY` en SQL; descartada: la regla de agregación debe vivir en dominio testeable y ser la misma que use T09, y el volumen (decenas de filas por mes) no justifica optimizar.

**D7. Contrato del servicio.** `createMovimientoService(prisma)`, registrado en `server/services/index.ts`:
- `listar(propiedadId, { mes? }) → { mes: string | null, movimientos: MovimientoDto[], totalClp, porCategoria }`. Orden `fecha desc, createdAt desc`. El resumen se calcula con `agregarPorCategoria` sobre las filas devueltas; sin `mes` cubre todo el historial.
- `resumenMensual(propiedadId, mes) → { mes, totalClp, porCategoria }`: punto de entrada para T09.
- `obtener`, `crear`, `editar`, `eliminar`; `crear`/`editar` reciben `hoy`.
DTO: `{ id, propiedadId, fecha, categoria, montoClp, descripcion, createdAt, updatedAt }` con fechas ISO `YYYY-MM-DD` y montos como texto.

**D8. UI cliente mínima.** `app/propiedades/[id]/movimientos/page.tsx` (server component) lee `?mes=YYYY-MM` (por defecto `hoyChile().slice(0, 7)`; un valor inválido cae al mes actual), llama a `movimientoService.listar` y pasa los datos a `movimientos-panel.tsx` (client): filtro de mes (`<input type="month">` que navega con `router.push`), total y desglose recibidos ya calculados, tabla, formulario alta/edición en línea y eliminación con `window.confirm`. Mismos estilos Tailwind que `pagos-panel.tsx`. Enlace desde `app/propiedades/[id]/page.tsx`. *Sin cálculo financiero en componentes.*

**D9. Corrección de `CLAUDE.md`.** La línea "Movimientos financieros por propiedad: dividendos, reparaciones, …" pasa a listar solo las 7 categorías manuales y aclara que el dividendo vive en el registro mensual del crédito. `docs/data-model.md` es la fuente de verdad y no cambia.

## Risks / Trade-offs

- **[Validación 422 vs 400 distinta del texto "rechazar"]** → se sigue exactamente la convención de T06 (formato 400, regla de negocio 422); los escenarios del spec lo fijan.
- **[Fecha "hoy" en zona Chile frente a UTC del servidor]** → el único reloj es `hoyChile()`, inyectado; los tests pasan `hoy` fijo.
- **[Resumen de `listar` sin filtro cubre todo el historial]** → el total sin mes no es un valor de dashboard; la UI siempre filtra por mes y T09 usará `resumenMensual`.
- **[Borrar un movimiento que T08 vincule a un aporte]** → T08 aún no existe; su FK define el comportamiento. T07 no lo bloquea.
- **[Edición cambia el mes de caja de un egreso]** → comportamiento esperado: el mes se deriva siempre de `fecha`; nada se persiste agregado.
- **[Migración con CHECK manual]** → se revisa el SQL generado antes de aplicar y se prueba el rechazo de monto ≤ 0 en la prueba de integración.

## Migration Plan

1. `prisma migrate dev --create-only --name add_movimiento_financiero`, agregar el `CHECK` y revisar el SQL.
2. Aplicar a la base de desarrollo y regenerar el cliente; aplicar a la base de pruebas.
3. Despliegue: `prisma migrate deploy` (tabla nueva, sin datos previos ni cambios en tablas existentes).
4. Rollback: revertir el commit y eliminar la tabla y el enum en una migración posterior; no hay datos de otros módulos que dependan de ella.

## Open Questions

Ninguna bloqueante. Supuestos registrados: fecha de hoy permitida y futura rechazada (decisión del usuario); CRUD completo (decisión del usuario); el comportamiento ante borrado con aportes vinculados lo define T08.
