import { auth } from "@/auth";
import { LogoutButton } from "./logout-button";

// Placeholder minimo que demuestra la proteccion global de rutas (T12).
// La gestion de propiedades (T01) todavia no existe.
export default async function Home() {
  const session = await auth();

  return (
    <main style={{ maxWidth: 360, margin: "4rem auto", fontFamily: "sans-serif" }}>
      <p>Sesión activa: {session?.user?.email}</p>
      <LogoutButton />
    </main>
  );
}
