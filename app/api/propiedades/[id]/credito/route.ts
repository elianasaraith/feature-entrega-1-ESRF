import { requireSession } from "@/server/auth/require-session";
import { toHttpResponse } from "@/server/errors";
import { creditoInputSchema } from "@/server/schemas/credito";
import { creditoService } from "@/server/services";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Context) {
  const session = await requireSession();
  if (session instanceof Response) return session;
  try {
    const { id } = await params;
    return Response.json(await creditoService.obtenerPorPropiedad(id));
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
    const input = creditoInputSchema.parse(body);
    return Response.json(await creditoService.crear(id, input), { status: 201 });
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
    const input = creditoInputSchema.parse(body);
    return Response.json(await creditoService.actualizar(id, input));
  } catch (error) {
    return toHttpResponse(error);
  }
}
