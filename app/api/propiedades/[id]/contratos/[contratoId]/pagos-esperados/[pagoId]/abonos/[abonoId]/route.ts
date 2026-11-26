import { hoyChile } from "@/server/clock";
import { requireSession } from "@/server/auth/require-session";
import { toHttpResponse } from "@/server/errors";
import { abonoInputSchema } from "@/server/schemas/abono";
import { pagoService } from "@/server/services";

type Context = {
  params: Promise<{ id: string; contratoId: string; pagoId: string; abonoId: string }>;
};

// Reemplaza monto, fecha de recepción y medio.
export async function PUT(request: Request, { params }: Context) {
  const session = await requireSession();
  if (session instanceof Response) return session;
  try {
    const { id, contratoId, pagoId, abonoId } = await params;
    const body = await request.json().catch(() => null);
    const input = abonoInputSchema.parse(body);
    return Response.json(
      await pagoService.editarAbono(id, contratoId, pagoId, abonoId, input, hoyChile())
    );
  } catch (error) {
    return toHttpResponse(error);
  }
}

// Borrado físico, sin auditoría (docs/data-model.md).
export async function DELETE(_request: Request, { params }: Context) {
  const session = await requireSession();
  if (session instanceof Response) return session;
  try {
    const { id, contratoId, pagoId, abonoId } = await params;
    await pagoService.eliminarAbono(id, contratoId, pagoId, abonoId);
    return new Response(null, { status: 204 });
  } catch (error) {
    return toHttpResponse(error);
  }
}
