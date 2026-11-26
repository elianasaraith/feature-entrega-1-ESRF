"use client";

import { useEffect, useRef } from "react";
import { Button } from "./button";

// Diálogo de confirmación basado en <dialog> nativo (foco atrapado y Esc incluidos).
export function ConfirmDialog({
  abierto,
  titulo,
  descripcion,
  etiquetaConfirmar = "Eliminar",
  cargando,
  onConfirmar,
  onCancelar,
}: {
  abierto: boolean;
  titulo: string;
  descripcion?: string;
  etiquetaConfirmar?: string;
  cargando?: boolean;
  onConfirmar: () => void;
  onCancelar: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (abierto && !d.open) d.showModal();
    if (!abierto && d.open) d.close();
  }, [abierto]);

  return (
    <dialog
      ref={ref}
      aria-labelledby="confirm-titulo"
      onCancel={(e) => {
        e.preventDefault();
        if (!cargando) onCancelar();
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-xl border border-line bg-white p-0 shadow-xl"
    >
      <div className="p-6">
        <h2 id="confirm-titulo" className="text-base font-semibold text-ink">
          {titulo}
        </h2>
        {descripcion && <p className="mt-2 text-sm text-muted">{descripcion}</p>}
      </div>
      <div className="flex justify-end gap-2 border-t border-line bg-canvas/60 px-6 py-3">
        <Button variante="secondary" onClick={onCancelar} disabled={cargando}>
          Cancelar
        </Button>
        <Button variante="danger" onClick={onConfirmar} cargando={cargando}>
          {etiquetaConfirmar}
        </Button>
      </div>
    </dialog>
  );
}
