import { requireSession } from "@/server/auth/require-session";
import { toHttpResponse } from "@/server/errors";
import { montoCorregirSchema } from "@/server/schemas/contrato";
import { contratoService } from "@/server/services";

type Context = { params: Promise<{ id: string; contratoId: string; montoId: string }> };

// Corrige monto/motivo de una fila. 422 si un pago afectado tiene abonos.
export async function PUT(request: Request, { params }: Context) {
  const session = await requireSession();
  if (session instanceof Response) return session;
  try {
    const { id, contratoId, montoId } = await params;
    const body = await request.json().catch(() => null);
    const input = montoCorregirSchema.parse(body);
    return Response.json(await contratoService.corregirMonto(id, contratoId, montoId, input));
  } catch (error) {
    return toHttpResponse(error);
  }
}

// Elimina un reajuste (nunca el monto inicial), bajo la misma condición de abonos.
export async function DELETE(_request: Request, { params }: Context) {
  const session = await requireSession();
  if (session instanceof Response) return session;
  try {
    const { id, contratoId, montoId } = await params;
    return Response.json(await contratoService.eliminarMonto(id, contratoId, montoId));
  } catch (error) {
    return toHttpResponse(error);
  }
}
