import { mkdtemp, writeFile } from "fs/promises";
import os from "os";
import path from "path";
import { prisma } from "@/app/lib/prisma";

// SYNTHETIC TEST DATA. Nada de lo que crean estos helpers es contenido normativo real.
export const SYNTHETIC_PREFIX = "SYNTHETIC-";
export const SYNTHETIC_NORMA = "SYNTHETIC-19650-9";

export async function createSyntheticTemplatesDir(ficheros: string[]) {
  const dir = await mkdtemp(path.join(os.tmpdir(), "plantillas-"));
  for (const fichero of ficheros) {
    await writeFile(path.join(dir, fichero), `SYNTHETIC TEST DATA ${fichero}`);
  }
  return dir;
}

export async function createSyntheticRequirementTemplate(item: string, role: string) {
  return prisma.requirementTemplate.create({
    data: {
      norma: SYNTHETIC_NORMA,
      item,
      name: `SYNTHETIC TEST DATA ${item}`,
      titulo: `SYNTHETIC TEST DATA ${item}`,
      descripcion: `SYNTHETIC TEST DATA ${item} ${role}`,
      role,
      defaultStatus: "no_conforme",
    },
  });
}

export async function createSyntheticDocumentTemplate(
  createdBy: string,
  overrides: {
    fichero: string;
    nombre?: string;
    formato?: string;
    vigente?: boolean;
    roles?: string[];
    fase?: string;
    obligatoria?: boolean;
    tipo?: string;
  }
) {
  return prisma.documentTemplate.create({
    data: {
      fichero: overrides.fichero,
      nombre: overrides.nombre ?? `SYNTHETIC TEST DATA ${overrides.fichero}`,
      formato: overrides.formato ?? "docx",
      vigente: overrides.vigente ?? true,
      roles: overrides.roles ?? ["adjudicatario"],
      fase: overrides.fase ?? "oferta",
      obligatoria: overrides.obligatoria ?? true,
      tipo: overrides.tipo ?? "ambas",
      createdBy,
    },
  });
}

// Unico codigo, junto a scripts/clean-test-tenants.mjs, que borra plantillas. Tiene que
// correr antes de cleanupTenant: createdBy e importedBy son Restrict hacia User.
export async function cleanupSyntheticDocumentTemplates() {
  // Versiones y vinculos caen en cascada.
  await prisma.documentTemplate.deleteMany({
    where: { fichero: { startsWith: SYNTHETIC_PREFIX } },
  });
}

export async function cleanupSyntheticRequirementTemplates() {
  await prisma.documentTemplateRequirement.deleteMany({
    where: { requirementTemplate: { norma: SYNTHETIC_NORMA } },
  });
  await prisma.requirementTemplate.deleteMany({ where: { norma: SYNTHETIC_NORMA } });
}
