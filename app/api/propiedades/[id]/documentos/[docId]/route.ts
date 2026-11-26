import { requireSession } from "@/server/auth/require-session";
import { toHttpResponse } from "@/server/errors";
import { documentoService } from "@/server/services";

type Context = { params: Promise<{ id: string; docId: string }> };

// URL firmada de lectura (vida corta); nunca una URL pública.
export async function GET(_request: Request, { params }: Context) {
  const session = await requireSession();
  if (session instanceof Response) return session;
  try {
    const { id, docId } = await params;
    return Response.json(await documentoService.urlLectura(id, docId));
  } catch (error) {
    return toHttpResponse(error);
  }
}

export async function DELETE(_request: Request, { params }: Context) {
  const session = await requireSession();
  if (session instanceof Response) return session;
  try {
    const { id, docId } = await params;
    return Response.json(await documentoService.eliminar(id, docId));
  } catch (error) {
    return toHttpResponse(error);
  }
}
