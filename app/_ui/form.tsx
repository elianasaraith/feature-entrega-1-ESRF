import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { cn } from "../_lib/cn";

export const claseCampo =
  "block w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink shadow-sm placeholder:text-slate-400 disabled:bg-canvas disabled:text-muted aria-[invalid=true]:border-negative";

// Etiqueta + control + ayuda + errores. El <label> envuelve el control para
// asociarlo sin necesidad de ids.
export function FormField({
  etiqueta,
  errores,
  ayuda,
  requerido,
  className,
  children,
}: {
  etiqueta: string;
  errores?: string[];
  ayuda?: string;
  requerido?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label className={cn("block text-sm", className)}>
      <span className="mb-1.5 block font-medium text-ink">
        {etiqueta}
        {requerido && (
          <span aria-hidden className="text-negative">
            {" "}
            *
          </span>
        )}
      </span>
      {children}
      {ayuda && <span className="mt-1 block text-xs text-muted">{ayuda}</span>}
      {errores?.map((mensaje) => (
        <span key={mensaje} role="alert" className="mt-1 block text-xs font-medium text-negative">
          {mensaje}
        </span>
      ))}
    </label>
  );
}

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(claseCampo, className)} {...rest} />;
}

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(claseCampo, className)} {...rest}>
      {children}
    </select>
  );
}

export function Textarea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(claseCampo, className)} {...rest} />;
}
