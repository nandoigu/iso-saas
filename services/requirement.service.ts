import { prisma } from "@/lib/prisma";
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
  const templates = await prisma.requirementTemplate.findMany({
    where: {
      role,
    },
    orderBy: [{ norma: "asc" }, { item: "asc" }, { titulo: "asc" }],
  });

  if (templates.length === 0) {
    return {
      created: 0,
      totalTemplates: 0,
      role,
    };
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
