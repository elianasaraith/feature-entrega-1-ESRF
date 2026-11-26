-- CreateTable
CREATE TABLE "login_intento" (
    "clave" TEXT NOT NULL,
    "contador" INTEGER NOT NULL,
    "ventana_inicio" TIMESTAMPTZ(6) NOT NULL,
    "actualizado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "login_intento_pkey" PRIMARY KEY ("clave")
);

-- CreateIndex
CREATE INDEX "login_intento_ventana_inicio_idx" ON "login_intento"("ventana_inicio");

-- Restricción de negocio (seguridad-mvp). Migración aditiva: no altera tablas ni
-- datos existentes.
ALTER TABLE "login_intento" ADD CONSTRAINT "login_intento_contador_positive" CHECK ("contador" >= 0);
