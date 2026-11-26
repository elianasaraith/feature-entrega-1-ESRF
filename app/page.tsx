import { redirect } from "next/navigation";

// La raíz solo redirige al dashboard (ruta protegida por proxy.ts).
export default function Home() {
  redirect("/dashboard");
}
