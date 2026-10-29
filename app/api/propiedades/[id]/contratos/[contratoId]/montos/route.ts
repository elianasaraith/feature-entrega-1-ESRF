import { hoyChile } from "@/server/clock";
import { requireSession } from "@/server/auth/require-session";
import { toHttpResponse } from "@/server/errors";
import { montoCrearSchema } from "@/server/schemas/contrato";
import { contratoService } from "@/server/services";

type Context = { params: Promise<{ id: string; contratoId: string }> };

// Sin DELETE ni PUT: el histórico de montos solo crece (405).
export async function GET(_request: Request, { params }: Context) {
  const session = await requireSession();
  if (session instanceof Response) return session;
  try {
    const { id, contratoId } = await params;
    return Response.json(await contratoService.listarMontos(id, contratoId, hoyChile()));
  } catch (error) {
    return toHttpResponse(error);
  }
}

// Primer monto o reajuste: agrega una fila.
export async function POST(request: Request, { params }: Context) {
  const session = await requireSession();
  if (session instanceof Response) return session;
  try {
    const { id, contratoId } = await params;
    const body = await request.json().catch(() => null);
    const input = montoCrearSchema.parse(body);
    return Response.json(await contratoService.registrarMonto(id, contratoId, input), {
      status: 201,
    });
  } catch (error) {
    return toHttpResponse(error);
  }
}
