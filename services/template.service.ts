import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma";

const REQUIRED_FIELDS = ["norma", "item", "titulo", "descripcion"] as const;
const HEADER_ALIASES = {
  norma: ["norma"],
  item: ["item"],
  titulo: ["titulo", "título", "titulo_del_requerimiento", "título_del_requerimiento"],
  descripcion: ["descripcion", "descripción", "descripcion_del_requerimiento", "descripción_del_requerimiento"],
  fase: ["fase"],
} as const;

export type TemplateRole =
  | "adjudicador"
  | "adjudicatario_principal"
  | "adjudicatario";

export type ImportTemplatesResult = {
  inserted: number;
  skippedDuplicates: number;
  totalRows: number;
  role: TemplateRole;
};

type ParsedTemplateRow = {
  norma: string;
  item: string;
  titulo: string;
  descripcion: string;
  role: TemplateRole;
};

export async function importTemplates(
  fileBuffer: Buffer,
  fileName: string
): Promise<ImportTemplatesResult> {
  const role = detectRoleFromFileName(fileName);
  const workbook = XLSX.read(fileBuffer, {
    type: "buffer",
    cellDates: false,
  });

  const firstSheetName = workbook.SheetNames[0];

  if (!firstSheetName) {
    throw new Error("El archivo no contiene hojas.");
  }

  const sheet = workbook.Sheets[firstSheetName];
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: "",
    raw: false,
  });

  if (matrix.length === 0) {
    throw new Error("El archivo esta vacio.");
  }

  const headers = normalizeHeaderRow(matrix[0]);
  const columnMap = getColumnMap(headers);

  if (!hasRequiredHeaders(columnMap)) {
    throw new Error(
      "Las columnas del Excel deben incluir: norma, item, titulo y descripcion."
    );
  }

  const rows = matrix
    .slice(1)
    .map((row) => toParsedRow(row, role, columnMap))
    .filter((row): row is ParsedTemplateRow => Boolean(row));

  if (rows.length === 0) {
    throw new Error("El archivo no contiene filas validas para importar.");
  }

  const uniqueRows = dedupeRows(rows);

  const createResult = await prisma.requirementTemplate.createMany({
    data: uniqueRows.map((row) => ({
      norma: row.norma,
      item: row.item,
      titulo: row.titulo,
      descripcion: row.descripcion,
      role: row.role,
      name: row.titulo,
      evidencia: null,
      defaultStatus: "no_conforme",
      deadline: null,
    })),
    skipDuplicates: true,
  });

  return {
    inserted: createResult.count,
    skippedDuplicates: uniqueRows.length - createResult.count,
    totalRows: uniqueRows.length,
    role,
  };
}

function detectRoleFromFileName(fileName: string): TemplateRole {
  const normalized = normalizeText(fileName);

  if (normalized.includes("adjudicatario_principal") || normalized.includes("principal")) {
    return "adjudicatario_principal";
  }

  if (normalized.includes("adjudicador")) {
    return "adjudicador";
  }

  if (normalized.includes("adjudicatario")) {
    return "adjudicatario";
  }

  throw new Error(
    "No se pudo detectar el rol a partir del nombre del archivo."
  );
}

function normalizeHeaderRow(row: unknown[]) {
  return row.map((value) => normalizeText(String(value ?? "")));
}

function getColumnMap(headers: string[]) {
  return {
    norma: findHeaderIndex(headers, HEADER_ALIASES.norma),
    item: findHeaderIndex(headers, HEADER_ALIASES.item),
    titulo: findHeaderIndex(headers, HEADER_ALIASES.titulo),
    descripcion: findHeaderIndex(headers, HEADER_ALIASES.descripcion),
    fase: findHeaderIndex(headers, HEADER_ALIASES.fase),
  };
}

function hasRequiredHeaders(columnMap: ReturnType<typeof getColumnMap>) {
  return REQUIRED_FIELDS.every((field) => columnMap[field] !== -1);
}

function findHeaderIndex(headers: string[], aliases: readonly string[]) {
  const normalizedAliases = aliases.map(normalizeText);
  return headers.findIndex((header) => normalizedAliases.includes(header));
}

function toParsedRow(
  row: unknown[],
  role: TemplateRole,
  columnMap: ReturnType<typeof getColumnMap>
): ParsedTemplateRow | null {
  const norma = normalizeCell(row[columnMap.norma]);
  const item = normalizeCell(row[columnMap.item]);
  const titulo = normalizeCell(row[columnMap.titulo]);
  const descripcion = normalizeCell(row[columnMap.descripcion]);

  if (isEmptyRow([norma, item, titulo, descripcion])) {
    return null;
  }

  if (!titulo) {
    return null;
  }

  if (isSeparatorRow({ norma, item, titulo, descripcion })) {
    return null;
  }

  return {
    norma,
    item,
    titulo,
    descripcion,
    role,
  };
}

function normalizeCell(value: unknown) {
  return String(value ?? "").trim();
}

function normalizeText(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "_");
}

function isEmptyRow(values: string[]) {
  return values.every((value) => value.trim() === "");
}

function isSeparatorRow(row: {
  norma: string;
  item: string;
  titulo: string;
  descripcion: string;
}) {
  const titulo = row.titulo.trim();
  const descripcion = row.descripcion.trim();
  const item = row.item.trim();

  if (!titulo) {
    return true;
  }

  if (descripcion) {
    return false;
  }

  return (
    /^une\s+en\s+iso/i.test(titulo) ||
    /^iso\s*\d+/i.test(titulo) ||
    /^anexo\b/i.test(titulo) ||
    /^capitulo\b/i.test(normalizeText(titulo).replaceAll("_", " ")) ||
    (!item && titulo === row.norma.trim())
  );
}

function dedupeRows(rows: ParsedTemplateRow[]) {
  const seen = new Set<string>();

  return rows.filter((row) => {
    const key = [
      row.norma.toLowerCase(),
      row.item.toLowerCase(),
      row.titulo.toLowerCase(),
      row.descripcion.toLowerCase(),
      row.role,
    ].join("|");

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}
