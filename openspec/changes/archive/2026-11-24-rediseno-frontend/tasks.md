## 1. Fundamentos

- [x] 1.1 Instalar `lucide-react` y `recharts` sin actualizar versiones existentes
- [x] 1.2 Tokens, tipografía y estilos globales; metadata y `lang="es"`
- [x] 1.3 Componentes UI compartidos (Button, Card, StatCard, Badge, FormField/Input/Select, DataTable, EmptyState, LoadingState, ErrorState, Alert, ConfirmDialog, PageHeader, Breadcrumbs)
- [x] 1.4 AppShell, Sidebar responsive y route group autenticado con cierre de sesión
- [x] 1.5 Páginas error y not-found

## 2. Dashboard y login

- [x] 2.1 Dashboard: tarjetas, selector/navegación de mes, histórico, gráficos, resumen por propiedad, referencias UF
- [x] 2.2 Login rediseñado con errores de red

## 3. Módulos

- [x] 3.1 Propiedades (listado, detalle, formularios) y créditos (resumen, registro mensual, formularios)
- [x] 3.2 Contratos, arrendatario, montos, pagos y abonos
- [x] 3.3 Movimientos financieros y documentos (drop zone, iconos, confirmación)

## 4. Verificación y documentación

- [x] 4.1 `openspec validate`, `tsc`, ESLint ejecutados OK; tests: 240 pasan, 3 fallan y 171 se omiten por falta de DATABASE_URL en el sandbox; build NO ejecutable en el sandbox (validar localmente)
- [x] 4.2 Validación visual y funcional local confirmada por la persona (incluye correcciones de Next.js y sincronización del selector de mes); la IA no ejecutó navegador
- [x] 4.3 Actualizar README y prompts.md
