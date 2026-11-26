import { hoyChile } from "@/server/clock";
import { requireSession } from "@/server/auth/require-session";
import { toHttpResponse } from "@/server/errors";
import { MESES_HISTORICO_DEFECTO, mesesHistorico, yearMonth } from "@/server/schemas/shared";
import { dashboardService } from "@/server/services";

// `?mes=YYYY-MM` (por defecto el mes actual de Chile) y `?meses=1..12` (por defecto 6).
export async function GET(request: Request) {
  const session = await requireSession();
  if (session instanceof Response) return session;
  try {
    const params = new URL(request.url).searchParams;
    const crudoMes = params.get("mes");
    const crudoMeses = params.get("meses");
    const mes = crudoMes === null ? hoyChile().slice(0, 7) : yearMonth.parse(crudoMes);
    const meses = crudoMeses === null ? MESES_HISTORICO_DEFECTO : mesesHistorico.parse(crudoMeses);
    return Response.json(await dashboardService.historico(mes, meses));
  } catch (error) {
    return toHttpResponse(error);
  }
}
