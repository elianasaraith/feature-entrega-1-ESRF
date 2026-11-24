## Why

El desarrollo funcional de RealtyTrack está completo, pero el frontend es visualmente básico (HTML casi sin estilos, sin navegación compartida ni identidad). Se requiere una interfaz SaaS financiera/inmobiliaria profesional, coherente y responsive antes de la entrega final.

## What Changes

- Sistema de diseño compartido (tokens Tailwind v4, tipografía, componentes UI reutilizables, formatos CLP/UF/fecha).
- Layout autenticado compartido (AppShell, sidebar responsive, menú móvil, breadcrumbs, cierre de sesión); login fuera del layout.
- Rediseño del dashboard con tarjetas, selector/navegación de mes, histórico 6/12 meses y gráficos (Recharts).
- Rediseño de todas las pantallas existentes: propiedades, créditos, registro mensual, contratos, arrendatario, montos, pagos/abonos, movimientos, documentos, login, error y not-found.
- Idioma `es`, título, descripción y metadata de RealtyTrack.
- Dependencias nuevas: `lucide-react`, `recharts`.
- Sin cambios en backend, esquema Prisma, contratos HTTP, reglas de negocio ni cálculos financieros. No hay cambios **BREAKING**.

## Capabilities

### New Capabilities
- `frontend-experience`: sistema de diseño, layout autenticado, navegación, accesibilidad, responsive y estados de UI (carga, vacío, error, confirmación) de toda la aplicación.

### Modified Capabilities
<!-- Ninguna: no cambian requisitos funcionales de las specs existentes. -->

## Impact

- Código: `app/**` (páginas y paneles cliente), `app/globals.css`, `app/layout.tsx`, nuevo `app/_ui/` y `app/_lib/` de presentación.
- Dependencias: `lucide-react`, `recharts` (sin actualizar versiones existentes).
- APIs, BD, almacenamiento R2, autenticación: sin cambios.
