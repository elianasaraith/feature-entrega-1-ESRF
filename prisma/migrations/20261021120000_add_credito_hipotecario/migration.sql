-- CreateTable
CREATE TABLE "credito_hipotecario" (
    "id" UUID NOT NULL,
    "propiedad_id" UUID NOT NULL,
    "banco" TEXT NOT NULL,
    "numero_credito" TEXT,
    "fecha_otorgamiento" DATE,
    "monto_original_uf" DECIMAL(12,4),
    "cuota_contractual_uf" DECIMAL(12,4) NOT NULL,
    "tasa_interes_anual" DECIMAL(6,4) NOT NULL,
    "numero_cuotas_total" INTEGER NOT NULL,
    "seguros_uf" DECIMAL(12,4),
    "dia_vencimiento" SMALLINT NOT NULL,
    "saldo_inicial_uf" DECIMAL(12,4),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "credito_hipotecario_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "credito_hipotecario_propiedad_id_key" ON "credito_hipotecario"("propiedad_id");

-- AddForeignKey
ALTER TABLE "credito_hipotecario" ADD CONSTRAINT "credito_hipotecario_propiedad_id_fkey" FOREIGN KEY ("propiedad_id") REFERENCES "propiedad"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Restricciones de negocio de docs/data-model.md §4.3 (Prisma 6 no expresa CHECK
-- en el esquema; mismo enfoque que 20261013120000_add_propiedad_check_constraints).
-- Las columnas opcionales admiten NULL: un CHECK con NULL se evalúa como no violado.
ALTER TABLE "credito_hipotecario"
  ADD CONSTRAINT "credito_monto_original_uf_positive" CHECK ("monto_original_uf" > 0);

ALTER TABLE "credito_hipotecario"
  ADD CONSTRAINT "credito_cuota_contractual_uf_positive" CHECK ("cuota_contractual_uf" > 0);

ALTER TABLE "credito_hipotecario"
  ADD CONSTRAINT "credito_tasa_interes_anual_non_negative" CHECK ("tasa_interes_anual" >= 0);

ALTER TABLE "credito_hipotecario"
  ADD CONSTRAINT "credito_numero_cuotas_total_positive" CHECK ("numero_cuotas_total" > 0);

ALTER TABLE "credito_hipotecario"
  ADD CONSTRAINT "credito_seguros_uf_non_negative" CHECK ("seguros_uf" >= 0);

ALTER TABLE "credito_hipotecario"
  ADD CONSTRAINT "credito_dia_vencimiento_range" CHECK ("dia_vencimiento" BETWEEN 1 AND 31);

ALTER TABLE "credito_hipotecario"
  ADD CONSTRAINT "credito_saldo_inicial_uf_non_negative" CHECK ("saldo_inicial_uf" >= 0);
