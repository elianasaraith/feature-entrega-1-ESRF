## Context

`credito_hipotecario` guarda condiciones contractuales en UF. El valor de compra de la propiedad (`valor_compra_monto` + `valor_compra_moneda`, UF o CLP) ya existe. El pie es un dato declarado por el propietario; el banco puede financiar un porcentaje distinto del complemento.

## Goals / Non-Goals

**Goals:** registrar `porcentaje_pie` opcional con rango estricto; mostrar porcentaje, monto estimado y barra; no alterar nada existente.

**Non-Goals:** derivar el pie del monto original; calcular el porcentaje financiado; tocar dividendos, saldos, UF, pagos, dashboard; contabilizar el pie como egreso.

## Decisions

1. **Columna `porcentaje_pie NUMERIC(5,2) NULL` + `CHECK BETWEEN 0 AND 100`.** Sigue el patrón de los demás CHECK del crédito (SQL en la migración). `NULL` y `0` son valores distintos en toda la cadena. *Alternativa descartada:* `DEFAULT 0` — confundiría «no informado» con «0 %».
2. **Migración solo `ADD COLUMN` + `ADD CONSTRAINT`**, sin `DEFAULT` ni `UPDATE`: no destructiva y sin reescritura de datos. `ADD CONSTRAINT` valida filas existentes, todas `NULL` (un CHECK con NULL no se viola).
3. **Validación Zod** con `nonNegativeDecimal(3, 2)` más tope ≤ 100 comparado sobre el texto (sin `Number`), con `optionalDecimal` como los demás opcionales: vacío/`null`/ausente → `null`. Mensajes y forma de error por campo iguales a los existentes.
4. **PUT es de cuerpo completo** (convención vigente de `credito`): omitir `porcentajePie` en un PUT lo deja en `null`, igual que `numeroCredito` o `segurosUf`. En POST, omitirlo es compatible con consumidores previos. Se documenta en la spec.
5. **Monto estimado en servidor, función pura** `calcularPieEstimado(valorCompraMonto, moneda, porcentajePie)` en `server/domain/credito-pie.ts`, con `Prisma.Decimal` (precisión 40, como `server/domain/uf.ts`). Devuelve monto en la moneda de la propiedad (CLP: entero, UF: 4 decimales, redondeo half-up solo al final) y `restoPorcentaje = 100 − pie`. `obtenerConEquivalentes` lo adjunta como `pieEstimado: {montoEstimado, moneda, restoPorcentaje} | null`; es `null` si `porcentajePie` es `null`. El servicio ya valida la propiedad; se amplía a leer su valor de compra con un `findUnique`, sin tocar `asegurarPropiedad`.
6. **Presentación:** el componente solo formatea strings con `clp`/`uf` de `app/_lib/format.ts` y dibuja la barra con anchos `%` recibidos como texto. Barra de dos segmentos «Pie» y «Resto del valor de compra» (rotulado así, no «financiado»), con tokens del sistema de diseño (`bg-brand`, `bg-line`), `role="img"` y `aria-label`. Sin dependencias nuevas.
7. **Porcentaje mostrado** con `formatearUf` existente (coma decimal, sin ceros finales) + « %».

## Risks / Trade-offs

- El pie declarado puede no coincidir con `monto_original_uf` ni con lo financiado: no se valida ni se advierte (sin reglas cruzadas inventadas); la barra lo aclara con un texto.
- Un PUT de un consumidor antiguo borrará `porcentajePie` si ya estaba informado. Es consistente con los demás opcionales; se documenta.
- La migración debe aplicarse antes de usar el cliente Prisma regenerado: comandos en el informe final.
