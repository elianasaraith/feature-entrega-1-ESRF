import "server-only";
import { ZodError } from "zod";

export class NotFoundError extends Error {
  constructor(message = "Recurso no encontrado") {
    super(message);
    this.name = "NotFoundError";
  }
}

export class ConflictError extends Error {
  constructor(message = "Conflicto con el estado actual del recurso") {
    super(message);
    this.name = "ConflictError";
  }
}

// Único punto de traducción de errores a HTTP (architecture.md §17).
export function toHttpResponse(error: unknown): Response {
  if (error instanceof ZodError) {
    const campos: Record<string, string[]> = {};
    for (const issue of error.issues) {
      const campo = issue.path.join(".") || "_";
      (campos[campo] ??= []).push(issue.message);
    }
    return Response.json({ error: "Entrada inválida", campos }, { status: 400 });
  }
  if (error instanceof NotFoundError) {
    return Response.json({ error: error.message }, { status: 404 });
  }
  if (error instanceof ConflictError) {
    return Response.json({ error: error.message }, { status: 409 });
  }
  console.error(error);
  return Response.json({ error: "Error interno" }, { status: 500 });
}
