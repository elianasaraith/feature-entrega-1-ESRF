import { hoyChile } from "@/server/clock";
import { requireSession } from "@/server/auth/require-session";
import { toHttpResponse } from "@/server/errors";
import { movimientoInputSchema } from "@/server/schemas/movimiento";
import { yearMonth } from "@/server/schemas/shared";
import { movimientoService } from "@/server/services";

type Context = { params: Promise<{ id: string }> };

// `?mes=YYYY-MM` opcional; sin él, el historial completo.
export async function GET(request: Request, { params }: Context) {
  const session = await requireSession();
  if (session instanceof Response) return session;
  try {
    const { id } = await params;
    const crudo = new URL(request.url).searchParams.get("mes");
    const mes = crudo === null ? null : yearMonth.parse(crudo);
    return Response.json(await movimientoService.listar(id, { mes }));
  } catch (error) {
    return toHttpResponse(error);
  }
}

export async function POST(request: Request, { params }: Context) {
  const session = await requireSession();
  if (session instanceof Response) return session;
  try {
    const { id } = await params;
    const body = await request.json().catch(() => null);
    const input = movimientoInputSchema.parse(body);
    return Response.json(await movimientoService.crear(id, input, hoyChile()), { status: 201 });
  } catch (error) {
    return toHttpResponse(error);
  }
}
