import { describe, it, expect, afterAll } from "vitest";
import ExcelJS from "exceljs";
import { prisma } from "@/app/lib/prisma";
import { importTemplates } from "@/services/template.service";

const NORMA_DE_PRUEBA = "TEST-CRITERIO";

async function libroDeRol(): Promise<Buffer> {
  const libro = new ExcelJS.Workbook();
  const hoja = libro.addWorksheet("Hoja1");
  hoja.addRow([
    "Norma",
    "Item",
    "Título del Requerimiento",
    "Descripción del Requerimiento",
    "Criterio de Aceptación",
  ]);
  hoja.addRow([
    NORMA_DE_PRUEBA,
    "9.9",
    "TITULO",
    "Descripcion",
    "Debe existir un BEP firmado por las partes.",
  ]);
  return Buffer.from(await libro.xlsx.writeBuffer());
}

afterAll(async () => {
  await prisma.requirementTemplate.deleteMany({
    where: { norma: NORMA_DE_PRUEBA },
  });
});

describe("importTemplates", () => {
  it("guarda el criterio de aceptacion de la quinta columna", async () => {
    await importTemplates(await libroDeRol(), "requerimientos_adjudicador.xlsx");

    const plantilla = await prisma.requirementTemplate.findFirst({
      where: { norma: NORMA_DE_PRUEBA, item: "9.9" },
    });

    expect(plantilla?.criterioAceptacion).toBe(
      "Debe existir un BEP firmado por las partes."
    );
  });
});
