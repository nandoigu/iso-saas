import { describe, it, expect } from "vitest";
import ExcelJS from "exceljs";
import {
  parseDocumentTemplateWorkbook,
  parseReferencias,
} from "@/app/lib/documentTemplateImport";

// Cabecera real del libro del experto (13-oct), con sus aclaraciones entre parentesis.
const CABECERA = [
  "Fichero",
  "Formato",
  "Nombre (corregir)",
  "Vigente",
  "Rol (uno o varios, separados por coma)",
  "Fase",
  "Obligatoria",
  "Tipo",
  "Requisitos que justifica (norma / item; separados por punto y coma)",
  "Observaciones",
];

// SYNTHETIC TEST DATA: ficheros y norma inventados, marcados como tales.
const FILA_VALIDA = [
  "SYNTHETIC-Acta.docx",
  "docx",
  "SYNTHETIC Acta",
  "sí",
  "adjudicatario, adjudicatario principal, adjudicador",
  "Movilización",
  "Si",
  "ambas",
  "ISO SYNTHETIC-19650-9/1.1;1.2, 1.3",
  "",
];

async function libro(filas: string[][], hoja = "Plantillas"): Promise<ArrayBuffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(hoja);
  for (const fila of filas) sheet.addRow(fila);
  return (await workbook.xlsx.writeBuffer()) as ArrayBuffer;
}

describe("parseDocumentTemplateWorkbook", () => {
  it("normaliza una fila valida", async () => {
    const resultado = await parseDocumentTemplateWorkbook(await libro([CABECERA, FILA_VALIDA]));

    expect(resultado.errors).toEqual([]);
    expect(resultado.rows).toEqual([
      {
        fila: 2,
        fichero: "SYNTHETIC-Acta.docx",
        nombre: "SYNTHETIC Acta",
        formato: "docx",
        vigente: true,
        roles: ["adjudicador", "adjudicatario_principal", "adjudicatario"],
        fase: "movilizacion",
        obligatoria: true,
        tipo: "ambas",
        referencias: [
          { norma: "SYNTHETIC-19650-9", item: "1.1" },
          { norma: "SYNTHETIC-19650-9", item: "1.2" },
          { norma: "SYNTHETIC-19650-9", item: "1.3" },
        ],
      },
    ]);
  });

  it("acepta requisitos vacios y vigente no", async () => {
    const fila = [...FILA_VALIDA];
    fila[3] = "NO";
    fila[8] = "";
    const resultado = await parseDocumentTemplateWorkbook(await libro([CABECERA, fila]));

    expect(resultado.errors).toEqual([]);
    expect(resultado.rows[0].vigente).toBe(false);
    expect(resultado.rows[0].referencias).toEqual([]);
  });

  it("ignora las filas vacias", async () => {
    const resultado = await parseDocumentTemplateWorkbook(
      await libro([CABECERA, FILA_VALIDA, ["", "", "", "", "", "", "", "", "", ""]])
    );
    expect(resultado.errors).toEqual([]);
    expect(resultado.rows).toHaveLength(1);
  });

  it("acumula los errores de todas las filas y no devuelve filas", async () => {
    const rolMalo = [...FILA_VALIDA];
    rolMalo[4] = "auditor";
    const faseMala = [...FILA_VALIDA];
    faseMala[0] = "SYNTHETIC-Otra.docx";
    faseMala[5] = "explotacion";

    const resultado = await parseDocumentTemplateWorkbook(
      await libro([CABECERA, FILA_VALIDA, rolMalo, faseMala])
    );

    expect(resultado.rows).toEqual([]);
    expect(resultado.errors.some((e) => e.startsWith("Fila 3:") && e.includes("auditor"))).toBe(true);
    expect(resultado.errors.some((e) => e.startsWith("Fila 4:") && e.includes("explotacion"))).toBe(true);
  });

  it.each(["../secreto.docx", "sub/a.docx", "sub\\a.docx"])(
    "rechaza un fichero con ruta: %s",
    async (fichero) => {
      const fila = [...FILA_VALIDA];
      fila[0] = fichero;
      const resultado = await parseDocumentTemplateWorkbook(await libro([CABECERA, fila]));
      expect(resultado.errors).toHaveLength(1);
      expect(resultado.errors[0]).toMatch(/^Fila 2: el fichero/);
    }
  );

  it("rechaza un formato que no coincide con la extension", async () => {
    const fila = [...FILA_VALIDA];
    fila[1] = "xlsx";
    const resultado = await parseDocumentTemplateWorkbook(await libro([CABECERA, fila]));
    expect(resultado.errors[0]).toMatch(/^Fila 2: el formato xlsx no coincide/);
  });

  it("rechaza un fichero repetido", async () => {
    const resultado = await parseDocumentTemplateWorkbook(
      await libro([CABECERA, FILA_VALIDA, FILA_VALIDA])
    );
    expect(resultado.errors).toEqual(["Fila 3: el fichero ya aparece en la fila 2."]);
  });

  it("exige la hoja Plantillas", async () => {
    const resultado = await parseDocumentTemplateWorkbook(await libro([CABECERA], "Hoja1"));
    expect(resultado.errors).toEqual(["El libro no tiene la hoja «Plantillas»."]);
  });

  it("exige todas las columnas", async () => {
    const resultado = await parseDocumentTemplateWorkbook(
      await libro([CABECERA.filter((c) => c !== "Fase"), FILA_VALIDA])
    );
    expect(resultado.errors).toEqual(["Faltan columnas en la hoja «Plantillas»: fase."]);
  });
});

describe("parseReferencias", () => {
  it("arrastra la norma y admite prefijo ISO y separadores mezclados", () => {
    expect(parseReferencias("ISO 19650-2/5.3.1;5.6.3, 5.6.5; 19650-1/4.1")).toEqual({
      referencias: [
        { norma: "19650-2", item: "5.3.1" },
        { norma: "19650-2", item: "5.6.3" },
        { norma: "19650-2", item: "5.6.5" },
        { norma: "19650-1", item: "4.1" },
      ],
    });
  });

  it("falla si la primera referencia no lleva norma", () => {
    expect(parseReferencias("5.3.1")).toEqual({
      error: "la referencia «5.3.1» no indica la norma (por ejemplo, 19650-2/5.3.1).",
    });
  });

  it("devuelve lista vacia para texto vacio", () => {
    expect(parseReferencias("  ")).toEqual({ referencias: [] });
  });
});
