import { parseRoleTemplateRequirementWorkbook } from "@/app/lib/requirementImport";
import { prisma } from "@/lib/prisma";

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

export async function importTemplates(
  fileBuffer: Buffer,
  fileName: string
): Promise<ImportTemplatesResult> {
  const role = detectRoleFromFileName(fileName);
  const parsed = await parseRoleTemplateRequirementWorkbook(
    toArrayBuffer(fileBuffer),
    "no_conforme"
  );

  if (parsed.errors.length > 0) {
    throw new Error(parsed.errors.join(" "));
  }

  if (parsed.rows.length === 0) {
    throw new Error("El archivo no contiene filas validas para importar.");
  }

  const createResult = await prisma.requirementTemplate.createMany({
    data: parsed.rows.map((row) => ({
      norma: row.norma,
      item: row.item,
      titulo: row.titulo,
      descripcion: row.descripcion,
      role,
      name: row.titulo,
      evidencia: null,
      defaultStatus: "no_conforme",
      deadline: null,
    })),
    skipDuplicates: true,
  });

  return {
    inserted: createResult.count,
    skippedDuplicates:
      parsed.skippedDuplicates + (parsed.rows.length - createResult.count),
    totalRows: parsed.rows.length,
    role,
  };
}

function detectRoleFromFileName(fileName: string): TemplateRole {
  const normalized = normalizeText(fileName);

  if (
    normalized.includes("adjudicatario_principal") ||
    normalized.includes("principal")
  ) {
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

function toArrayBuffer(buffer: Buffer) {
  const arrayBuffer = new ArrayBuffer(buffer.byteLength);
  new Uint8Array(arrayBuffer).set(buffer);
  return arrayBuffer;
}

function normalizeText(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "_");
}
