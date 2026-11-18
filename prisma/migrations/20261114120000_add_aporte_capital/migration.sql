-- CreateEnum
CREATE TYPE "motivo_aporte" AS ENUM ('PIE_INICIAL', 'CAPITAL_ADICIONAL', 'COBERTURA_DEFICIT', 'OTRO');

-- CreateTable
CREATE TABLE "aporte_capital" (
    "id" UUID NOT NULL,
    "propiedad_id" UUID NOT NULL,
    "movimiento_financiero_id" UUID,
    "fecha" DATE NOT NULL,
    "monto_clp" DECIMAL(14,0) NOT NULL,
    "motivo" "motivo_aporte" NOT NULL,
    "descripcion" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "aporte_capital_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "aporte_capital_propiedad_id_fecha_idx" ON "aporte_capital"("propiedad_id", "fecha");

-- CreateIndex
CREATE INDEX "aporte_capital_movimiento_financiero_id_idx" ON "aporte_capital"("movimiento_financiero_id");

-- AddForeignKey
ALTER TABLE "aporte_capital" ADD CONSTRAINT "aporte_capital_propiedad_id_fkey" FOREIGN KEY ("propiedad_id") REFERENCES "propiedad"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aporte_capital" ADD CONSTRAINT "aporte_capital_movimiento_financiero_id_fkey" FOREIGN KEY ("movimiento_financiero_id") REFERENCES "movimiento_financiero"("id") ON DELETE SET NULL ON UPDATE CASCADE;



-- Restricción de negocio de docs/data-model.md §4.11 (Prisma 6 no expresa CHECK
-- en el esquema; mismo enfoque que las migraciones anteriores).
ALTER TABLE "aporte_capital"
  ADD CONSTRAINT "aporte_capital_monto_positive" CHECK ("monto_clp" > 0);
