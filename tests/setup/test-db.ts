// Aislamiento de las pruebas de integración: solo se escribe en la BD indicada
// por TEST_DATABASE_URL, y únicamente si NO apunta a la misma base y schema que
// DATABASE_URL o DIRECT_URL. Nunca se usa DATABASE_URL como alternativa. Si una
// URL es inválida o el aislamiento no puede comprobarse, `skip` trae el motivo y
// las pruebas no escriben nada.
//
// La comparación es por destino (host, puerto, base y schema), no por texto, y
// nunca usa usuario ni contraseña: el mismo usuario puede servir a dos bases, y
// dos usuarios distintos pueden apuntar a la misma. Los motivos de omisión no
// incluyen las URLs, para no filtrar credenciales.
type TestDatabaseEnv = {
  TEST_DATABASE_URL?: string;
  DATABASE_URL?: string;
  DIRECT_URL?: string;
};

type Destino = { host: string; port: string; database: string; schema: string };

// Neon expone la misma base por un host directo y por otro con «-pooler» en la
// primera etiqueta; se normaliza para no tratarlos como bases distintas.
function normalizarHost(host: string): string {
  const [primera, ...resto] = host.toLowerCase().split(".");
  return [primera.replace(/-pooler$/, ""), ...resto].join(".");
}

// null = inválida o no comprobable.
export function destinoDe(url: string): Destino | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== "postgresql:" && parsed.protocol !== "postgres:") return null;
  if (!parsed.hostname) return null;
  let database: string;
  try {
    database = decodeURIComponent(parsed.pathname.replace(/^\//, ""));
  } catch {
    return null;
  }
  if (!database) return null;
  return {
    host: normalizarHost(parsed.hostname),
    port: parsed.port || "5432",
    database,
    schema: parsed.searchParams.get("schema") || "public",
  };
}

const mismoDestino = (a: Destino, b: Destino) =>
  a.host === b.host && a.port === b.port && a.database === b.database && a.schema === b.schema;

export function resolveTestDatabase(
  env: TestDatabaseEnv = {
    TEST_DATABASE_URL: process.env.TEST_DATABASE_URL,
    DATABASE_URL: process.env.DATABASE_URL,
    DIRECT_URL: process.env.DIRECT_URL,
  }
): {
  url: string | undefined;
  skip: string | false;
} {
  const url = env.TEST_DATABASE_URL;
  if (!url) return { url, skip: "TEST_DATABASE_URL no definida" };

  const destinoPrueba = destinoDe(url);
  if (!destinoPrueba) {
    return { url, skip: "TEST_DATABASE_URL inválida: no puede comprobarse el aislamiento" };
  }

  for (const [nombre, valor] of [
    ["DATABASE_URL", env.DATABASE_URL],
    ["DIRECT_URL", env.DIRECT_URL],
  ] as const) {
    if (!valor) continue;
    const destinoDev = destinoDe(valor);
    if (!destinoDev) {
      return { url, skip: `${nombre} inválida: no puede comprobarse el aislamiento` };
    }
    if (mismoDestino(destinoPrueba, destinoDev)) {
      return { url, skip: `TEST_DATABASE_URL apunta a la misma base y schema que ${nombre}` };
    }
  }
  return { url, skip: false };
}
