import Link from "next/link";
import { Loader2 } from "lucide-react";
import type { ButtonHTMLAttributes, ComponentProps, ReactNode } from "react";
import { cn } from "../_lib/cn";

type Variante = "primary" | "secondary" | "danger" | "ghost";
type Tamano = "sm" | "md";

const VARIANTES: Record<Variante, string> = {
  primary: "bg-brand text-white hover:bg-brand-700 shadow-sm",
  secondary: "bg-white text-ink border border-line hover:bg-canvas shadow-sm",
  danger: "bg-negative text-white hover:bg-red-700 shadow-sm",
  ghost: "text-muted hover:bg-canvas hover:text-ink",
};
const TAMANOS: Record<Tamano, string> = {
  sm: "h-8 px-3 text-xs",
  md: "h-10 px-4 text-sm",
};

export function claseBoton(variante: Variante = "primary", tamano: Tamano = "md", extra?: string) {
  return cn(
    "inline-flex shrink-0 items-center justify-center gap-2 rounded-lg font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
    VARIANTES[variante],
    TAMANOS[tamano],
    extra
  );
}

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variante?: Variante;
  tamano?: Tamano;
  cargando?: boolean;
};

export function Button({ variante, tamano, cargando, disabled, className, children, type = "button", ...rest }: Props) {
  return (
    <button
      type={type}
      disabled={disabled || cargando}
      aria-busy={cargando || undefined}
      className={claseBoton(variante, tamano, className)}
      {...rest}
    >
      {cargando && <Loader2 aria-hidden className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}

export function ButtonLink({
  variante,
  tamano,
  className,
  children,
  ...rest
}: ComponentProps<typeof Link> & { variante?: Variante; tamano?: Tamano; children: ReactNode }) {
  return (
    <Link className={claseBoton(variante, tamano, className)} {...rest}>
      {children}
    </Link>
  );
}
