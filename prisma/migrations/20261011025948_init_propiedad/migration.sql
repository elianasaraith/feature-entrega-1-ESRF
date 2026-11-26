-- CreateEnum
CREATE TYPE "moneda" AS ENUM ('UF', 'CLP');

-- CreateTable
CREATE TABLE "propiedad" (
    "id" UUID NOT NULL,
    "numero_departamento" TEXT NOT NULL,
    "direccion" TEXT,
    "superficie_m2" DECIMAL(8,2) NOT NULL,
    "valor_compra_monto" DECIMAL(14,4) NOT NULL,
    "valor_compra_moneda" "moneda" NOT NULL,
    "fecha_compra" DATE NOT NULL,
    "estacionamiento" TEXT,
    "bodega" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "propiedad_pkey" PRIMARY KEY ("id")
);
