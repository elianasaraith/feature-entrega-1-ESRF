import { Suspense } from "react";
import { PropiedadNav, PropiedadNavFallback } from "../../_ui/propiedad-nav";

export default function PropiedadLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Suspense fallback={<PropiedadNavFallback />}>
        <PropiedadNav />
      </Suspense>
      {children}
    </>
  );
}
