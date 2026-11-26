import { hoyChile } from "@/server/clock";
import { requireSession } from "@/server/auth/require-session";
import { toHttpResponse } from "@/server/errors";
import { contratoActualizarSchema } from "@/server/schemas/contrato";
import { contratoService } from "@/server/services";

type Context = { params: Promise<{ id: string; contratoId: string }> };

// Sin DELETE: el contrato no se elimina (405).
export async function GET(_request: Request, { params }: Context) {
  const session = await requireSession();
  if (session instanceof Response) return session;
  try {
    const { id, contratoId } = await params;
    return Response.json(await contratoService.obtener(id, contratoId, hoyChile()));
  } catch (error) {
    return toHttpResponse(error);
  }
}

// Cuerpo completo; solo actualiza un contrato existente, nunca lo crea ni
// modifica el monto inicial.
export async function PUT(request: Request, { params }: Context) {
  const session = await requireSession();
  if (session instanceof Response) return session;
  try {
    const { id, contratoId } = await params;
    const body = await request.json().catch(() => null);
    const input = contratoActualizarSchema.parse(body);
    return Response.json(await contratoService.actualizar(id, contratoId, input, hoyChile()));
  } catch (error) {
    return toHttpResponse(error);
  }
}
