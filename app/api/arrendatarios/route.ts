import { requireSession } from "@/server/auth/require-session";
import { toHttpResponse } from "@/server/errors";
import { arrendatarioInputSchema } from "@/server/schemas/arrendatario";
import { arrendatarioService } from "@/server/services";

// Sin DELETE: el arrendatario no se elimina (405).
export async function GET() {
  const session = await requireSession();
  if (session instanceof Response) return session;
  try {
    return Response.json(await arrendatarioService.listar());
  } catch (error) {
    return toHttpResponse(error);
  }
}

export async function POST(request: Request) {
  const session = await requireSession();
  if (session instanceof Response) return session;
  try {
    const body = await request.json().catch(() => null);
    const input = arrendatarioInputSchema.parse(body);
    return Response.json(await arrendatarioService.crear(input), { status: 201 });
  } catch (error) {
    return toHttpResponse(error);
  }
}
