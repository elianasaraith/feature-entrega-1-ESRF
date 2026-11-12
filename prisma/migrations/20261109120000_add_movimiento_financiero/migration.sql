-- CreateEnum
CREATE TYPE "categoria_movimiento" AS ENUM ('REPARACION', 'EQUIPAMIENTO', 'SEGURO', 'CONTRIBUCIONES', 'GASTO_COMUN', 'GASTO_EXTRAORDINARIO', 'OTRO');

-- CreateTable
CREATE TABLE "movimiento_financiero" (
    "id" UUID NOT NULL,
    "propiedad_id" UUID NOT NULL,
    "fecha" DATE NOT NULL,
    "categoria" "categoria_movimiento" NOT NULL,
    "monto_clp" DECIMAL(14,0) NOT NULL,
    "descripcion" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "movimiento_financiero_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "movimiento_financiero_propiedad_id_fecha_idx" ON "movimiento_financiero"("propiedad_id", "fecha");

-- AddForeignKey
ALTER TABLE "movimiento_financiero" ADD CONSTRAINT "movimiento_financiero_propiedad_id_fkey" FOREIGN KEY ("propiedad_id") REFERENCES "propiedad"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Restricción de negocio de docs/data-model.md §4.10 (Prisma 6 no expresa CHECK
-- en el esquema; mismo enfoque que las migraciones anteriores).
ALTER TABLE "movimiento_financiero"
  ADD CONSTRAINT "movimiento_financiero_monto_positive" CHECK ("monto_clp" > 0);
