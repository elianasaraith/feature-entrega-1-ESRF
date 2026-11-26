import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CUENTA_DESCONOCIDA,
  LIMITE_CUENTA,
  LIMITE_IP,
  LIMPIEZA_MAXIMO,
  VENTANA_SEGUNDOS,
  claveIntento,
  createLimitador,
  agruparIpv6,
  obtenerIp,
  type AlmacenIntentos,
} from "../../server/auth/login-limiter";
import { createAutenticador, normalizarEmail, type UsuarioConHash } from "../../server/auth/autenticar";

// Almacén en memoria con la misma semántica que la sentencia SQL atómica (ventana fija).
function almacenMemoria() {
  const filas = new Map<string, { contador: number; inicio: Date }>();
  const almacen: AlmacenIntentos = {
    async reservar(clave, ahora, ventana) {
      const f = filas.get(clave);
      if (!f || f.inicio.getTime() <= ahora.getTime() - ventana * 1000) {
        filas.set(clave, { contador: 1, inicio: ahora });
        return 1;
      }
      f.contador += 1;
      return f.contador;
    },
    async reiniciar(clave) {
      filas.delete(clave);
    },
    async limpiar(antes, maximo) {
      let n = 0;
      for (const [k, f] of filas) {
        if (n < maximo && f.inicio < antes) {
          filas.delete(k);
          n++;
        }
      }
      return n;
    },
  };
  return { almacen, filas };
}

const USUARIO: UsuarioConHash = { id: "u-1", email: "yo@example.invalid", passwordHash: "hash-real" };

function montar(opts: { reloj?: { t: Date }; usuarios?: UsuarioConHash[]; fallaAlmacen?: boolean } = {}) {
  const reloj = opts.reloj ?? { t: new Date("2026-11-25T10:00:00Z") };
  const { almacen, filas } = almacenMemoria();
  const almacenFinal: AlmacenIntentos = opts.fallaAlmacen
    ? { ...almacen, reservar: async () => { throw new Error("postgres caído"); } }
    : almacen;
  const verificaciones: string[] = [];
  const registros: string[] = [];
  const limitador = createLimitador({ almacen: almacenFinal, sal: "sal-de-pruebas", ahora: () => reloj.t });
  const autenticar = createAutenticador({
    limitador,
    buscarUsuario: async (email) => (opts.usuarios ?? [USUARIO]).find((u) => u.email === email) ?? null,
    verificar: async (hash, password) => {
      verificaciones.push(hash);
      return hash === "hash-real" && password === "correcta";
    },
    hashRelleno: async () => "hash-relleno",
    registrar: (m) => registros.push(m),
  });
  return { autenticar, filas, verificaciones, registros, reloj, limitador };
}

test("cuenta: 5 intentos fallidos se evalúan y el sexto se deniega sin verificar contra el hash real, incluso con la contraseña correcta", async () => {
  const t = montar();
  for (let i = 0; i < LIMITE_CUENTA; i++) assert.equal(await t.autenticar(USUARIO.email, "mala", `ip-${i}`), null);
  assert.equal(t.verificaciones.length, LIMITE_CUENTA);
  assert.equal(await t.autenticar(USUARIO.email, "correcta", "ip-x"), null);
  assert.equal(t.verificaciones.filter((h) => h === "hash-real").length, LIMITE_CUENTA, "nunca se verifica contra la cuenta bloqueada");
  assert.equal(t.verificaciones.at(-1), "hash-relleno", "paridad de coste: el intento bloqueado ejecuta Argon2id contra el relleno");
  assert.ok(t.registros.some((m) => /cuenta/.test(m)));
});

test("IP: el intento 21 se deniega aunque los emails sean distintos o inexistentes", async () => {
  const t = montar();
  for (let i = 0; i < LIMITE_IP; i++) await t.autenticar(`nadie-${i}@example.invalid`, "x", "1.2.3.4");
  assert.equal(await t.autenticar(USUARIO.email, "correcta", "1.2.3.4"), null);
  assert.equal(t.verificaciones.length, LIMITE_IP);
  // Otra IP sigue pudiendo acceder.
  assert.deepEqual(await t.autenticar(USUARIO.email, "correcta", "5.6.7.8"), { id: USUARIO.id, email: USUARIO.email });
});

test("concurrencia: 50 intentos simultáneos contra la misma cuenta verifican como máximo 5 contra el hash real", async () => {
  const t = montar();
  const resultados = await Promise.all(Array.from({ length: 50 }, (_, i) => t.autenticar(USUARIO.email, "mala", `ip-${i}`)));
  assert.ok(resultados.every((r) => r === null));
  assert.equal(t.verificaciones.filter((h) => h === "hash-real").length, LIMITE_CUENTA);
});

