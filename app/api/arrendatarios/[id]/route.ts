import { requireSession } from "@/server/auth/require-session";
import { toHttpResponse } from "@/server/errors";
import { arrendatarioInputSchema } from "@/server/schemas/arrendatario";
import { arrendatarioService } from "@/server/services";

type Context = { params: Promise<{ id: string }> };

// Sin DELETE: el arrendatario no se elimina (405).
export async function GET(_request: Request, { params }: Context) {
  const session = await requireSession();
  if (session instanceof Response) return session;
  try {
    const { id } = await params;
    return Response.json(await arrendatarioService.obtener(id));
  } catch (error) {
    return toHttpResponse(error);
  }
}

export async function PUT(request: Request, { params }: Context) {
  const session = await requireSession();
  if (session instanceof Response) return session;
  try {
    const { id } = await params;
    const body = await request.json().catch(() => null);
    const input = arrendatarioInputSchema.parse(body);
    return Response.json(await arrendatarioService.actualizar(id, input));
  } catch (error) {
    return toHttpResponse(error);
  }
}
