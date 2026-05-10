import ExcelJS from "exceljs";

export type RequirementStatus = "total" | "parcial" | "no_conforme";
export type RequirementWorkbookFormat = "project-detailed" | "role-template";

export type ParsedRequirementTemplate = {
  norma: string;
  item: string;
  name: string;
  titulo: string;
  descripcion: string;
  evidencia: string | null;
  defaultStatus: RequirementStatus;
  deadline: Date | null;
};

export type ImportParseResult = {
  format: RequirementWorkbookFormat;
  rows: ParsedRequirementTemplate[];
  errors: string[];
  skippedDuplicates: number;
};

type ParseWorkbookOptions = {
  acceptedFormats?: RequirementWorkbookFormat[];
  roleTemplateFallbackStatus?: RequirementStatus;
};

const DETAILED_FORMAT_HEADERS = [
  "norma",
  "item",
  "requerimiento",
  "evidencia",
  "estado",
  "fecha_limite",
] as const;

const ROLE_TEMPLATE_HEADERS = ["norma", "item", "titulo", "descripcion"] as const;
const VALID_STATUSES: RequirementStatus[] = ["total", "parcial", "no_conforme"];
const MAX_WORKBOOK_ROWS = 2000;
const MAX_WORKBOOK_COLUMNS = 50;
const MAX_CELL_TEXT_LENGTH = 10000;

const HEADER_ALIASES = {
  norma: ["norma"],
  item: ["item"],
  detailedName: ["requerimiento", "descripcion", "descripción"],
  evidencia: ["evidencia"],
  status: ["estado", "cumplimiento"],
  deadline: ["fecha_limite", "fecha límite", "fecha", "fecha_limite"],
  titulo: [
    "titulo",
    "título",
    "titulo del requerimiento",
    "título del requerimiento",
    "titulo_del_requerimiento",
    "título_del_requerimiento",
  ],
  descripcion: [
    "descripcion",
    "descripción",
    "descripcion del requerimiento",
    "descripción del requerimiento",
    "descripcion_del_requerimiento",
    "descripción_del_requerimiento",
  ],
  fase: ["fase"],
} as const;

export async function parseRequirementWorkbook(
  buffer: ArrayBuffer,
  options: ParseWorkbookOptions = {}
): Promise<ImportParseResult> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  const firstSheet = workbook.worksheets[0];

  if (!firstSheet) {
    return emptyResult(
      options.acceptedFormats?.[0] ?? "project-detailed",
      "El archivo no contiene hojas."
    );
  }

  const matrix = worksheetToMatrix(firstSheet);

  if (matrix.length === 0) {
    return emptyResult(
      options.acceptedFormats?.[0] ?? "project-detailed",
      "El archivo esta vacio."
    );
  }

  const sizeError = validateWorkbookMatrix(matrix);

  if (sizeError) {
    return emptyResult(options.acceptedFormats?.[0] ?? "project-detailed", sizeError);
  }

  const headers = matrix[0].map((value) => String(value ?? "").trim());
  const detection = detectWorkbookFormat(headers, options.acceptedFormats);

  if (!detection.format) {
    return {
      format: options.acceptedFormats?.[0] ?? "project-detailed",
      rows: [],
      errors: [detection.error || buildUnsupportedFormatMessage(options.acceptedFormats)],
      skippedDuplicates: 0,
    };
  }

  if (detection.format === "project-detailed") {
    return parseDetailedWorkbook(matrix, detection.format);
  }

  return parseRoleTemplateWorkbook(
    matrix,
    detection.format,
    options.roleTemplateFallbackStatus ?? "parcial"
  );
}

export async function parseRequirementTemplateWorkbook(
  buffer: ArrayBuffer
): Promise<ImportParseResult> {
  return parseRequirementWorkbook(buffer, {
    acceptedFormats: ["project-detailed"],
  });
}

export async function parseRoleTemplateRequirementWorkbook(
  buffer: ArrayBuffer,
  fallbackStatus: RequirementStatus = "no_conforme"
): Promise<ImportParseResult> {
  return parseRequirementWorkbook(buffer, {
    acceptedFormats: ["role-template"],
    roleTemplateFallbackStatus: fallbackStatus,
  });
}

