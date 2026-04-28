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

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function DELETE(req: Request, context: RouteContext) {
  try {
    const user = await getAuthSession(req, { allowBlocked: true });

    if (!user) {
      return unauthorized();
    }

    if (isBlockedStatus(user.status)) {
      return forbidden(BLOCKED_ACCOUNT_MESSAGE);
    }

    const { id } = await context.params;
    const projectId = String(id || "").trim();

    if (!projectId) {
      return NextResponse.json(
        { error: "Debes indicar un proyecto valido." },
        { status: 400 }
      );
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        userId: true,
      },
    });

    if (!project) {
      return NextResponse.json(
        { error: "Proyecto no encontrado." },
        { status: 404 }
      );
    }

    if (!isAdminRole(user.role) && project.userId !== user.id) {
      return forbidden("No tienes permisos para eliminar este proyecto.");
    }

    await prisma.$transaction(async (tx) => {
      await tx.requirement.deleteMany({
        where: {
          projectId,
        },
      });

      await tx.project.delete({
        where: {
          id: projectId,
        },
      });
    });

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error("ERROR DELETE /api/projects/[id]:", error);
    return NextResponse.json(
      { error: "No se pudo eliminar el proyecto." },
      { status: 500 }
    );
  }
}
