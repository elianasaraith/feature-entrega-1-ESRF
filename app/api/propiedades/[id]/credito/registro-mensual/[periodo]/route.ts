import { requireSession } from "@/server/auth/require-session";
import { toHttpResponse } from "@/server/errors";
import {
  periodoSchema,
  registroMensualActualizarSchema,
} from "@/server/schemas/credito-registro";
import { creditoRegistroService } from "@/server/services";

type Context = { params: Promise<{ id: string; periodo: string }> };

// Sin DELETE: el registro mensual no se elimina (405).
export async function GET(_request: Request, { params }: Context) {
  const session = await requireSession();
  if (session instanceof Response) return session;
  try {
    const { id, periodo } = await params;
    return Response.json(
      await creditoRegistroService.obtenerPorPeriodo(id, periodoSchema.parse(periodo))
    );
  } catch (error) {
    return toHttpResponse(error);
  }
}

// Cuerpo completo; solo actualiza un registro existente, nunca lo crea.
export async function PUT(request: Request, { params }: Context) {
  const session = await requireSession();
  if (session instanceof Response) return session;
  try {
    const { id, periodo } = await params;
    const periodoValido = periodoSchema.parse(periodo);
    const body = await request.json().catch(() => null);
    const input = registroMensualActualizarSchema.parse(body);
    return Response.json(await creditoRegistroService.actualizar(id, periodoValido, input));
  } catch (error) {
    return toHttpResponse(error);
  }
}
