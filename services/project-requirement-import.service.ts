import type { ParsedRequirementTemplate } from "@/app/lib/requirementImport";
import { prisma } from "@/app/lib/prisma";

export type ImportProjectRequirementsResult = {
  imported: number;
  skippedDuplicates: number;
  totalRows: number;
};

export async function importRequirementsForProject(
  projectId: string,
  rows: ParsedRequirementTemplate[]
): Promise<ImportProjectRequirementsResult> {
  if (rows.length === 0) {
    return {
      imported: 0,
      skippedDuplicates: 0,
      totalRows: 0,
    };
  }

  const existingRequirements = await prisma.requirement.findMany({
    where: {
      projectId,
    },
    select: {
      norma: true,
      item: true,
      name: true,
      titulo: true,
      descripcion: true,
    },
  });

  const seen = new Set(
    existingRequirements.map((requirement) =>
      getRequirementKey(
        requirement.norma,
        requirement.item,
        requirement.titulo || requirement.name,
        requirement.descripcion || requirement.name
      )
    )
  );

  const dataToCreate = rows.filter((row) => {
    const key = getRequirementKey(
      row.norma,
      row.item,
      row.titulo || row.name,
      row.descripcion || row.name
    );

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });

  if (dataToCreate.length === 0) {
    return {
      imported: 0,
      skippedDuplicates: rows.length,
      totalRows: rows.length,
    };
  }

  const result = await prisma.requirement.createMany({
    data: dataToCreate.map((row) => ({
      projectId,
      norma: row.norma,
      item: row.item,
      name: row.name,
      titulo: row.titulo || row.name,
      descripcion: row.descripcion || row.name,
      evidencia: row.evidencia,
      status: row.defaultStatus,
      completed: row.defaultStatus === "total",
      deadline: row.deadline,
      templateId: null,
    })),
  });

  return {
    imported: result.count,
    skippedDuplicates: rows.length - result.count,
    totalRows: rows.length,
  };
}

function getRequirementKey(
  norma: string | null | undefined,
  item: string | null | undefined,
  titulo: string | null | undefined,
  descripcion: string | null | undefined
) {
  return [norma ?? "", item ?? "", titulo ?? "", descripcion ?? ""]
    .map((value) => value.trim().toLowerCase())
    .join("|");
}
