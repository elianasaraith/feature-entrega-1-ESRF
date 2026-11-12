// Selector de mes sin JavaScript de cliente: un formulario GET que recarga la
// página con `?mes=YYYY-MM`. Admite meses pasados y futuros.
export function SelectorMes({ mes }: { mes: string }) {
  return (
    <form method="get" className="flex items-end gap-2 text-sm">
      <label className="flex flex-col gap-1">
        <span className="font-medium">Mes</span>
        <input type="month" name="mes" defaultValue={mes} required className="rounded border px-2 py-1" />
      </label>
      <button type="submit" className="rounded bg-black px-3 py-1.5 text-white">
        Ver
      </button>
    </form>
  );
}
