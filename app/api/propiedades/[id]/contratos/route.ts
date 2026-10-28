import { hoyChile } from "@/server/clock";
import { requireSession } from "@/server/auth/require-session";
import { toHttpResponse } from "@/server/errors";
import { contratoCrearSchema } from "@/server/schemas/contrato";
import { contratoService } from "@/server/services";

type Context = { params: Promise<{ id: string }> };

// Sin DELETE: el contrato no se elimina (405).
export async function GET(_request: Request, { params }: Context) {
  const session = await requireSession();
  if (session instanceof Response) return session;
  try {
    const { id } = await params;
    return Response.json(await contratoService.listar(id, hoyChile()));
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
    const input = contratoCrearSchema.parse(body);
    return Response.json(await contratoService.crear(id, input, hoyChile()), { status: 201 });
  } catch (error) {
    return toHttpResponse(error);
  }
}
