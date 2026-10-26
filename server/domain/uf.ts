import { Prisma } from "@prisma/client";

// Conversión UF → CLP (docs/data-model.md §8; architecture.md §5). Función pura:
// recibe el valor de la UF, no lo obtiene ni lo persiste. Aritmética decimal
// exacta (sin Number) y sin redondeo: el redondeo es solo de presentación.
// Hasta integrar T10 ningún código de aplicación la invoca.
// decimal.js usa 20 dígitos significativos por defecto y truncaría el producto
// de dos NUMERIC(12,4)/(12,2); 40 cubre cualquier combinación de las columnas.
const Decimal = Prisma.Decimal.clone({ precision: 40 });

export function convertirUfAClp(montoUf: string, valorClp: string): string {
  const monto = new Decimal(montoUf);
  const valor = new Decimal(valorClp);
  if (!valor.isFinite() || valor.lte(0)) {
    throw new RangeError("El valor de la UF debe ser mayor que 0");
  }
  return monto.mul(valor).toFixed();
}
