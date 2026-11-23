## 1. Dominio y servicio

- [x] 1.1 `pagosQueCambian` (función pura) en `server/domain/contrato-monto.ts`
- [x] 1.2 Esquema `montoCorregirSchema` y servicio `corregirMonto` / `eliminarMonto` con bloqueo por abonos, 404 y 422

## 2. API e interfaz

- [x] 2.1 Ruta `montos/[montoId]` con PUT y DELETE protegidos
- [x] 2.2 Acciones «Corregir» y «Eliminar» en `montos-panel.tsx`

## 3. Protección de registrarMonto

- [x] 3.1 `registrarMonto` rechaza con 422, sin cambios parciales, el reajuste que cambiaría pagos con abonos; no bloquea los que no cambian
- [x] 3.2 Pruebas unitarias (bloqueado, permitido sin cambio de monto, períodos anteriores) y de integración de concurrencia abono/reajuste (omitida sin `TEST_DATABASE_URL`)

## 4. Pruebas y verificación

- [x] 4.1 Pruebas unitarias de `pagosQueCambian` y del servicio con doble en memoria (permitidos y bloqueados)
- [x] 4.2 Prueba de integración con PostgreSQL de pruebas (se omite sin `TEST_DATABASE_URL`)
- [x] 4.3 tsc, ESLint, suite y `openspec validate gestion-montos-arriendo --strict`
