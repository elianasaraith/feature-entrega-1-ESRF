## Context

Next.js 16 (App Router, cacheComponents) + Tailwind v4 sin librería de UI. Las páginas son Server Components con `<Suspense>` y paneles cliente para mutaciones vía `fetch`. Hoy cada página usa `<main>` propio sin layout compartido.

## Goals / Non-Goals

**Goals:** identidad visual coherente, layout compartido, componentes reutilizables, dashboard con gráficos, responsive y accesible.
**Non-Goals:** cambios de backend/datos/HTTP, nuevas funcionalidades, modo oscuro, migrar framework, librería de componentes externa.

## Decisions

- **Tokens en `@theme` de Tailwind v4** (`globals.css`): colores semánticos (`navy`, `brand`, `positive`, `warning`, `negative`, `surface`). Alternativa descartada: shadcn/Radix (dependencias no autorizadas).
- **Layout autenticado con route group `(app)`**: mover páginas autenticadas a `app/(app)/` con `layout.tsx` que renderiza AppShell; `(auth)` queda aparte. Las URLs no cambian. Alternativa: layout en raíz con detección de ruta (peor para RSC).
- **Sidebar**: componente cliente mínimo (`usePathname`, estado del menú móvil); el resto del shell es servidor.
- **UI en `app/_ui/`** (componentes presentacionales) y `app/_lib/format.ts` (re-exporta formateadores existentes de `server/` sin duplicar lógica financiera).
- **Gráficos**: Recharts en un único componente cliente que recibe datos ya calculados; los montos llegan como string y solo se convierten a número para el eje visual, nunca para totales.
- **Diálogo de confirmación**: `<dialog>` nativo, sin librería.
- **Subagentes** por módulos con archivos exclusivos, tras estabilizar el sistema de diseño.

## Risks / Trade-offs

- [Mover archivos rompe imports relativos] → verificar con `tsc` y build.
- [Conversión a Number para gráficos pierde precisión] → solo visual; tablas/tarjetas usan el string original.
- [Regresiones en paneles cliente] → mantener lógica de `fetch` intacta; tests existentes deben seguir pasando.
