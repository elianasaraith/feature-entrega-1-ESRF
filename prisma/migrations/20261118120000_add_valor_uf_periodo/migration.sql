-- CreateTable
CREATE TABLE "valor_uf_periodo" (
    "periodo" DATE NOT NULL,
    "valor_clp" DECIMAL(12,2) NOT NULL,
    "fecha_valor" DATE NOT NULL,
    "fuente" TEXT NOT NULL,
    "obtenido_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "valor_uf_periodo_pkey" PRIMARY KEY ("periodo")
);

-- Restricciones de docs/data-model.md §4.12 (Prisma 6 no expresa CHECK en el
-- esquema; mismo enfoque que 20261025120000_add_credito_registro_mensual).
ALTER TABLE "valor_uf_periodo"
  ADD CONSTRAINT "valor_uf_periodo_valor_positive" CHECK ("valor_clp" > 0);

ALTER TABLE "valor_uf_periodo"
  ADD CONSTRAINT "valor_uf_periodo_periodo_dia_uno" CHECK (EXTRACT(DAY FROM "periodo") = 1);