function parseDetailedWorkbook(
  matrix: unknown[][],
  format: RequirementWorkbookFormat
): ImportParseResult {
  const headers = matrix[0].map((value) => String(value ?? "").trim());
  const columnMap = getDetailedColumnMap(headers);
  const rows: ParsedRequirementTemplate[] = [];
  const errors: string[] = [];
  const seen = new Set<string>();
  let skippedDuplicates = 0;
  let currentNorma = "";
  let currentItem = "";

  matrix.slice(1).forEach((row, index) => {
    const rowNumber = index + 2;

    if (isEmptyRow(row)) {
      return;
    }

    const explicitNorma = getRequiredString(row[columnMap.norma]);
    const explicitItem = getRequiredString(row[columnMap.item]);
    const name = getRequiredString(row[columnMap.name]);
    const evidencia = getOptionalString(row[columnMap.evidencia]);
    const statusResult = parseStatus(row[columnMap.status]);
    const deadlineResult = parseDeadline(row[columnMap.deadline]);

    if (explicitNorma) {
      currentNorma = explicitNorma;
    }

    if (explicitItem || explicitNorma) {
      currentItem = explicitItem;
    }

    const norma = explicitNorma || currentNorma;
    const item = explicitItem || currentItem;

    if (!norma) errors.push(`Fila ${rowNumber}: norma es obligatoria.`);
    if (!item) errors.push(`Fila ${rowNumber}: item es obligatorio.`);
    if (!name) errors.push(`Fila ${rowNumber}: requerimiento es obligatorio.`);
    if (!statusResult.valid) {
      errors.push(
        `Fila ${rowNumber}: estado debe ser total, parcial o no_conforme.`
      );
    }
    if (!deadlineResult.valid) {
      errors.push(`Fila ${rowNumber}: fecha_limite debe tener formato YYYY-MM-DD.`);
    }

    if (!norma || !item || !name || !statusResult.valid || !deadlineResult.valid) {
      return;
    }

    const dedupeKey = buildRowKey({
      norma,
      item,
      titulo: name,
      descripcion: name,
    });

    if (seen.has(dedupeKey)) {
      skippedDuplicates++;
      return;
    }

    seen.add(dedupeKey);
    rows.push({
      norma,
      item,
      name,
      titulo: name,
      descripcion: name,
      evidencia,
      defaultStatus: statusResult.status,
      deadline: deadlineResult.date,
    });
  });

  if (rows.length === 0 && errors.length === 0) {
    errors.push("El archivo no contiene filas importables.");
  }

  return {
    format,
    rows,
    errors,
    skippedDuplicates,
  };
}

function parseRoleTemplateWorkbook(
  matrix: unknown[][],
  format: RequirementWorkbookFormat,
  fallbackStatus: RequirementStatus
): ImportParseResult {
  const headers = matrix[0].map((value) => String(value ?? "").trim());
  const columnMap = getRoleTemplateColumnMap(headers);
  const rows: ParsedRequirementTemplate[] = [];
  const errors: string[] = [];
  const seen = new Set<string>();
  let skippedDuplicates = 0;
  let currentNorma = "";
  let currentItem = "";

  matrix.slice(1).forEach((row, index) => {
    const rowNumber = index + 2;

    if (isEmptyRow(row)) {
      return;
    }

    const explicitNorma = getRequiredString(row[columnMap.norma]);
    const explicitItem = getRequiredString(row[columnMap.item]);
    const titulo = getRequiredString(row[columnMap.titulo]);
    const descripcion = getRequiredString(row[columnMap.descripcion]);

    if (explicitNorma) {
      currentNorma = explicitNorma;
    }

    if (explicitItem || explicitNorma) {
      currentItem = explicitItem;
    }

    const norma = explicitNorma || currentNorma;
    const item = explicitItem || currentItem;

    if (isSeparatorRow({ norma, item, titulo, descripcion })) {
      return;
    }

    if (!norma) errors.push(`Fila ${rowNumber}: norma es obligatoria.`);
    if (!item) errors.push(`Fila ${rowNumber}: item es obligatorio.`);
    if (!titulo) errors.push(`Fila ${rowNumber}: titulo es obligatorio.`);

    if (!norma || !item || !titulo) {
      return;
    }

    const dedupeKey = buildRowKey({
      norma,
      item,
      titulo,
      descripcion,
    });

    if (seen.has(dedupeKey)) {
      skippedDuplicates++;
      return;
    }

    seen.add(dedupeKey);
    rows.push({
      norma,
      item,
      name: titulo,
      titulo,
      descripcion,
      evidencia: null,
      defaultStatus: fallbackStatus,
      deadline: null,
    });
  });

  if (rows.length === 0 && errors.length === 0) {
    errors.push("El archivo no contiene filas importables.");
  }

  return {
    format,
    rows,
    errors,
    skippedDuplicates,
  };
}

