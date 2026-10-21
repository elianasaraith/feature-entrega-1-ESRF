import { requireSession } from "@/server/auth/require-session";
import { toHttpResponse } from "@/server/errors";
import { propiedadInputSchema } from "@/server/schemas/propiedad";
import { propiedadService } from "@/server/services";

export async function GET() {
  const session = await requireSession();
  if (session instanceof Response) return session;
  try {
    return Response.json(await propiedadService.listar());
  } catch (error) {
    return toHttpResponse(error);
  }
}

export async function POST(request: Request) {
  const session = await requireSession();
  if (session instanceof Response) return session;
  try {
    const body = await request.json().catch(() => null);
    const input = propiedadInputSchema.parse(body);
    return Response.json(await propiedadService.crear(input), { status: 201 });
  } catch (error) {
    return toHttpResponse(error);
  }
}
