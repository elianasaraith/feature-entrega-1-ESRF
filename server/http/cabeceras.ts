// Cabeceras HTTP de seguridad y CSP (seguridad-mvp, design.md D7). Funciones puras: las
// usa next.config.ts y las prueban tests/seguridad/cabeceras.test.ts.
export type OpcionesCabeceras = {
  produccion: boolean;
  // S3_ENDPOINT del servidor: la subida directa hace PUT a ese host (connect-src).
  s3Endpoint?: string | null;
};

export function hostAlmacenamiento(s3Endpoint: string | null | undefined): string | null {
  if (!s3Endpoint) return null;
  try {
    const url = new URL(s3Endpoint);
    return url.protocol === "https:" || url.protocol === "http:" ? url.origin : null;
  } catch {
    return null;
  }
}

// RIESGO RESIDUAL (documentado en docs/architecture.md): `script-src` mantiene
// 'unsafe-inline' porque Next.js inyecta scripts de hidratación en línea y una CSP con
// nonce obliga a renderizado dinámico de todas las páginas, incompatible con Cache
// Components. Un XSS que inyectase un <script> en línea no sería bloqueado por la CSP;
// se mitiga con la ausencia de dangerouslySetInnerHTML, el escape de React y las demás
// directivas, que limitan objetos, base, formularios, marcos y conexiones.
export function construirCsp({ produccion, s3Endpoint }: OpcionesCabeceras): string {
  const almacenamiento = hostAlmacenamiento(s3Endpoint);
  const directivas = [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${produccion ? "" : " 'unsafe-eval'"}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    `connect-src 'self'${almacenamiento ? ` ${almacenamiento}` : ""}${produccion ? "" : " ws: http://localhost:*"}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ];
  return directivas.join("; ");
}

export function cabecerasSeguridad(opciones: OpcionesCabeceras): { key: string; value: string }[] {
  return [
    { key: "Content-Security-Policy", value: construirCsp(opciones) },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
    { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  ];
}
