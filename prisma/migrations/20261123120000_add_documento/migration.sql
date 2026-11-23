-- CreateEnum
CREATE TYPE "tipo_documento" AS ENUM ('ESCRITURA', 'CONTRATO_HIPOTECARIO', 'CONTRATO_ARRIENDO', 'COMPROBANTE_PAGO', 'FACTURA', 'OTRO');

-- CreateTable
CREATE TABLE "documento" (
    "id" UUID NOT NULL,
    "propiedad_id" UUID NOT NULL,
    "credito_id" UUID,
    "contrato_id" UUID,
    "abono_arriendo_id" UUID,
    "movimiento_financiero_id" UUID,
    "tipo" "tipo_documento" NOT NULL,
    "nombre_archivo" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "tamano_bytes" BIGINT NOT NULL,
    "storage_key" TEXT NOT NULL,
    "subido_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "documento_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "documento_storage_key_key" ON "documento"("storage_key");

-- CreateIndex
CREATE INDEX "documento_propiedad_id_subido_en_idx" ON "documento"("propiedad_id", "subido_en");

-- AddForeignKey
ALTER TABLE "documento" ADD CONSTRAINT "documento_propiedad_id_fkey" FOREIGN KEY ("propiedad_id") REFERENCES "propiedad"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documento" ADD CONSTRAINT "documento_credito_id_fkey" FOREIGN KEY ("credito_id") REFERENCES "credito_hipotecario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documento" ADD CONSTRAINT "documento_contrato_id_fkey" FOREIGN KEY ("contrato_id") REFERENCES "contrato_arriendo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documento" ADD CONSTRAINT "documento_abono_arriendo_id_fkey" FOREIGN KEY ("abono_arriendo_id") REFERENCES "abono_arriendo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documento" ADD CONSTRAINT "documento_movimiento_financiero_id_fkey" FOREIGN KEY ("movimiento_financiero_id") REFERENCES "movimiento_financiero"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Restricciones de negocio (docs/data-model.md §4.13). Prisma 6 no expresa CHECK en
-- el esquema; mismo enfoque que las migraciones anteriores. Migración aditiva:
-- no altera tablas existentes ni modifica filas.
ALTER TABLE "documento"
  ADD CONSTRAINT "documento_tamano_positive" CHECK ("tamano_bytes" > 0),
  ADD CONSTRAINT "documento_un_solo_vinculo" CHECK (
    (CASE WHEN "credito_id" IS NULL THEN 0 ELSE 1 END
     + CASE WHEN "contrato_id" IS NULL THEN 0 ELSE 1 END
     + CASE WHEN "abono_arriendo_id" IS NULL THEN 0 ELSE 1 END
     + CASE WHEN "movimiento_financiero_id" IS NULL THEN 0 ELSE 1 END) <= 1
  );