function detectWorkbookFormat(
  headers: string[],
  acceptedFormats: RequirementWorkbookFormat[] = [
    "project-detailed",
    "role-template",
  ]
) {
  const normalized = headers.map(normalizeHeader);
  const detailedColumnMap = getDetailedColumnMap(headers);
  const roleColumnMap = getRoleTemplateColumnMap(headers);

  const detailedValid = hasDetailedHeaders(detailedColumnMap);
  const roleValid = hasRoleHeaders(roleColumnMap);

  if (acceptedFormats.includes("project-detailed") && detailedValid) {
    return { format: "project-detailed" as const };
  }

  if (acceptedFormats.includes("role-template") && roleValid) {
    return { format: "role-template" as const };
  }

  const normalizedHeaders = normalized.join(", ");
  return {
    format: null,
    error: buildUnsupportedFormatMessage(acceptedFormats, normalizedHeaders),
  };
}

function buildUnsupportedFormatMessage(
  acceptedFormats: RequirementWorkbookFormat[] = [
    "project-detailed",
    "role-template",
  ],
  normalizedHeaders?: string
) {
  const formats: string[] = [];

  if (acceptedFormats.includes("project-detailed")) {
    formats.push(
      `Formato proyecto: ${DETAILED_FORMAT_HEADERS.join(", ")}`
    );
  }

  if (acceptedFormats.includes("role-template")) {
    formats.push(
      `Formato plantilla por rol: ${ROLE_TEMPLATE_HEADERS.join(", ")} (fase opcional)`
    );
  }

  return normalizedHeaders
    ? `Cabeceras no reconocidas (${normalizedHeaders}). ${formats.join(" | ")}`
    : formats.join(" | ");
}

function getDetailedColumnMap(headers: string[]) {
  const normalized = headers.map(normalizeHeader);

  return {
    norma: findHeaderIndex(normalized, HEADER_ALIASES.norma),
    item: findHeaderIndex(normalized, HEADER_ALIASES.item),
    name: findHeaderIndex(normalized, HEADER_ALIASES.detailedName),
    evidencia: findHeaderIndex(normalized, HEADER_ALIASES.evidencia),
    status: findHeaderIndex(normalized, HEADER_ALIASES.status),
    deadline: findHeaderIndex(normalized, HEADER_ALIASES.deadline),
  };
}

function getRoleTemplateColumnMap(headers: string[]) {
  const normalized = headers.map(normalizeHeader);

  return {
    norma: findHeaderIndex(normalized, HEADER_ALIASES.norma),
    item: findHeaderIndex(normalized, HEADER_ALIASES.item),
    titulo: findHeaderIndex(normalized, HEADER_ALIASES.titulo),
    descripcion: findHeaderIndex(normalized, HEADER_ALIASES.descripcion),
    fase: findHeaderIndex(normalized, HEADER_ALIASES.fase),
  };
}

function hasDetailedHeaders(columnMap: ReturnType<typeof getDetailedColumnMap>) {
  return (
    columnMap.norma !== -1 &&
    columnMap.item !== -1 &&
    columnMap.name !== -1 &&
    columnMap.evidencia !== -1 &&
    columnMap.status !== -1 &&
    columnMap.deadline !== -1
  );
}

function hasRoleHeaders(columnMap: ReturnType<typeof getRoleTemplateColumnMap>) {
  return (
    columnMap.norma !== -1 &&
    columnMap.item !== -1 &&
    columnMap.titulo !== -1 &&
    columnMap.descripcion !== -1
  );
}

function findHeaderIndex(headers: string[], aliases: readonly string[]) {
  const normalizedAliases = aliases.map(normalizeHeader);
  return headers.findIndex((header) => normalizedAliases.includes(header));
}

