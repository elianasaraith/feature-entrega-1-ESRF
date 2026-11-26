import type { ReactNode } from "react";
import { cn } from "../_lib/cn";

// Contenedor con desplazamiento horizontal: nunca desborda la página.
export function DataTable({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("overflow-x-auto", className)}>
      <table className="w-full min-w-[32rem] text-left text-sm">{children}</table>
    </div>
  );
}

export function Th({ children, alinear = "left", className }: { children?: ReactNode; alinear?: "left" | "right"; className?: string }) {
  return (
    <th
      scope="col"
      className={cn(
        "whitespace-nowrap border-b border-line bg-canvas/60 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted",
        alinear === "right" && "text-right",
        className
      )}
    >
      {children}
    </th>
  );
}

export function Td({ children, alinear = "left", numerico, className, colSpan }: { children?: ReactNode; alinear?: "left" | "right"; numerico?: boolean; className?: string; colSpan?: number }) {
  return (
    <td
      colSpan={colSpan}
      className={cn("border-b border-line px-4 py-3 align-middle", (alinear === "right" || numerico) && "text-right", numerico && "tabular-nums", className)}
    >
      {children}
    </td>
  );
}
