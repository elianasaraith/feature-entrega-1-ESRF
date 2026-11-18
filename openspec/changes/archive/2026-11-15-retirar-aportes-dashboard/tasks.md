## 1. Interfaz y especificación

- [x] 1.1 Renombrar la etiqueta «Flujo neto antes de aportes» a «Flujo neto» en `app/_components/resumen-mensual.tsx`, sin tocar cálculos, DTO ni contratos API
- [x] 1.2 Reflejar en el delta MODIFIED de `financial-dashboard` el nombre «flujo neto» y el retiro de aportes y T08
- [x] 1.3 Actualizar a mano el `Purpose` de `openspec/specs/financial-dashboard/spec.md` (un delta no puede modificarlo)

## 2. Verificación

- [x] 2.1 Ejecutar `openspec validate retirar-aportes-dashboard --strict` y `tsc --noEmit`
- [ ] 2.2 Revisar con `/opsx:verify` y archivar con `/opsx:archive` cuando el usuario lo decida (no se archiva automáticamente)
