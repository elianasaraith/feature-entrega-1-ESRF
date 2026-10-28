## Why

T04 ("Gestión del contrato de arriendo") abre HU02: hoy no hay dónde registrar el contrato de una propiedad con su arrendatario, vigencia, garantía y día esperado de pago, ni consultar contratos sucesivos. Sin contratos, T05 (reajustes y pagos esperados) y T06 (abonos y estado) no tienen `contrato_id` al que anclarse, y el dashboard (T09) no tiene ingresos por arriendo que mostrar.

## What Changes

- Nuevas tablas `arrendatario`, `contrato_arriendo` y `contrato_monto` (modelos Prisma `Arrendatario`, `ContratoArriendo`, `ContratoMonto`), con CHECK y `UNIQUE` en una migración SQL incremental (solo se escribe; no se aplica en esta propuesta).
- **Monto inicial opcional en el alta.** Si el alta informa `montoMensualClp`, se crea en la misma transacción la primera fila de `contrato_monto` (`vigente_desde_periodo` = mes de `fecha_inicio`, motivo «monto inicial»). Esa fila **no se sobrescribe** al editar el contrato.
- **Invariante relajada hasta T05.** `data-model.md` §4.7 dice que todo contrato tiene al menos una fila en `contrato_monto`; con monto opcional un contrato puede existir sin fila hasta T05. Se documenta como *propuesta a validar*.
- API REST (Route Handlers, sin `DELETE`):
  - `GET/POST /api/propiedades/[id]/contratos` (historial de contratos de la propiedad; alta, 201 / 409 por solape).
  - `GET/PUT /api/propiedades/[id]/contratos/[contratoId]` (consulta; edición, que puede acortar `fecha_termino`).
  - `GET/POST /api/arrendatarios` (listado y alta de arrendatarios reutilizables).
- El alta de contrato referencia un arrendatario existente (`arrendatarioId`) o lo crea en línea (`arrendatario` anidado, misma transacción).
- **Solape inclusivo** de `[fecha_inicio, fecha_termino]` entre contratos de la misma propiedad, como validación de aplicación. POST y PUT toman el mismo **bloqueo por propiedad** (`pg_advisory_xact_lock` dentro de `$transaction`) para serializar operaciones simultáneas.
- **Vigencia derivada** de las fechas (`FUTURO` · `VIGENTE` · `FINALIZADO`) con fecha de referencia inyectada; sin columna `estado`. `fecha_termino` es obligatoria (NOT NULL).
- La garantía es solo información contractual (`garantia_clp`); no genera ingreso ni movimiento.
- Páginas bajo `/propiedades/[id]/contratos` (listado, alta, edición) y enlace desde el detalle de la propiedad.
- Pruebas: unitarias (vigencia, esquemas) e integración (solape, concurrencia, autorización, preservación del monto inicial) solo contra `TEST_DATABASE_URL` verificada como distinta de `DATABASE_URL` y `DIRECT_URL`.

## Capabilities

### New Capabilities
- `lease-management`: alta, edición y consulta de arrendatarios y contratos de arriendo por propiedad; monto inicial opcional en `contrato_monto`; vigencia derivada; no solapamiento inclusivo con bloqueo por propiedad; garantía como información contractual; protección por sesión y verificación del arrendatario.

### Modified Capabilities
<!-- Ninguna: no cambian requisitos de capabilities existentes. El enlace «Contratos» en el detalle de la propiedad es un detalle de interfaz. -->

## Cumplimiento de criterios de aceptación del ticket

| AC | Estado en T04 |
|---|---|
| AC1 (E1) Alta con arrendatario, fechas, monto, garantía y día esperado → vigente en el rango | Implementado; el monto es **opcional** (inicial en `contrato_monto`) |
| AC2 (E16) Contratos sucesivos con otro arrendatario constan ambos | Implementado completamente |
| AC3 (E17) La garantía no es ingreso del mes | Implementado completamente (sin movimientos ni ingresos) |

## Autorización: interpretación del requisito «arrendatario respecto al usuario autenticado»

El MVP es de usuario único y ninguna entidad de dominio lleva `usuario_id` (`data-model.md` §4.1). Por tanto, la «propiedad» del arrendatario se garantiza así: (1) todos los handlers exigen sesión (`requireSession()`, 401 sin ella); (2) un `arrendatarioId` solo se asocia si existe (404 si no existe o no es UUID). **No se añade `usuario_id`** a `arrendatario`. Esto es una *propuesta a validar*; si se quisiera propiedad por usuario real habría que cambiar el modelo, lo cual contradice la decisión vigente.

## Impact

- Código nuevo: migración `add_arrendatario_contrato_arriendo`, `server/schemas/{arrendatario,contrato}.ts`, `server/domain/contrato-vigencia.ts`, `server/services/{arrendatario,contrato}-service.ts`, `app/api/propiedades/[id]/contratos/`, `app/api/arrendatarios/`, `app/propiedades/[id]/contratos/`, `tests/contratos/`.
- Modificados: `prisma/schema.prisma` (3 modelos y relación en `Propiedad`), `server/services/index.ts`, `server/errors.ts` solo si hiciera falta (no previsto), `app/propiedades/[id]/page.tsx`, `tests/auth/proxy.test.ts`.
- Documentación: `docs/work-tickets.md` T04 y `docs/data-model.md` §4.7/§5.1 (monto inicial opcional e invariante relajada hasta T05), `readme.md` si refleja T04/contratos, y `prompts.md`.
- Sin dependencias nuevas. No se modifica `.env`. Migraciones: solo escritas; aplicarlas (también a la BD de pruebas) requiere aprobación explícita del usuario en la fase apply.
- Fuera de alcance: reajustes y nuevas filas de `contrato_monto` (T05); `pago_esperado` (T05); abonos y estado de pago (T06); movimientos financieros y aportes (T07, T08); dashboard (T09); documentos del contrato (T11); gestión de la garantía (devolución, retención); `DELETE`; seeds con datos reales.
