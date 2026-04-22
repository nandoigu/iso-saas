import * as XLSX from "xlsx";

export type RequirementStatus = "total" | "parcial" | "no_conforme";

export type ParsedRequirementTemplate = {
  norma: string;
  item: string;
  name: string;
  evidencia: string | null;
  defaultStatus: RequirementStatus;
  deadline: Date | null;
};

export type ImportParseResult = {
  rows: ParsedRequirementTemplate[];
  errors: string[];
  skippedDuplicates: number;
};

const REQUIRED_HEADERS = [
  "norma",
  "item",
  "requerimiento",
  "evidencia",
  "estado",
  "fecha_limite",
];

const VALID_STATUSES: RequirementStatus[] = ["total", "parcial", "no_conforme"];
const HEADER_ALIASES = {
  norma: ["norma"],
  item: ["item"],
  name: ["requerimiento", "descripcion", "descripción"],
  evidencia: ["evidencia"],
  status: ["estado", "cumplimiento"],
  deadline: ["fecha_limite", "fecha límite", "fecha"],
};

export function parseRequirementTemplateWorkbook(buffer: ArrayBuffer): ImportParseResult {
  const workbook = XLSX.read(buffer, {
    type: "array",
    cellDates: true,
  });

  const firstSheetName = workbook.SheetNames[0];

  if (!firstSheetName) {
    return {
      rows: [],
      errors: ["El archivo no contiene hojas."],
      skippedDuplicates: 0,
    };
  }

  const sheet = workbook.Sheets[firstSheetName];
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: null,
    raw: true,
  });

  if (matrix.length === 0) {
    return {
      rows: [],
      errors: ["El archivo esta vacio."],
      skippedDuplicates: 0,
    };
  }

  const headers = matrix[0].map((value) => String(value ?? "").trim());
  const headerErrors = validateHeaders(headers);
  const columnMap = getColumnMap(headers);

  if (headerErrors.length > 0) {
    return {
      rows: [],
      errors: headerErrors,
      skippedDuplicates: 0,
    };
  }

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

    const dedupeKey = `${norma.toLowerCase()}|${item.toLowerCase()}|${name.toLowerCase()}`;

    if (seen.has(dedupeKey)) {
      skippedDuplicates++;
      return;
    }

    seen.add(dedupeKey);
    rows.push({
      norma,
      item,
      name,
      evidencia,
      defaultStatus: statusResult.status,
      deadline: deadlineResult.date,
    });
  });

  if (rows.length === 0 && errors.length === 0) {
    errors.push("El archivo no contiene filas importables.");
  }

  return {
    rows,
    errors,
    skippedDuplicates,
  };
}

function validateHeaders(headers: string[]) {
  const normalized = headers.map((header) => header.trim().toLowerCase());

  if (normalized.length !== 6) {
    return [
      `El Excel debe tener exactamente ${REQUIRED_HEADERS.length} columnas: ${REQUIRED_HEADERS.join(", ")}.`,
    ];
  }

  const errors: string[] = [];

  const columnMap = getColumnMap(headers);

  Object.entries(columnMap).forEach(([key, index]) => {
    if (index === -1) {
      const aliases = HEADER_ALIASES[key as keyof typeof HEADER_ALIASES].join(" | ");
      errors.push(`Falta la columna ${key}. Valores admitidos: ${aliases}.`);
    }
  });

  return errors;
}

function getColumnMap(headers: string[]) {
  const normalized = headers.map((header) => normalizeHeader(header));

  return {
    norma: findHeaderIndex(normalized, HEADER_ALIASES.norma),
    item: findHeaderIndex(normalized, HEADER_ALIASES.item),
    name: findHeaderIndex(normalized, HEADER_ALIASES.name),
    evidencia: findHeaderIndex(normalized, HEADER_ALIASES.evidencia),
    status: findHeaderIndex(normalized, HEADER_ALIASES.status),
    deadline: findHeaderIndex(normalized, HEADER_ALIASES.deadline),
  };
}

function findHeaderIndex(headers: string[], aliases: string[]) {
  const normalizedAliases = aliases.map((alias) => normalizeHeader(alias));
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

function getRequiredString(value: unknown) {
  return String(value ?? "").trim();
}

function getOptionalString(value: unknown) {
  const text = String(value ?? "").trim();
  return text || null;
}

function parseStatus(value: unknown): { valid: true; status: RequirementStatus } | { valid: false; status: RequirementStatus } {
  const text = String(value ?? "").trim().toLowerCase();

  if (!text) {
    return { valid: true, status: "parcial" };
  }

  if (VALID_STATUSES.includes(text as RequirementStatus)) {
    return { valid: true, status: text as RequirementStatus };
  }

  return { valid: false, status: "no_conforme" };
}

function parseDeadline(value: unknown): { valid: true; date: Date | null } | { valid: false; date: null } {
  if (value === null || value === undefined || String(value).trim() === "") {
    return { valid: true, date: null };
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime())
      ? { valid: false, date: null }
      : { valid: true, date: value };
  }

  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value);

    if (!parsed) {
      return { valid: false, date: null };
    }

    return {
      valid: true,
      date: new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d)),
    };
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
