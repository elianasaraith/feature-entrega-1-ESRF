## Context

T03, T06 y T07 persisten los hechos; T09 solo consulta. Servicios existentes: `movimientoService.resumenMensual`, `pagoService.listarPagos` (por contrato, usa `calcularEstadoPago`), `creditoRegistroService.ultimoSaldoRegistrado` (sin tope por mes), `rangoDelMes`, `agregarPorCategoria`, `hoyChile()`, `yearMonth`. Los servicios son fábricas `createXService(prisma)` registradas en `server/services/index.ts`; los endpoints usan `requireSession` y `toHttpResponse`. Las páginas son Server Components con `cacheComponents: true` y `<Suspense>`; los formularios ya llaman `router.refresh()`. `app/dashboard/` no existe. `aporte_capital` y `valor_uf_periodo` no existen (T08, T10).

## Goals / Non-Goals

**Goals:**
- Un único `dashboard-service` para cartera y propiedad, con regla de caja uniforme.
- Cero migraciones y cero persistencia de derivados.
- Aritmética exacta (BigInt/Decimal) y lógica fuera de React.

**Non-Goals:**
- Aportes de capital (T08), conversión UF→CLP (T10), comparación entre propiedades, proyecciones, caché.
- Refactorizar los servicios existentes; se añaden consultas propias al nuevo servicio.

## Decisions

1. **Un servicio con alcance opcional.** `dashboardService.resumenMensual({ mes, propiedadId?, hoy })` devuelve totales, actividad, pagos y saldos. Cartera = todas las propiedades; propiedad = una. La fila por propiedad del dashboard sale de la misma consulta agrupada, de modo que el total de cartera se obtiene sumando filas y la igualdad cartera = Σ propiedades se cumple por construcción. *Alternativa descartada:* dos implementaciones (divergirían, `architecture.md` §10.4).
2. **Consultas agrupadas, sin N+1.** Por mes: `abonoArriendo.findMany` filtrando por `fechaRecepcion` en el rango, con `select` de `pagoEsperado.contrato.propiedadId` (el abono no tiene `propiedad_id`); `creditoRegistroMensual` filtrando por `fechaPagoDividendo`, con `credito.propiedadId`; `movimientoFinanciero.groupBy({ by: ['propiedadId'], _sum })`. Los abonos y dividendos del mes son pocas filas y se agrupan en TypeScript con BigInt (los totales sumados por `aggregate` de Prisma no agrupan a través de relaciones de dos saltos); los movimientos se leen como filas (también alimentan la actividad reciente) y se agrupan igual, sin `groupBy`. La actividad reciente reutiliza esas mismas filas, así que no hay consultas extra. *Alternativa:* SQL crudo; solo si Prisma no basta, documentando el motivo (`architecture.md` §10.2).
3. **Estado de pagos.** Una consulta `pagoEsperado.findMany({ where: { periodo: primerDiaDelMes }, include: { abonos, contrato } })` y `calcularEstadoPago` por pago con `hoy`. Sin tocar la lógica de T06. Se muestra monto esperado, recibido, saldo y estado.
4. **Saldo por período.** Una consulta `creditoRegistroMensual.findMany({ where: { saldoPendienteUf: { not: null }, periodo: { lt: primerDiaDelMesSiguiente } }, orderBy: [{ periodo: 'desc' }] })` y selección en memoria del primer registro por crédito mediante una función pura (`seleccionarSaldoAplicable`). No se modifica `ultimoSaldoRegistrado`. Sin registro → `null` y la UI dice «sin saldo registrado».
5. **Dominio puro `server/domain/dashboard.ts`:** `flujoNeto`, suma de egresos, ordenación de la actividad (fecha desc, desempate por origen y id) y `formatearClp`/`formatearUf` (basado en cadenas, sin `Number`). Montos como texto en los DTO, sumados en BigInt.
6. **Endpoints.** `GET /api/dashboard` y `GET /api/propiedades/[id]/resumen-mensual`, con `requireSession`, `yearMonth` para validar (400), `asegurarPropiedad` (404) y `hoyChile()`. Sin `mes` se usa el mes de hoy.
7. **UI.** `app/dashboard/page.tsx` y `app/propiedades/[id]/page.tsx` como Server Components que llaman al servicio directamente (no al endpoint HTTP). Selector de mes con `<input type="month">` en un formulario GET (`?mes=`), siguiendo `movimientos-panel`. Componentes de presentación compartidos (`ResumenMensual`, `ActividadReciente`) que solo formatean. Enlaces de actividad: abono → `/propiedades/{id}/contratos/{cid}/pagos`, dividendo → `/propiedades/{id}/credito/registro-mensual`, movimiento → `/propiedades/{id}/movimientos?mes=`.
8. **Vigencia de datos.** Los datos se leen en cada petición (dinámico). Los formularios actuales ya llaman `router.refresh()`; para volver a otras vistas sin recarga se verifica manualmente que el Router Cache no sirva datos viejos y, si ocurre, se añade `router.refresh()` o `revalidatePath` mínimo en las mutaciones afectadas. No se añade caché de aplicación.
9. **Supuestos asumidos (no confirmados explícitamente):** el orden por propiedad en el dashboard es el de `propiedadService` (estable); el desempate de la actividad es origen y luego id; el enlace del dashboard se agrega a `app/page.tsx`.

## Risks / Trade-offs

- [Dobles saltos de relación complican la agregación en BD] → agrupar en TypeScript sobre pocas filas del mes, con BigInt; documentarlo junto al código.
- [Router Cache sirve datos viejos al volver] → prueba manual explícita y ajuste mínimo si falla.
- [Confusión mes de caja vs contractual] → nombres explícitos en los DTO (`pagosEsperadosDelMes` vs totales de caja) y pruebas de desfase.
- [UI cargando totales con ceros que parecen datos] → saldo sin registro es `null`; aportes y CLP de UF no se renderizan.
- [Crecimiento del servicio] → mantenerlo en lectura pura; sin refactorizar servicios existentes.

## Open Questions

- Ninguna bloqueante. T08 y T10 añadirán después sus bloques (aportes y saldo en CLP) sobre el mismo servicio.
