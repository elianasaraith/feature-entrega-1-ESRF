import { createHmac } from "node:crypto";

// Límite de intentos de acceso (seguridad-mvp, design.md D1). Ventana fija de 15
// minutos; cada intento se RESERVA de forma atómica antes de verificar la contraseña,
// así que solicitudes concurrentes reciben contadores distintos y no superan el límite.
// El estado vive en PostgreSQL (puerto `AlmacenIntentos`): compartido entre instancias
// serverless. Parámetros únicos y documentados:
export const VENTANA_SEGUNDOS = 15 * 60;
export const LIMITE_CUENTA = 5;
// Por IP: tolera NAT/uso compartido razonable de evaluadores y corta la fuerza bruta
// (20 intentos cada 15 minutos ≈ 80 por hora y por IP).
export const LIMITE_IP = 20;
// Los emails inexistentes comparten esta cuenta genérica: no crean filas por email.
export const CUENTA_DESCONOCIDA = "desconocida";
// Limpieza acotada de registros cuya ventana venció hace más de un día.
export const RETENCION_SEGUNDOS = 24 * 60 * 60;
export const LIMPIEZA_MAXIMO = 50;

export interface AlmacenIntentos {
  // Incrementa de forma atómica (reiniciando a 1 si la ventana venció) y devuelve el contador resultante.
  reservar(clave: string, ahora: Date, ventanaSegundos: number): Promise<number>;
  reiniciar(clave: string): Promise<void>;
  // Elimina como máximo `maximo` registros con ventana anterior a `antes`; devuelve cuántos.
  limpiar(antes: Date, maximo: number): Promise<number>;
}

// Clave pseudónima (HMAC): la base nunca guarda el email ni la IP en claro.
export function claveIntento(tipo: "cuenta" | "ip", valor: string, sal: string): string {
  return `${tipo}:${createHmac("sha256", sal).update(`${tipo}|${valor}`).digest("hex")}`;
}

export function createLimitador(deps: { almacen: AlmacenIntentos; sal: string; ahora?: () => Date }) {
  const ahora = deps.ahora ?? (() => new Date());
  const reservar = async (clave: string, limite: number) =>
    (await deps.almacen.reservar(clave, ahora(), VENTANA_SEGUNDOS)) <= limite;
  return {
    // true = el intento puede continuar; false = límite superado (sin verificar la contraseña).
    reservarIp: (ip: string) => reservar(claveIntento("ip", ip, deps.sal), LIMITE_IP),
    reservarCuenta: (cuentaId: string | null) =>
      reservar(claveIntento("cuenta", cuentaId ?? CUENTA_DESCONOCIDA, deps.sal), LIMITE_CUENTA),
    reiniciarCuenta: (cuentaId: string) => deps.almacen.reiniciar(claveIntento("cuenta", cuentaId, deps.sal)),
    limpiar: () =>
      deps.almacen.limpiar(new Date(ahora().getTime() - RETENCION_SEGUNDOS * 1000), LIMPIEZA_MAXIMO),
  };
}
export type Limitador = ReturnType<typeof createLimitador>;

// IP del cliente: solo de la cabecera que Vercel sobrescribe. `x-forwarded-for` y
// `x-real-ip` los puede enviar el cliente y se ignoran siempre. Fuera de Vercel
// (desarrollo y pruebas) todas las solicitudes comparten un cubo local.
export function obtenerIp(
  headers: { get(nombre: string): string | null },
  env: Record<string, string | undefined> = process.env
): string {
  if (!env.VERCEL) return "local";
  const valor = headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim();
  return valor && valor.length <= 64 ? agruparIpv6(valor) : "desconocida";
}

// Un atacante con un bloque IPv6 /64 controla 2^64 direcciones: se agrupa por /64 (los
// primeros 4 grupos) para que rotar la dirección no cree una fila ni un cubo nuevos.
export function agruparIpv6(ip: string): string {
  if (!ip.includes(":") || ip.includes(".")) return ip; // IPv4 o IPv4 mapeada
  const [cabeza, cola] = ip.split("::");
  const grupos = (t: string | undefined) => (t ? t.split(":").filter(Boolean) : []);
  const a = grupos(cabeza);
  const b = ip.includes("::") ? grupos(cola) : [];
  const completo = ip.includes("::") ? [...a, ...new Array(Math.max(0, 8 - a.length - b.length)).fill("0"), ...b] : a;
  if (completo.length !== 8 || !completo.every((g) => /^[0-9a-f]{1,4}$/i.test(g))) return ip;
  return `${completo.slice(0, 4).map((g) => g.toLowerCase().replace(/^0+(?=.)/, "")).join(":")}::/64`;
}
