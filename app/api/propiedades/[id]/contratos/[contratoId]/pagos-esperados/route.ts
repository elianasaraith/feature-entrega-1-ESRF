import { hoyChile } from "@/server/clock";
import { requireSession } from "@/server/auth/require-session";
import { toHttpResponse } from "@/server/errors";
import { pagoService } from "@/server/services";

type Context = { params: Promise<{ id: string; contratoId: string }> };

// Solo lectura: lista los pagos esperados con su estado derivado a hoy (Chile).
// Nunca crea pagos; eso es POST .../pagos-esperados/sincronizar.
export async function GET(_request: Request, { params }: Context) {
  const session = await requireSession();
  if (session instanceof Response) return session;
  try {
    const { id, contratoId } = await params;
    return Response.json(await pagoService.listarPagos(id, contratoId, hoyChile()));
  } catch (error) {
    return toHttpResponse(error);
  }
}
