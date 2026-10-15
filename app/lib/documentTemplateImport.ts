import ExcelJS from "exceljs";
import {
  FASES_ORDEN,
  FORMATOS,
  PROJECT_ROLES,
  TIPOS,
  type ParsedDocumentTemplateRow,
  type ProjectRole,
} from "@/services/document-template.types";

// Parser puro del libro plantillas_documentales.xlsx (ADR-016 D2). No toca la base:
// la existencia del fichero y la resolucion de requisitos son del servicio.

export const DOCUMENT_TEMPLATE_SHEET = "Plantillas";

// Mismos limites que requirementImport.ts (security-spec).
const MAX_WORKBOOK_ROWS = 2000;
const MAX_WORKBOOK_COLUMNS = 50;
const MAX_CELL_TEXT_LENGTH = 10000;

// Cabecera normalizada (sin tildes, minusculas, sin el texto entre parentesis).
const COLUMNAS = {
  fichero: "fichero",
  formato: "formato",
  nombre: "nombre",
  vigente: "vigente",
  rol: "rol",
  fase: "fase",
  obligatoria: "obligatoria",
  tipo: "tipo",
  requisitos: "requisitos que justifica",
} as const;
type Columna = keyof typeof COLUMNAS;
const NOMBRES_COLUMNA = Object.keys(COLUMNAS) as Columna[];

export type DocumentTemplateParseResult = {
  rows: ParsedDocumentTemplateRow[];
  errors: string[];
};

export function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export async function parseDocumentTemplateWorkbook(
  buffer: ArrayBuffer
): Promise<DocumentTemplateParseResult> {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer);
  } catch {
    return fallo("No se pudo leer el libro.");
  }

  const sheet = workbook.getWorksheet(DOCUMENT_TEMPLATE_SHEET);
  if (!sheet) return fallo(`El libro no tiene la hoja «${DOCUMENT_TEMPLATE_SHEET}».`);
  if (sheet.rowCount > MAX_WORKBOOK_ROWS + 1) {
    return fallo(`La hoja «${DOCUMENT_TEMPLATE_SHEET}» supera las ${MAX_WORKBOOK_ROWS} filas.`);
  }
  if (sheet.columnCount > MAX_WORKBOOK_COLUMNS) {
    return fallo(`La hoja «${DOCUMENT_TEMPLATE_SHEET}» supera las ${MAX_WORKBOOK_COLUMNS} columnas.`);
  }

  const indices: Partial<Record<Columna, number>> = {};
  sheet.getRow(1).eachCell((cell, columna) => {
    const clave = normalizeText(cell.text).split("(")[0].trim();
    for (const nombre of NOMBRES_COLUMNA) {
      if (clave === COLUMNAS[nombre] && indices[nombre] === undefined) indices[nombre] = columna;
    }
  });
  const faltan = NOMBRES_COLUMNA.filter((c) => indices[c] === undefined);
  if (faltan.length > 0) {
    return fallo(`Faltan columnas en la hoja «${DOCUMENT_TEMPLATE_SHEET}»: ${faltan.join(", ")}.`);
  }

  const rows: ParsedDocumentTemplateRow[] = [];
  const errors: string[] = [];
  const vistos = new Map<string, number>();

  for (let n = 2; n <= sheet.rowCount; n++) {
    const row = sheet.getRow(n);
    const leer = (c: Columna) => row.getCell(indices[c]!).text.trim();
    const valores = NOMBRES_COLUMNA.map(leer);

    if (valores.every((v) => v === "")) continue;
    if (valores.some((v) => v.length > MAX_CELL_TEXT_LENGTH)) {
      errors.push(`Fila ${n}: una celda supera los ${MAX_CELL_TEXT_LENGTH} caracteres.`);
      continue;
    }

    const resultado = parseFila(n, leer);
    if ("errores" in resultado) {
      errors.push(...resultado.errores);
      continue;
    }

    const previa = vistos.get(resultado.fila.fichero);
    if (previa !== undefined) {
      errors.push(`Fila ${n}: el fichero ya aparece en la fila ${previa}.`);
      continue;
    }
    vistos.set(resultado.fila.fichero, n);
    rows.push(resultado.fila);
  }

  return { rows: errors.length > 0 ? [] : rows, errors };
}

