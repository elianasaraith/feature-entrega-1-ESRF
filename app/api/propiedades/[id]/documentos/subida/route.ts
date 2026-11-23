import { requireSession } from "@/server/auth/require-session";
import { toHttpResponse } from "@/server/errors";
import { subidaSchema } from "@/server/schemas/documento";
import { documentoService } from "@/server/services";

type Context = { params: Promise<{ id: string }> };

// Paso 1 de la subida: valida y devuelve la clave y la URL firmada (PUT).
export async function POST(request: Request, { params }: Context) {
  const session = await requireSession();
  if (session instanceof Response) return session;
  try {
    const { id } = await params;
    const body = await request.json().catch(() => null);
    return Response.json(await documentoService.solicitarSubida(id, subidaSchema.parse(body)));
  } catch (error) {
    return toHttpResponse(error);
  }
}
