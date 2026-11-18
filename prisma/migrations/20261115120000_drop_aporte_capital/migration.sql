-- Retiro de T08 (aportes de capital): decisión funcional confirmada, no se
-- registran aportes independientes. La migración histórica
-- 20261114120000_add_aporte_capital se conserva sin cambios.
--
-- DROP TABLE arrastra las FK a propiedad y movimiento_financiero, los índices y
-- el CHECK de aporte_capital. No se modifica ninguna otra tabla. IF EXISTS
-- permite correrla en una base donde el alta nunca se aplicó.
DROP TABLE IF EXISTS "aporte_capital";
DROP TYPE IF EXISTS "motivo_aporte";
