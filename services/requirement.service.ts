import { prisma } from "@/lib/prisma";
import { DEFAULT_REQUIREMENT_TEMPLATES } from "@/app/lib/defaultRequirementTemplates";
import type { TemplateRole } from "@/services/template.service";

export type GenerateRequirementsResult = {
  created: number;
  totalTemplates: number;
  role: TemplateRole;
};

export async function generateRequirementsForProject(
  projectId: string,
  role: TemplateRole
): Promise<GenerateRequirementsResult> {
  await ensureDefaultTemplatesForRole(role);

  const templates = await prisma.requirementTemplate.findMany({
    where: {
      role,
    },
    orderBy: [{ norma: "asc" }, { item: "asc" }, { titulo: "asc" }],
  });

  if (templates.length === 0) {
    throw new Error(
      `No hay plantillas de requisitos disponibles para la función ${role}.`
    );
  }

  const result = await prisma.requirement.createMany({
    data: templates.map((template) => ({
      projectId,
      templateId: template.id,
      norma: template.norma,
      item: template.item,
      name: template.titulo || template.name,
      titulo: template.titulo || template.name,
      descripcion: template.descripcion,
      evidencia: null,
      status: "no_conforme",
      completed: false,
      deadline: null,
    })),
    skipDuplicates: true,
  });

  return {
    created: result.count,
    totalTemplates: templates.length,
    role,
  };
}

async function ensureDefaultTemplatesForRole(role: TemplateRole) {
  const defaultTemplates = DEFAULT_REQUIREMENT_TEMPLATES.filter(
    (template) => template.role === role
  );

  if (defaultTemplates.length === 0) {
    return;
  }

  const existingCount = await prisma.requirementTemplate.count({
    where: { role },
  });

  if (existingCount >= defaultTemplates.length) {
    return;
  }

  await prisma.requirementTemplate.createMany({
    data: defaultTemplates.map((template) => ({
      norma: template.norma,
      item: template.item,
      titulo: template.titulo,
      descripcion: template.descripcion,
      role: template.role,
      name: template.titulo,
      evidencia: null,
      defaultStatus: "no_conforme",
      deadline: null,
    })),
    skipDuplicates: true,
  });
}
