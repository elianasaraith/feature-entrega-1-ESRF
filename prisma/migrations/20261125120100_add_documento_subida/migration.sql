-- CreateEnum
CREATE TYPE "estado_subida" AS ENUM ('PENDIENTE', 'EN_PROCESO', 'COMPLETADA', 'EXPIRADA');

-- CreateTable
CREATE TABLE "documento_subida" (
    "id" UUID NOT NULL,
    "propiedad_id" UUID NOT NULL,
    "tipo" "tipo_documento" NOT NULL,
    "nombre_archivo" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "tamano_bytes" BIGINT NOT NULL,
    "clave_temporal" TEXT NOT NULL,
    "clave_definitiva" TEXT NOT NULL,
    "estado" "estado_subida" NOT NULL DEFAULT 'PENDIENTE',
    "expira_en" TIMESTAMPTZ(6) NOT NULL,
    "reclamada_en" TIMESTAMPTZ(6),
    "documento_id" UUID,
    "creada_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "documento_subida_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "documento_subida_clave_temporal_key" ON "documento_subida"("clave_temporal");

-- CreateIndex
CREATE UNIQUE INDEX "documento_subida_clave_definitiva_key" ON "documento_subida"("clave_definitiva");

-- CreateIndex
CREATE UNIQUE INDEX "documento_subida_documento_id_key" ON "documento_subida"("documento_id");

-- CreateIndex
CREATE INDEX "documento_subida_propiedad_id_estado_expira_en_idx" ON "documento_subida"("propiedad_id", "estado", "expira_en");

-- CreateIndex
CREATE INDEX "documento_subida_estado_expira_en_idx" ON "documento_subida"("estado", "expira_en");

-- AddForeignKey
ALTER TABLE "documento_subida" ADD CONSTRAINT "documento_subida_propiedad_id_fkey" FOREIGN KEY ("propiedad_id") REFERENCES "propiedad"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documento_subida" ADD CONSTRAINT "documento_subida_documento_id_fkey" FOREIGN KEY ("documento_id") REFERENCES "documento"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Restricciones de negocio (seguridad-mvp). Migración aditiva: no altera tablas ni
-- datos existentes (los documentos registrados antes conservan su clave).
ALTER TABLE "documento_subida"
  ADD CONSTRAINT "documento_subida_tamano_positive" CHECK ("tamano_bytes" > 0),
  ADD CONSTRAINT "documento_subida_claves_distintas" CHECK ("clave_temporal" <> "clave_definitiva");
