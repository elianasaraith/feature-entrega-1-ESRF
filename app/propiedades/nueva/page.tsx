import { Card, CardBody, PageHeader } from "../../_ui";
import { PropiedadForm } from "../propiedad-form";

export default function NuevaPropiedadPage() {
  return (
    <div className="max-w-2xl">
      <PageHeader
        titulo="Nueva propiedad"
        migas={[{ etiqueta: "Propiedades", href: "/propiedades" }, { etiqueta: "Nueva" }]}
      />
      <Card>
        <CardBody>
          <PropiedadForm />
        </CardBody>
      </Card>
    </div>
  );
}
