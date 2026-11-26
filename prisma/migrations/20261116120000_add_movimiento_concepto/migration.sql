-- CreateTable
CREATE TABLE "movimiento_concepto" (
    "id" UUID NOT NULL,
    "movimiento_financiero_id" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "monto_clp" DECIMAL(14,0) NOT NULL,
    "orden" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "movimiento_concepto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "movimiento_concepto_movimiento_financiero_id_idx" ON "movimiento_concepto"("movimiento_financiero_id");

-- AddForeignKey
ALTER TABLE "movimiento_concepto" ADD CONSTRAINT "movimiento_concepto_movimiento_financiero_id_fkey" FOREIGN KEY ("movimiento_financiero_id") REFERENCES "movimiento_financiero"("id") ON DELETE CASCADE ON UPDATE CASCADE;



-- Restricción de negocio de la ampliación de T07 (desglose de movimientos): el
-- monto de un concepto es un entero CLP positivo. Prisma 6 no expresa CHECK en el
-- esquema; mismo enfoque que las migraciones anteriores. Migración aditiva: no
-- altera movimiento_financiero ni modifica filas existentes (sin relleno: todo
-- movimiento actual es un gasto simple, sin conceptos).
ALTER TABLE "movimiento_concepto"
  ADD CONSTRAINT "movimiento_concepto_monto_positive" CHECK ("monto_clp" > 0);
