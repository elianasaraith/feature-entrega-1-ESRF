import { requireSession } from "@/server/auth/require-session";
import { toHttpResponse } from "@/server/errors";
import { registroSchema } from "@/server/schemas/documento";
import { documentoService } from "@/server/services";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Context) {
  const session = await requireSession();
  if (session instanceof Response) return session;
  try {
    const { id } = await params;
    return Response.json(await documentoService.listar(id));
  } catch (error) {
    return toHttpResponse(error);
  }
}

// Paso 3: registra la metadata tras comprobar el objeto subido.
export async function POST(request: Request, { params }: Context) {
  const session = await requireSession();
  if (session instanceof Response) return session;
  try {
    const { id } = await params;
    const body = await request.json().catch(() => null);
    return Response.json(await documentoService.registrar(id, registroSchema.parse(body)), { status: 201 });
  } catch (error) {
    return toHttpResponse(error);
  }
}
