-- CreateTable
CREATE TABLE "credito_registro_mensual" (
    "id" UUID NOT NULL,
    "credito_id" UUID NOT NULL,
    "periodo" DATE NOT NULL,
    "dividendo_pagado_clp" DECIMAL(14,0),
    "fecha_pago_dividendo" DATE,
    "saldo_pendiente_uf" DECIMAL(12,4),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "credito_registro_mensual_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "credito_registro_mensual_fecha_pago_dividendo_idx" ON "credito_registro_mensual"("fecha_pago_dividendo");

-- CreateIndex
CREATE UNIQUE INDEX "credito_registro_mensual_credito_id_periodo_key" ON "credito_registro_mensual"("credito_id", "periodo");

-- AddForeignKey
ALTER TABLE "credito_registro_mensual" ADD CONSTRAINT "credito_registro_mensual_credito_id_fkey" FOREIGN KEY ("credito_id") REFERENCES "credito_hipotecario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Restricciones de negocio de docs/data-model.md §4.4 (Prisma 6 no expresa CHECK
-- en el esquema; mismo enfoque que 20261021120000_add_credito_hipotecario).
-- Las columnas opcionales admiten NULL: un CHECK con NULL se evalúa como no violado.
ALTER TABLE "credito_registro_mensual"
  ADD CONSTRAINT "credito_registro_periodo_dia_uno" CHECK (EXTRACT(DAY FROM "periodo") = 1);

ALTER TABLE "credito_registro_mensual"
  ADD CONSTRAINT "credito_registro_dividendo_positive" CHECK ("dividendo_pagado_clp" > 0);

ALTER TABLE "credito_registro_mensual"
  ADD CONSTRAINT "credito_registro_saldo_non_negative" CHECK ("saldo_pendiente_uf" >= 0);

-- Nunca una fila sin ningún hecho registrado.
ALTER TABLE "credito_registro_mensual"
  ADD CONSTRAINT "credito_registro_dato_presente"
  CHECK ("dividendo_pagado_clp" IS NOT NULL OR "saldo_pendiente_uf" IS NOT NULL);

-- Regla aprobada (más estricta que el data-model §4.4 original): la fecha de pago
-- existe si y solo si hay dividendo.
ALTER TABLE "credito_registro_mensual"
  ADD CONSTRAINT "credito_registro_fecha_pago_iff_dividendo"
  CHECK (("dividendo_pagado_clp" IS NULL) = ("fecha_pago_dividendo" IS NULL));
