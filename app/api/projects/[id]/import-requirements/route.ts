import { NextResponse } from "next/server";
import {
  BLOCKED_ACCOUNT_MESSAGE,
  forbidden,
  getAuthSession,
  isAdminRole,
  isBlockedStatus,
  unauthorized,
} from "@/app/lib/auth";
import { readSafeXlsxUpload } from "@/app/lib/excelUpload";
import { parseRequirementWorkbook } from "@/app/lib/requirementImport";
import { prisma } from "@/app/lib/prisma";
import {
  importRequirementsForProject,
  type ProjectRequirementImportMode,
} from "@/services/project-requirement-import.service";

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
    const rawMode = formData.get("mode");
    const mode: ProjectRequirementImportMode =
      rawMode === "replace" ? "replace" : "append";

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "Debes subir un archivo .xlsx." },
        { status: 400 }
      );
    }

    const upload = await readSafeXlsxUpload(file);

    if (!upload.ok) {
      return NextResponse.json({ error: upload.error }, { status: 400 });
    }

    const parsed = await parseRequirementWorkbook(upload.buffer, {
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

    const result = await importRequirementsForProject(project.id, parsed.rows, {
      mode,
    });

    return NextResponse.json({
      data: {
        ...result,
        mode,
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
