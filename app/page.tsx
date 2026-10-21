import { Suspense } from "react";
import Link from "next/link";
import { auth } from "@/auth";
import { LogoutButton } from "./logout-button";

// Placeholder minimo que demuestra la proteccion global de rutas (T12).
// La gestion de propiedades (T01) vive en /propiedades.
//
// Con cacheComponents, auth() lee las cookies de la peticion (dato de runtime)
// y debe quedar dentro de un limite <Suspense>; si no, `next build` falla al
// prerenderizar "/".
export default function Home() {
  return (
    <main style={{ maxWidth: 360, margin: "4rem auto", fontFamily: "sans-serif" }}>
      <Suspense fallback={<p>Cargando…</p>}>
        <SesionActiva />
      </Suspense>
      <p>
        <Link href="/propiedades">Propiedades</Link>
      </p>
      <LogoutButton />
    </main>
  );
}

async function SesionActiva() {
  const session = await auth();
  return <p>Sesión activa: {session?.user?.email}</p>;
}
