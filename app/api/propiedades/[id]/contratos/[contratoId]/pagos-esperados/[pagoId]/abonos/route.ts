import { hoyChile } from "@/server/clock";
import { requireSession } from "@/server/auth/require-session";
import { toHttpResponse } from "@/server/errors";
import { abonoInputSchema } from "@/server/schemas/abono";
import { pagoService } from "@/server/services";

type Context = { params: Promise<{ id: string; contratoId: string; pagoId: string }> };

export async function GET(_request: Request, { params }: Context) {
  const session = await requireSession();
  if (session instanceof Response) return session;
  try {
    const { id, contratoId, pagoId } = await params;
    return Response.json(await pagoService.listarAbonos(id, contratoId, pagoId));
  } catch (error) {
    return toHttpResponse(error);
  }
}

export async function POST(request: Request, { params }: Context) {
  const session = await requireSession();
  if (session instanceof Response) return session;
  try {
    const { id, contratoId, pagoId } = await params;
    const body = await request.json().catch(() => null);
    const input = abonoInputSchema.parse(body);
    return Response.json(
      await pagoService.crearAbono(id, contratoId, pagoId, input, hoyChile()),
      { status: 201 }
    );
  } catch (error) {
    return toHttpResponse(error);
  }
}