test("concurrencia: 50 intentos simultáneos desde una IP verifican como máximo 20", async () => {
  const t = montar();
  await Promise.all(Array.from({ length: 50 }, (_, i) => t.autenticar(`n${i}@example.invalid`, "mala", "9.9.9.9")));
  assert.equal(t.verificaciones.length, LIMITE_IP);
});

test("expiración: transcurrida la ventana de 15 minutos el contador se reinicia", async () => {
  const t = montar();
  for (let i = 0; i < LIMITE_CUENTA + 1; i++) await t.autenticar(USUARIO.email, "mala", "ip");
  assert.equal(await t.autenticar(USUARIO.email, "correcta", "ip-b"), null);
  t.reloj.t = new Date(t.reloj.t.getTime() + VENTANA_SEGUNDOS * 1000 + 1000);
  assert.deepEqual(await t.autenticar(USUARIO.email, "correcta", "ip-b"), { id: USUARIO.id, email: USUARIO.email });
});

test("un acceso correcto reinicia el contador de la cuenta", async () => {
  const t = montar();
  for (let i = 0; i < LIMITE_CUENTA - 1; i++) await t.autenticar(USUARIO.email, "mala", `ip-${i}`);
  assert.ok(await t.autenticar(USUARIO.email, "correcta", "ip-ok"));
  for (let i = 0; i < LIMITE_CUENTA; i++) await t.autenticar(USUARIO.email, "mala", `ip2-${i}`);
  assert.equal(t.verificaciones.length, LIMITE_CUENTA - 1 + 1 + LIMITE_CUENTA);
});

test("emails inexistentes: usan la cuenta genérica y no crean filas por email ni guardan datos en claro", async () => {
  const t = montar();
  for (let i = 0; i < 100; i++) await t.autenticar(`inventado-${i}@example.invalid`, "x", `10.0.0.${i % 250}`);
  const claves = [...t.filas.keys()];
  assert.ok(claves.length <= 100 + 1, "una fila por IP y una cuenta genérica, no una por email");
  assert.ok(claves.includes(claveIntento("cuenta", CUENTA_DESCONOCIDA, "sal-de-pruebas")));
  assert.ok(claves.every((k) => /^(cuenta|ip):[0-9a-f]{64}$/.test(k)), "solo hashes: ni email ni IP en claro");
  assert.ok(!claves.some((k) => k.includes("inventado") || k.includes("10.0.0")));
});

test("enumeración: agotar el cubo de emails inexistentes no permite distinguir emails por el coste (siempre una verificación)", async () => {
  const t = montar();
  for (let i = 0; i < LIMITE_CUENTA + 3; i++) await t.autenticar(`falso-${i}@example.invalid`, "x", `ip-${i}`);
  const antes = t.verificaciones.length;
  await t.autenticar("otro-falso@example.invalid", "x", "ip-n1"); // cubo genérico ya agotado
  await t.autenticar(USUARIO.email, "mala", "ip-n2"); // cuenta real, sin bloquear
  assert.equal(t.verificaciones.length - antes, 2, "ambos caminos ejecutan exactamente una verificación Argon2id");
});

test("enumeración: un email inexistente ejecuta la misma verificación Argon2id (contra el hash de relleno)", async () => {
  const t = montar();
  assert.equal(await t.autenticar("no-existe@example.invalid", "x", "ip"), null);
  assert.equal(await t.autenticar(USUARIO.email, "mala", "ip"), null);
  assert.deepEqual(t.verificaciones, ["hash-relleno", "hash-real"]);
});

test("fallo de PostgreSQL: el acceso se deniega (cierre por defecto) sin verificar y se registra sin datos personales", async () => {
  const t = montar({ fallaAlmacen: true });
  assert.equal(await t.autenticar(USUARIO.email, "correcta", "1.2.3.4"), null);
  assert.equal(t.verificaciones.length, 0);
  assert.equal(t.registros.length, 1);
  assert.ok(!t.registros[0].includes(USUARIO.email) && !t.registros[0].includes("1.2.3.4"));
});

test("el email se normaliza (recorte y minúsculas) y uno demasiado largo no consulta la base", async () => {
  assert.equal(normalizarEmail("  YO@Example.INVALID "), "yo@example.invalid");
  assert.equal(normalizarEmail(""), null);
  assert.equal(normalizarEmail(`${"a".repeat(250)}@x.co`), null);
  const t = montar();
  assert.ok(await t.autenticar("  YO@example.invalid ", "correcta", "ip"));
});

