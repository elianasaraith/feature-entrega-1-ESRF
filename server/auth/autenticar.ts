import { randomBytes } from "node:crypto";
import type { Limitador } from "./login-limiter";

export type CredencialesUsuario = { id: string; email: string };
export type UsuarioConHash = { id: string; email: string; passwordHash: string };

export const EMAIL_MAXIMO = 254;
export const PASSWORD_MAXIMO = 1024; // acota el costo de Argon2 ante entradas enormes

// Recorte y minúsculas; null si es vacío o demasiado largo (se deniega sin consultar la base).
export function normalizarEmail(email: string): string | null {
  const normalizado = email.trim().toLowerCase();
  return normalizado.length > 0 && normalizado.length <= EMAIL_MAXIMO ? normalizado : null;
}

// Hash Argon2id válido de una contraseña aleatoria desconocida, calculado una vez por
// instancia: se verifica contra él cuando el email no existe, para que ese camino cueste
// lo mismo que el de una contraseña incorrecta (mitigación de enumeración por tiempo).
export function createHashRelleno(hash: (secreto: string) => Promise<string>): () => Promise<string> {
  let promesa: Promise<string> | null = null;
  return () => (promesa ??= hash(randomBytes(24).toString("hex")));
}

export type DepsAutenticar = {
  limitador: Limitador;
  buscarUsuario: (emailNormalizado: string) => Promise<UsuarioConHash | null>;
  verificar: (hash: string, password: string) => Promise<boolean>;
  hashRelleno: () => Promise<string>;
  registrar?: (mensaje: string) => void;
};

// Orden: IP → cuenta → verificar. Si el límite se supera no se ejecuta Argon2. Un fallo
// del almacén de intentos CIERRA el acceso (no degrada a «sin límite»). Los mensajes al
// llamador son siempre `null`: el motivo se registra sin email ni IP.
export function createAutenticador(deps: DepsAutenticar) {
  const registrar = deps.registrar ?? ((m) => console.error(m));
  return async function autenticar(email: string, password: string, ip: string): Promise<CredencialesUsuario | null> {
    try {
      // Mantenimiento acotado (50 filas) en cada intento, también en los denegados: un atacante
      // no puede crear filas más rápido de lo que se eliminan las vencidas. Su fallo no bloquea.
      await deps.limitador.limpiar().catch(() => registrar("No se pudo limpiar el registro de intentos"));
      if (!(await deps.limitador.reservarIp(ip))) {
        registrar("Acceso denegado: límite de intentos por IP");
        return null;
      }
      // Contraseñas absurdamente largas: se descartan antes de cualquier Argon2.
      if (password.length > PASSWORD_MAXIMO) return null;
      const emailNormalizado = normalizarEmail(email);
      const usuario = emailNormalizado ? await deps.buscarUsuario(emailNormalizado) : null;
      if (!(await deps.limitador.reservarCuenta(usuario?.id ?? null))) {
        registrar("Acceso denegado: límite de intentos por cuenta");
        // Paridad de coste: la contraseña NUNCA se verifica contra el hash de la cuenta
        // bloqueada, pero se ejecuta Argon2id contra el hash de relleno para que un intento
        // bloqueado tarde lo mismo que uno evaluado. Sin esto, agotar el cubo genérico de
        // emails inexistentes y medir tiempos revelaría qué emails existen. El coste queda
        // acotado por el límite por IP (20 por ventana).
        await deps.verificar(await deps.hashRelleno(), password).catch(() => false);
        return null;
      }
      const valida = await deps.verificar(usuario?.passwordHash ?? (await deps.hashRelleno()), password);
      if (!usuario || !valida) return null;
      // Mantenimiento: sus fallos no deben bloquear un acceso correcto.
      await deps.limitador.reiniciarCuenta(usuario.id).catch(() => registrar("No se pudo reiniciar el contador de la cuenta"));
      return { id: usuario.id, email: usuario.email };
    } catch {
      registrar("Acceso denegado: fallo del almacén de intentos o de la verificación");
      return null;
    }
  };
}
