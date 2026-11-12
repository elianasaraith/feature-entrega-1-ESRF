import { hoyChile } from "@/server/clock";
import { requireSession } from "@/server/auth/require-session";
import { toHttpResponse } from "@/server/errors";
import { movimientoInputSchema } from "@/server/schemas/movimiento";
import { movimientoService } from "@/server/services";

type Context = { params: Promise<{ id: string; movId: string }> };

export async function GET(_request: Request, { params }: Context) {
  const session = await requireSession();
  if (session instanceof Response) return session;
  try {
    const { id, movId } = await params;
    return Response.json(await movimientoService.obtener(id, movId));
  } catch (error) {
    return toHttpResponse(error);
  }
}

// Cuerpo completo: reemplaza fecha, categoría, monto y descripción.
export async function PUT(request: Request, { params }: Context) {
  const session = await requireSession();
  if (session instanceof Response) return session;
  try {
    const { id, movId } = await params;
    const body = await request.json().catch(() => null);
    const input = movimientoInputSchema.parse(body);
    return Response.json(await movimientoService.editar(id, movId, input, hoyChile()));
  } catch (error) {
    return toHttpResponse(error);
  }
}

// Borrado físico, sin auditoría (docs/data-model.md).
export async function DELETE(_request: Request, { params }: Context) {
  const session = await requireSession();
  if (session instanceof Response) return session;
  try {
    const { id, movId } = await params;
    await movimientoService.eliminar(id, movId);
    return new Response(null, { status: 204 });
  } catch (error) {
    return toHttpResponse(error);
  }
}
