import { describe, it, expect } from "vitest";
import ExcelJS from "exceljs";
import { parseRoleTemplateRequirementWorkbook } from "@/app/lib/requirementImport";

async function libroDePrueba(filas: string[][]): Promise<ArrayBuffer> {
  const libro = new ExcelJS.Workbook();
  const hoja = libro.addWorksheet("Hoja1");
  for (const fila of filas) hoja.addRow(fila);
  const buffer = await libro.xlsx.writeBuffer();
  return buffer as ArrayBuffer;
}

const CABECERA = [
  "Norma",
  "Item",
  "Título del Requerimiento",
  "Descripción del Requerimiento",
  "Criterio de Aceptación",
];

describe("parseRoleTemplateRequirementWorkbook", () => {
  it("lee el criterio de aceptacion de la quinta columna", async () => {
    const buffer = await libroDePrueba([
      CABECERA,
      ["19650-1", "5.1", "PRINCIPIOS", "Descripcion", "Debe existir un BEP firmado."],
    ]);

    const resultado = await parseRoleTemplateRequirementWorkbook(buffer, "no_conforme");

    expect(resultado.errors).toEqual([]);
    expect(resultado.rows[0].criterioAceptacion).toBe("Debe existir un BEP firmado.");
  });

  it("deja el criterio a null cuando la celda esta vacia", async () => {
    const buffer = await libroDePrueba([
      CABECERA,
      ["19650-1", "5.1", "PRINCIPIOS", "Descripcion", ""],
    ]);

    const resultado = await parseRoleTemplateRequirementWorkbook(buffer, "no_conforme");

    expect(resultado.rows[0].criterioAceptacion).toBeNull();
  });

  it("sigue importando un libro sin la quinta columna", async () => {
    const buffer = await libroDePrueba([
      CABECERA.slice(0, 4),
      ["19650-1", "5.1", "PRINCIPIOS", "Descripcion"],
    ]);

    const resultado = await parseRoleTemplateRequirementWorkbook(buffer, "no_conforme");

    expect(resultado.errors).toEqual([]);
    expect(resultado.rows).toHaveLength(1);
    expect(resultado.rows[0].criterioAceptacion).toBeNull();
  });
});
