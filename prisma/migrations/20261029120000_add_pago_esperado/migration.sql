-- CreateTable
CREATE TABLE "pago_esperado" (
    "id" UUID NOT NULL,
    "contrato_id" UUID NOT NULL,
    "periodo" DATE NOT NULL,
    "monto_esperado_clp" DECIMAL(14,0) NOT NULL,
    "fecha_esperada" DATE NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "pago_esperado_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pago_esperado_contrato_id_periodo_key" ON "pago_esperado"("contrato_id", "periodo");

-- AddForeignKey
ALTER TABLE "pago_esperado" ADD CONSTRAINT "pago_esperado_contrato_id_fkey" FOREIGN KEY ("contrato_id") REFERENCES "contrato_arriendo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Restricciones de negocio de docs/data-model.md §4.8 (Prisma 6 no expresa CHECK
-- en el esquema; mismo enfoque que las migraciones anteriores).
ALTER TABLE "pago_esperado"
  ADD CONSTRAINT "pago_esperado_monto_positive" CHECK ("monto_esperado_clp" > 0);

ALTER TABLE "pago_esperado"
  ADD CONSTRAINT "pago_esperado_periodo_dia_uno" CHECK (EXTRACT(DAY FROM "periodo") = 1);
