import { hoyChile } from "@/server/clock";
import { requireSession } from "@/server/auth/require-session";
import { toHttpResponse } from "@/server/errors";
import { yearMonth } from "@/server/schemas/shared";
import { dashboardService } from "@/server/services";

// `?mes=YYYY-MM` opcional; sin él, el mes actual de Chile.
export async function GET(request: Request) {
  const session = await requireSession();
  if (session instanceof Response) return session;
  try {
    const hoy = hoyChile();
    const crudo = new URL(request.url).searchParams.get("mes");
    const mes = crudo === null ? hoy.slice(0, 7) : yearMonth.parse(crudo);
    return Response.json(await dashboardService.resumenMensual(mes, hoy));
  } catch (error) {
    return toHttpResponse(error);
  }
}
