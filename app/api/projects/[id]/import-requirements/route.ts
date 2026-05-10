import { NextResponse } from "next/server";
import {
  BLOCKED_ACCOUNT_MESSAGE,
  forbidden,
  getAuthSession,
  isAdminRole,
  isBlockedStatus,
  unauthorized,
} from "@/app/lib/auth";
import { parseRequirementWorkbook } from "@/app/lib/requirementImport";
import { prisma } from "@/app/lib/prisma";
import { importRequirementsForProject } from "@/services/project-requirement-import.service";

export const runtime = "nodejs";

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthSession(req, { allowBlocked: true });

    if (!user) {
      return unauthorized();
    }

    if (isBlockedStatus(user.status)) {
      return forbidden(BLOCKED_ACCOUNT_MESSAGE);
    }

    const { id: projectId } = await context.params;

    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        ...(isAdminRole(user.role) ? {} : { userId: user.id }),
      },
      select: { id: true },
    });

    if (!project) {
      return NextResponse.json(
        { error: "Proyecto no encontrado." },
        { status: 404 }
      );
    }

    const formData = await req.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "Debes subir un archivo .xlsx." },
        { status: 400 }
      );
    }

    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      return NextResponse.json(
        { error: "Formato no valido. Solo se aceptan archivos .xlsx." },
        { status: 400 }
      );
    }

    const buffer = await file.arrayBuffer();
    const parsed = parseRequirementWorkbook(buffer, {
      acceptedFormats: ["project-detailed", "role-template"],
      roleTemplateFallbackStatus: "parcial",
    });

    if (parsed.errors.length > 0) {
      return NextResponse.json(
        {
          error: "El archivo tiene errores de formato.",
          details: parsed.errors,
        },
        { status: 400 }
      );
    }

    const result = await importRequirementsForProject(project.id, parsed.rows);

    return NextResponse.json({
      data: {
        ...result,
        format: parsed.format,
        skippedDuplicates:
          result.skippedDuplicates + parsed.skippedDuplicates,
      },
    });
  } catch (error) {
    console.error("ERROR POST /api/projects/[id]/import-requirements:", error);
    return NextResponse.json(
      { error: "Error importando requisitos del proyecto." },
      { status: 500 }
    );
  }
}
