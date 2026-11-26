-- Porcentaje de pie del crédito (change porcentaje-pie-hipotecario).
-- Migración no destructiva: columna opcional sin DEFAULT ni backfill, de modo que
-- los créditos existentes quedan en NULL («no informado»; distinto de 0 %).
ALTER TABLE "credito_hipotecario" ADD COLUMN "porcentaje_pie" DECIMAL(5,2);

-- Un CHECK con NULL se evalúa como no violado.
ALTER TABLE "credito_hipotecario"
  ADD CONSTRAINT "credito_porcentaje_pie_range" CHECK ("porcentaje_pie" BETWEEN 0 AND 100);
