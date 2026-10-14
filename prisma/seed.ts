import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const propiedadesFicticias = [
  {
    numeroDepartamento: "101-A",
    direccion: "Calle Ficticia 123, Depto 101-A",
    superficieM2: 48.5,
    valorCompraMonto: 2200,
    valorCompraMoneda: "UF" as const,
    fechaCompra: new Date("2021-03-15"),
    estacionamiento: "E-12",
    bodega: "B-5",
  },
  {
    numeroDepartamento: "205-B",
    direccion: "Avenida de Prueba 456, Depto 205-B",
    superficieM2: 62.0,
    valorCompraMonto: 3100,
    valorCompraMoneda: "UF" as const,
    fechaCompra: new Date("2022-07-01"),
    estacionamiento: null,
    bodega: "B-9",
  },
  {
    numeroDepartamento: "310-C",
    direccion: "Pasaje Imaginario 789, Depto 310-C",
    superficieM2: 35.2,
    valorCompraMonto: 95000000,
    valorCompraMoneda: "CLP" as const,
    fechaCompra: new Date("2023-11-20"),
    estacionamiento: null,
    bodega: null,
  },
];

async function main() {
  for (const propiedad of propiedadesFicticias) {
    await prisma.propiedad.create({ data: propiedad });
  }
  console.log(`Seed completado: ${propiedadesFicticias.length} propiedades ficticias insertadas.`);
}

main()
  .catch((error) => {
    console.error("Error ejecutando el seed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