function normalizeHeader(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function isEmptyRow(row: unknown[]) {
  return row.every((value) => String(value ?? "").trim() === "");
}

function validateWorkbookMatrix(matrix: unknown[][]) {
  if (matrix.length > MAX_WORKBOOK_ROWS) {
    return `El archivo supera el limite de ${MAX_WORKBOOK_ROWS} filas importables.`;
  }

  for (let rowIndex = 0; rowIndex < matrix.length; rowIndex += 1) {
    const row = matrix[rowIndex];

    if (row.length > MAX_WORKBOOK_COLUMNS) {
      return `La fila ${rowIndex + 1} supera el limite de ${MAX_WORKBOOK_COLUMNS} columnas.`;
    }

    for (const cell of row) {
      if (String(cell ?? "").length > MAX_CELL_TEXT_LENGTH) {
        return `La fila ${rowIndex + 1} contiene una celda demasiado larga.`;
      }
    }
  }

  return null;
}

function getRequiredString(value: unknown) {
  return String(value ?? "").trim();
}

function getOptionalString(value: unknown) {
  const text = String(value ?? "").trim();
  return text || null;
}

function parseStatus(
  value: unknown
): { valid: true; status: RequirementStatus } | { valid: false; status: RequirementStatus } {
  const text = String(value ?? "").trim().toLowerCase();

  if (!text) {
    return { valid: true, status: "parcial" };
  }

  if (VALID_STATUSES.includes(text as RequirementStatus)) {
    return { valid: true, status: text as RequirementStatus };
  }

  return { valid: false, status: "no_conforme" };
}

function parseDeadline(
  value: unknown
): { valid: true; date: Date | null } | { valid: false; date: null } {
  if (value === null || value === undefined || String(value).trim() === "") {
    return { valid: true, date: null };
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime())
      ? { valid: false, date: null }
      : { valid: true, date: value };
  }

  if (typeof value === "number") {
    const parsed = parseExcelDateSerial(value);

    if (!parsed) {
      return { valid: false, date: null };
    }

    return { valid: true, date: parsed };
  }

  const text = String(value).trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return { valid: false, date: null };
  }

  const date = new Date(`${text}T00:00:00.000Z`);

  return Number.isNaN(date.getTime())
    ? { valid: false, date: null }
    : { valid: true, date };
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
    /^capitulo\b/i.test(
      normalizeHeader(titulo).replaceAll("_", " ")
    ) ||
    (!item && titulo === row.norma.trim())
  );
}

function buildRowKey(row: {
  norma: string;
  item: string;
  titulo: string;
  descripcion: string;
}) {
  return [row.norma, row.item, row.titulo, row.descripcion]
    .map((value) => value.trim().toLowerCase())
    .join("|");
}

function emptyResult(format: RequirementWorkbookFormat, error: string): ImportParseResult {
  return {
    format,
    rows: [],
    errors: [error],
    skippedDuplicates: 0,
  };
}

function worksheetToMatrix(worksheet: ExcelJS.Worksheet) {
  const matrix: unknown[][] = [];
  const rowCount = Math.min(worksheet.rowCount, MAX_WORKBOOK_ROWS + 1);
  const columnCount = Math.min(worksheet.columnCount, MAX_WORKBOOK_COLUMNS + 1);

  for (let rowNumber = 1; rowNumber <= rowCount; rowNumber += 1) {
    const row = worksheet.getRow(rowNumber);
    const values: unknown[] = [];

    for (let columnNumber = 1; columnNumber <= columnCount; columnNumber += 1) {
      values.push(normalizeCellValue(row.getCell(columnNumber).value));
    }

    while (values.length > 0 && values[values.length - 1] == null) {
      values.pop();
    }

    matrix.push(values);
  }

  return matrix;
}

function normalizeCellValue(value: ExcelJS.CellValue): unknown {
  if (value == null) return null;
  if (value instanceof Date) return value;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (isFormulaValue(value)) {
    return normalizeCellValue(value.result ?? null);
  }

  if (isRichTextValue(value)) {
    return value.richText.map((part) => part.text).join("");
  }

  if (isHyperlinkValue(value)) {
    return value.text;
  }

  if (hasTextValue(value)) {
    return value.text;
  }

  return String(value);
}

function isFormulaValue(
  value: ExcelJS.CellValue
): value is ExcelJS.CellFormulaValue {
  return typeof value === "object" && value !== null && "formula" in value;
}

function isRichTextValue(
  value: ExcelJS.CellValue
): value is ExcelJS.CellRichTextValue {
  return typeof value === "object" && value !== null && "richText" in value;
}

function isHyperlinkValue(
  value: ExcelJS.CellValue
): value is ExcelJS.CellHyperlinkValue {
  return typeof value === "object" && value !== null && "hyperlink" in value;
}

function hasTextValue(
  value: ExcelJS.CellValue
): value is ExcelJS.CellValue & { text: string } {
  return (
    typeof value === "object" &&
    value !== null &&
    "text" in value &&
    typeof value.text === "string"
  );
}

function parseExcelDateSerial(serial: number) {
  if (!Number.isFinite(serial) || serial <= 0) return null;

  const milliseconds = Math.round((serial - 25569) * 86400 * 1000);
  const date = new Date(milliseconds);

  return Number.isNaN(date.getTime()) ? null : date;
}
