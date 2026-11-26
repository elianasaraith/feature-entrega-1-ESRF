-- CreateTable
CREATE TABLE "arrendatario" (
    "id" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "rut" TEXT,
    "email" TEXT,
    "telefono" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "arrendatario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contrato_arriendo" (
    "id" UUID NOT NULL,
    "propiedad_id" UUID NOT NULL,
    "arrendatario_id" UUID NOT NULL,
    "fecha_inicio" DATE NOT NULL,
    "fecha_termino" DATE NOT NULL,
    "garantia_clp" DECIMAL(14,0),
    "dia_esperado_pago" SMALLINT NOT NULL,
    "observaciones" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "contrato_arriendo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contrato_monto" (
    "id" UUID NOT NULL,
    "contrato_id" UUID NOT NULL,
    "monto_mensual_clp" DECIMAL(14,0) NOT NULL,
    "vigente_desde_periodo" DATE NOT NULL,
    "motivo" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "contrato_monto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "arrendatario_rut_key" ON "arrendatario"("rut");

-- CreateIndex
CREATE INDEX "contrato_arriendo_propiedad_id_fecha_inicio_idx" ON "contrato_arriendo"("propiedad_id", "fecha_inicio");

-- CreateIndex
CREATE INDEX "contrato_arriendo_arrendatario_id_idx" ON "contrato_arriendo"("arrendatario_id");

-- CreateIndex
CREATE UNIQUE INDEX "contrato_monto_contrato_id_vigente_desde_periodo_key" ON "contrato_monto"("contrato_id", "vigente_desde_periodo");

-- AddForeignKey
ALTER TABLE "contrato_arriendo" ADD CONSTRAINT "contrato_arriendo_propiedad_id_fkey" FOREIGN KEY ("propiedad_id") REFERENCES "propiedad"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contrato_arriendo" ADD CONSTRAINT "contrato_arriendo_arrendatario_id_fkey" FOREIGN KEY ("arrendatario_id") REFERENCES "arrendatario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contrato_monto" ADD CONSTRAINT "contrato_monto_contrato_id_fkey" FOREIGN KEY ("contrato_id") REFERENCES "contrato_arriendo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Restricciones de negocio de docs/data-model.md §4.6 y §4.7 (Prisma 6 no expresa
-- CHECK en el esquema; mismo enfoque que las migraciones de propiedad y crédito).
ALTER TABLE "contrato_arriendo"
  ADD CONSTRAINT "contrato_arriendo_termino_gte_inicio" CHECK ("fecha_termino" >= "fecha_inicio");

ALTER TABLE "contrato_arriendo"
  ADD CONSTRAINT "contrato_arriendo_garantia_non_negative" CHECK ("garantia_clp" >= 0);

ALTER TABLE "contrato_arriendo"
  ADD CONSTRAINT "contrato_arriendo_dia_esperado_pago_range" CHECK ("dia_esperado_pago" BETWEEN 1 AND 31);

ALTER TABLE "contrato_monto"
  ADD CONSTRAINT "contrato_monto_monto_positive" CHECK ("monto_mensual_clp" > 0);

ALTER TABLE "contrato_monto"
  ADD CONSTRAINT "contrato_monto_periodo_dia_uno" CHECK (EXTRACT(DAY FROM "vigente_desde_periodo") = 1);