function parseFila(
  n: number,
  leer: (c: Columna) => string
): { fila: ParsedDocumentTemplateRow } | { errores: string[] } {
  const errores: string[] = [];
  const error = (mensaje: string) => errores.push(`Fila ${n}: ${mensaje}`);

  const fichero = leer("fichero").normalize("NFC");
  if (!fichero) {
    error("falta el fichero.");
  } else if (/[\\/]|\.\.|[\u0000-\u001f\u007f]/.test(fichero)) {
    error(`el fichero «${fichero}» no puede contener rutas ni caracteres de control.`);
  }

  const formato = normalizeText(leer("formato"));
  if (!esUno(FORMATOS, formato)) {
    error(`formato «${leer("formato")}» no válido (docx o xlsx).`);
  } else if (fichero && !fichero.toLowerCase().endsWith(`.${formato}`)) {
    error(`el formato ${formato} no coincide con la extensión de «${fichero}».`);
  }

  const nombre = leer("nombre").replace(/\s+/g, " ");
  if (!nombre) error("falta el nombre.");

  const vigente = siNo(leer("vigente"));
  if (vigente === null) error(`Vigente debe ser «sí» o «no» (hay «${leer("vigente")}»).`);

  const obligatoria = siNo(leer("obligatoria"));
  if (obligatoria === null) error(`Obligatoria debe ser «sí» o «no» (hay «${leer("obligatoria")}»).`);

  const roles: ProjectRole[] = [];
  const partesRol = leer("rol").split(",").map(normalizeText).filter(Boolean);
  if (partesRol.length === 0) error("falta el rol.");
  for (const parte of partesRol) {
    const rol = parte.replace(/ /g, "_");
    if (!esUno(PROJECT_ROLES, rol)) error(`rol «${parte}» no válido.`);
    else if (!roles.includes(rol)) roles.push(rol);
  }
  roles.sort((a, b) => PROJECT_ROLES.indexOf(a) - PROJECT_ROLES.indexOf(b));

  const fase = normalizeText(leer("fase"));
  if (!esUno(FASES_ORDEN, fase)) error(`fase «${leer("fase")}» no válida.`);

  const tipo = normalizeText(leer("tipo"));
  if (!esUno(TIPOS, tipo)) error(`tipo «${leer("tipo")}» no válido (iso, administrativa o ambas).`);

  const referencias = parseReferencias(leer("requisitos"));
  if ("error" in referencias) error(referencias.error);

  if (errores.length > 0 || "error" in referencias) return { errores };

  return {
    fila: {
      fila: n,
      fichero,
      nombre,
      formato: formato as ParsedDocumentTemplateRow["formato"],
      vigente: vigente!,
      roles,
      fase: fase as ParsedDocumentTemplateRow["fase"],
      obligatoria: obligatoria!,
      tipo: tipo as ParsedDocumentTemplateRow["tipo"],
      referencias: referencias.referencias,
    },
  };
}

/**
 * Lee «ISO 19650-2/5.3.1;5.6.3, 5.6.5». Separador `;` o `,`, prefijo ISO opcional y la
 * norma se arrastra a las referencias siguientes que no la repiten (usuario, 13-oct).
 */
export function parseReferencias(
  texto: string
): { referencias: { norma: string; item: string }[] } | { error: string } {
  const referencias: { norma: string; item: string }[] = [];
  let norma: string | null = null;

  for (const trozo of texto.split(/[;,]/).map((t) => t.trim()).filter(Boolean)) {
    const sinPrefijo = trozo.replace(/^iso\s*/i, "");
    const barra = sinPrefijo.indexOf("/");
    let item: string;
    if (barra >= 0) {
      norma = sinPrefijo.slice(0, barra).trim();
      item = sinPrefijo.slice(barra + 1).trim();
    } else {
      item = sinPrefijo;
    }

    if (!norma) {
      return { error: `la referencia «${trozo}» no indica la norma (por ejemplo, 19650-2/5.3.1).` };
    }
    if (!item || item.includes("/")) {
      return { error: `la referencia «${trozo}» no tiene un ítem válido.` };
    }
    const actual = norma;
    if (!referencias.some((r) => r.norma === actual && r.item === item)) {
      referencias.push({ norma: actual, item });
    }
  }

  return { referencias };
}

function esUno<T extends string>(valores: readonly T[], valor: string): valor is T {
  return (valores as readonly string[]).includes(valor);
}

function siNo(valor: string): boolean | null {
  const normalizado = normalizeText(valor);
  if (normalizado === "si") return true;
  if (normalizado === "no") return false;
  return null;
}

function fallo(mensaje: string): DocumentTemplateParseResult {
  return { rows: [], errors: [mensaje] };
}
