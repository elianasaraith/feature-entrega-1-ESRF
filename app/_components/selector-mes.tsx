import { Button } from "../_ui";
import { Input } from "../_ui";

// Selector de mes sin JavaScript de cliente: un formulario GET que recarga la
// página con `?mes=YYYY-MM`. Admite meses pasados y futuros.
// `defaultValue` solo se aplica al montar y Next conserva el componente al navegar
// entre meses (enlaces, Atrás/Adelante): `key` lo remonta cuando cambia el período.
export function SelectorMes({ mes, meses }: { mes: string; meses?: number }) {
  return (
    <form key={`${mes}-${meses ?? ""}`} method="get" className="flex items-end gap-2 text-sm">
      {meses ? <input type="hidden" name="meses" value={meses} /> : null}
      <label className="flex flex-col gap-1">
        <span className="font-medium text-ink">Mes</span>
        <Input type="month" name="mes" defaultValue={mes} required className="h-10 w-44" />
      </label>
      <Button type="submit" variante="secondary">
        Ver
      </Button>
    </form>
  );
}
