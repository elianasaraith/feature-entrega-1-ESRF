import { requireSession } from "@/server/auth/require-session";
import { toHttpResponse } from "@/server/errors";
import { registroMensualCrearSchema } from "@/server/schemas/credito-registro";
import { creditoRegistroService } from "@/server/services";

type Context = { params: Promise<{ id: string }> };

// Sin DELETE: el registro mensual no se elimina (405).
export async function GET(_request: Request, { params }: Context) {
  const session = await requireSession();
  if (session instanceof Response) return session;
  try {
    const { id } = await params;
    return Response.json(await creditoRegistroService.listar(id));
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
    const input = registroMensualCrearSchema.parse(body);
    return Response.json(await creditoRegistroService.crear(id, input), { status: 201 });
  } catch (error) {
    return toHttpResponse(error);
  }
}
