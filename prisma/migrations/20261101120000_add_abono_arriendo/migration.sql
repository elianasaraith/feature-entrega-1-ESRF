-- CreateTable
CREATE TABLE "abono_arriendo" (
    "id" UUID NOT NULL,
    "pago_esperado_id" UUID NOT NULL,
    "monto_clp" DECIMAL(14,0) NOT NULL,
    "fecha_recepcion" DATE NOT NULL,
    "medio" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "abono_arriendo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "abono_arriendo_pago_esperado_id_idx" ON "abono_arriendo"("pago_esperado_id");

-- CreateIndex
CREATE INDEX "abono_arriendo_fecha_recepcion_idx" ON "abono_arriendo"("fecha_recepcion");

-- AddForeignKey
ALTER TABLE "abono_arriendo" ADD CONSTRAINT "abono_arriendo_pago_esperado_id_fkey" FOREIGN KEY ("pago_esperado_id") REFERENCES "pago_esperado"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Restricción de negocio de docs/data-model.md §4.9 (Prisma 6 no expresa CHECK
-- en el esquema; mismo enfoque que las migraciones anteriores). Sin tope sobre
-- el monto esperado: los abonos pueden excederlo.
ALTER TABLE "abono_arriendo"
  ADD CONSTRAINT "abono_arriendo_monto_positive" CHECK ("monto_clp" > 0);