test("limpieza acotada: elimina como máximo LIMPIEZA_MAXIMO registros vencidos por ejecución", async () => {
  const { almacen, filas } = almacenMemoria();
  const viejo = new Date("2026-11-01T00:00:00Z");
  for (let i = 0; i < LIMPIEZA_MAXIMO + 30; i++) await almacen.reservar(`k${i}`, viejo, VENTANA_SEGUNDOS);
  const limitador = createLimitador({ almacen, sal: "s", ahora: () => new Date("2026-11-25T00:00:00Z") });
  assert.equal(await limitador.limpiar(), LIMPIEZA_MAXIMO);
  assert.equal(filas.size, 30);
});

test("IP confiable: en Vercel solo cuenta x-vercel-forwarded-for; x-forwarded-for y x-real-ip se ignoran", () => {
  const h = (o: Record<string, string>) => ({ get: (n: string) => o[n.toLowerCase()] ?? null });
  const vercel = { VERCEL: "1" };
  assert.equal(obtenerIp(h({ "x-vercel-forwarded-for": "203.0.113.7", "x-forwarded-for": "6.6.6.6" }), vercel), "203.0.113.7");
  assert.equal(obtenerIp(h({ "x-vercel-forwarded-for": "203.0.113.7, 10.0.0.1" }), vercel), "203.0.113.7");
  assert.equal(obtenerIp(h({ "x-forwarded-for": "6.6.6.6", "x-real-ip": "7.7.7.7" }), vercel), "desconocida");
  assert.equal(obtenerIp(h({}), vercel), "desconocida");
  assert.equal(obtenerIp(h({ "x-vercel-forwarded-for": "x".repeat(200) }), vercel), "desconocida");
  // Fuera de Vercel todas las solicitudes comparten un cubo local: las cabeceras no se usan.
  assert.equal(obtenerIp(h({ "x-forwarded-for": "6.6.6.6" }), {}), "local");
});

test("IPv6: se agrupa por /64 para que rotar la dirección no cree cubos ni filas nuevos", () => {
  assert.equal(agruparIpv6("2001:db8:1:2:aaaa:bbbb:cccc:dddd"), "2001:db8:1:2::/64");
  assert.equal(agruparIpv6("2001:db8:1:2:1111:2222:3333:4444"), "2001:db8:1:2::/64");
  assert.equal(agruparIpv6("2001:db8::1"), "2001:db8:0:0::/64");
  assert.equal(agruparIpv6("::1"), "0:0:0:0::/64");
  assert.equal(agruparIpv6("203.0.113.7"), "203.0.113.7");
  assert.equal(agruparIpv6("::ffff:203.0.113.7"), "::ffff:203.0.113.7");
  assert.equal(agruparIpv6("no-es-ip:"), "no-es-ip:");
  const h = (v: string) => ({ get: (n: string) => (n === "x-vercel-forwarded-for" ? v : null) });
  assert.equal(obtenerIp(h("2001:db8:1:2::9"), { VERCEL: "1" }), obtenerIp(h("2001:db8:1:2:ffff::1"), { VERCEL: "1" }));
});

test("contraseña demasiado larga: se descarta antes de cualquier Argon2, incluso en la rama de cuenta bloqueada", async () => {
  const t = montar();
  assert.equal(await t.autenticar(USUARIO.email, "x".repeat(1025), "ip"), null);
  assert.equal(t.verificaciones.length, 0);
  for (let i = 0; i < LIMITE_CUENTA + 1; i++) await t.autenticar(USUARIO.email, "mala", `ip-${i}`);
  const antes = t.verificaciones.length;
  assert.equal(await t.autenticar(USUARIO.email, "x".repeat(5000), "ip-z"), null);
  assert.equal(t.verificaciones.length, antes);
});

test("la limpieza acotada también se ejecuta en los intentos denegados", async () => {
  const t = montar();
  const viejo = new Date(t.reloj.t.getTime() - 3 * 24 * 3600 * 1000);
  for (let i = 0; i < 10; i++) t.filas.set(`viejo-${i}`, { contador: 1, inicio: viejo });
  for (let i = 0; i < LIMITE_IP; i++) await t.autenticar(`n${i}@example.invalid`, "x", "1.1.1.1");
  assert.equal(await t.autenticar(USUARIO.email, "correcta", "1.1.1.1"), null); // denegado por IP
  assert.ok(![...t.filas.keys()].some((k) => k.startsWith("viejo-")), "las filas vencidas se eliminaron");
});
