import { hoyChile } from "@/server/clock";
import { requireSession } from "@/server/auth/require-session";
import { toHttpResponse } from "@/server/errors";
import { contratoService } from "@/server/services";

type Context = { params: Promise<{ id: string; contratoId: string }> };

// Única vía de creación de pagos esperados: explícita e idempotente. Solo POST.
export async function POST(_request: Request, { params }: Context) {
  const session = await requireSession();
  if (session instanceof Response) return session;
  try {
    const { id, contratoId } = await params;
    return Response.json(await contratoService.sincronizarPagos(id, contratoId, hoyChile()));
  } catch (error) {
    return toHttpResponse(error);
  }
}
