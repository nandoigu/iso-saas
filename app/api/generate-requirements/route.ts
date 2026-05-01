import { NextResponse } from "next/server";
import {
  BLOCKED_ACCOUNT_MESSAGE,
  forbidden,
  getAuthSession,
  isAdminRole,
  isBlockedStatus,
  unauthorized,
} from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";
import {
  generateRequirementsForProject,
} from "@/services/requirement.service";
import type { TemplateRole } from "@/services/template.service";

const VALID_ROLES: TemplateRole[] = [
  "adjudicador",
  "adjudicatario_principal",
  "adjudicatario",
];

export async function POST(req: Request) {
  try {
    const user = await getAuthSession(req, { allowBlocked: true });

    if (!user) {
      return unauthorized();
    }

    if (isBlockedStatus(user.status)) {
      return forbidden(BLOCKED_ACCOUNT_MESSAGE);
    }

    const body = await req.json();
    const projectId = String(body.projectId || "").trim();
    const role = String(body.role || "").trim() as TemplateRole;

    if (!projectId) {
      return NextResponse.json(
        { error: "projectId es obligatorio." },
        { status: 400 }
      );
    }

    if (!VALID_ROLES.includes(role)) {
      return NextResponse.json(
        { error: "El rol indicado no es valido." },
        { status: 400 }
      );
    }

    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        ...(isAdminRole(user.role) ? {} : { userId: user.id }),
      },
      select: {
        id: true,
      },
    });

    if (!project) {
      return NextResponse.json(
        { error: "Proyecto no encontrado." },
        { status: 404 }
      );
    }

    const result = await generateRequirementsForProject(project.id, role);

    return NextResponse.json({
      data: result,
    });
  } catch (error) {
    console.error("ERROR POST /api/generate-requirements:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No se pudieron generar los requisitos del proyecto.",
      },
      { status: 500 }
    );
  }
}
