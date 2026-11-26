import { requireSession } from "@/server/auth/require-session";
import { toHttpResponse } from "@/server/errors";
import { propiedadInputSchema } from "@/server/schemas/propiedad";
import { propiedadService } from "@/server/services";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Context) {
  const session = await requireSession();
  if (session instanceof Response) return session;
  try {
    const { id } = await params;
    return Response.json(await propiedadService.obtener(id));
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
    const input = propiedadInputSchema.parse(body);
    return Response.json(await propiedadService.actualizar(id, input));
  } catch (error) {
    return toHttpResponse(error);
  }
}
