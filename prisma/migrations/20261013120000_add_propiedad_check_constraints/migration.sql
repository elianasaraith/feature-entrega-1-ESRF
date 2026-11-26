-- Restricciones de negocio de docs/data-model.md §4.2 para `propiedad`.
-- Prisma 6.19.3 no tiene un atributo de esquema para CHECK constraints
-- (sin coincidencias de "@@check" en los paquetes @prisma instalados),
-- así que se agregan con SQL explícito en una migración incremental,
-- sin modificar la migración 20261011025948_init_propiedad ya aplicada.

ALTER TABLE "propiedad"
  ADD CONSTRAINT "propiedad_superficie_m2_positive" CHECK ("superficie_m2" > 0);

ALTER TABLE "propiedad"
  ADD CONSTRAINT "propiedad_valor_compra_monto_positive" CHECK ("valor_compra_monto" > 0);

ALTER TABLE "propiedad"
  ADD CONSTRAINT "propiedad_valor_compra_monto_clp_sin_decimales" CHECK (
    "valor_compra_moneda" <> 'CLP' OR "valor_compra_monto" = floor("valor_compra_monto")
  );
