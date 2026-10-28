import { z } from "zod";
import { optionalText } from "./shared";

// Espejo de docs/data-model.md §4.5. El RUT es opcional y único (la unicidad la
// impone la base de datos y el servicio la traduce a 409).
export const arrendatarioInputSchema = z.object({
  nombre: z.string().trim().min(1, "Obligatorio"),
  rut: optionalText,
  email: optionalText,
  telefono: optionalText,
});

export type ArrendatarioInput = z.output<typeof arrendatarioInputSchema>;
