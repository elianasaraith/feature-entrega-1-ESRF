import { AppShell } from "../_ui/app-shell";
import { GuardiaSesion } from "../_ui/guardia-sesion";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell>
      <GuardiaSesion>{children}</GuardiaSesion>
    </AppShell>
  );
}
