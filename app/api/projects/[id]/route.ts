import { Prisma } from "@prisma/client";
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

const MAX_PROJECT_NAME_LENGTH = 160;
const MAX_PROJECT_CODE_LENGTH = 40;

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(req: Request, context: RouteContext) {
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

    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        ...(isAdminRole(user.role) ? {} : { userId: user.id }),
      },
      select: {
        id: true,
        name: true,
        code: true,
        role: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    });

    if (!project) {
      return NextResponse.json(
        { error: "Proyecto no encontrado." },
        { status: 404 }
      );
    }

    return NextResponse.json(project);
  } catch (error) {
    console.error("ERROR GET /api/projects/[id]:", error);
    return NextResponse.json(
      { error: "No se pudo cargar el proyecto." },
      { status: 500 }
    );
  }
}

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

    const result = await prisma.$transaction(async (tx) => {
      // `EvidenceItem` y `AuditTeam` son `onDelete: Restrict`: el borrado del
      // proyecto rebota en la clave foranea. Se comprueba antes para poder explicar
      // que bloquea, en vez de devolver un 500 opaco. El recuento va dentro de la
      // transaccion para que no cambie entre la comprobacion y el borrado.
      const blockers = await getDeletionBlockers(tx, projectId);
      if (blockers.length > 0) {
        return { deleted: false as const, blockers };
      }

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

      return { deleted: true as const, blockers: [] as DeletionBlocker[] };
    });

    if (!result.deleted) {
      return NextResponse.json(
        { error: buildBlockedMessage(result.blockers), blockedBy: result.blockers },
        { status: 409 }
      );
    }

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    // Red de seguridad: si algo se crea entre la comprobacion y el borrado, Postgres
    // rechaza por clave foranea. Se traduce al mismo 409 en vez de a un 500.
    if (isForeignKeyError(error)) {
      return NextResponse.json(
        {
          error:
            "No se puede eliminar el proyecto porque tiene informacion asociada que debe conservarse.",
        },
        { status: 409 }
      );
    }

    console.error("ERROR DELETE /api/projects/[id]:", error);
    return NextResponse.json(
      { error: "No se pudo eliminar el proyecto." },
      { status: 500 }
    );
  }
}

type DeletionBlocker = "evidence" | "auditTeam";

async function getDeletionBlockers(
  tx: Prisma.TransactionClient,
  projectId: string
): Promise<DeletionBlocker[]> {
  const [evidenceCount, auditTeamCount] = await Promise.all([
    tx.evidenceItem.count({ where: { projectId } }),
    tx.auditTeam.count({ where: { projectId } }),
  ]);

  const blockers: DeletionBlocker[] = [];
  if (evidenceCount > 0) blockers.push("evidence");
  if (auditTeamCount > 0) blockers.push("auditTeam");
  return blockers;
}

/**
 * El mensaje explica el bloqueo y la salida real; no ofrece forzar el borrado.
 *
 * Borrar evidencia de una auditoria es precisamente lo que el principio
 * evidence-first impide. La via prevista para retirar un proyecto cerrado es el
 * ciclo de cierre (exportar → purgar → liberar) descrito en ADR-005, que todavia
 * no esta implementado.
 */
function buildBlockedMessage(blockers: DeletionBlocker[]) {
  const partes: string[] = [];
  if (blockers.includes("evidence")) {
    partes.push("evidencias registradas");
  }
  if (blockers.includes("auditTeam")) {
    partes.push("equipos de auditoria asignados");
  }

  return `No se puede eliminar el proyecto porque tiene ${partes.join(" y ")}. Esa informacion sustenta la trazabilidad de la auditoria y no se descarta con el proyecto.`;
}

function isForeignKeyError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: string }).code === "P2003"
  );
}

export async function PUT(req: Request, context: RouteContext) {
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

    const body = await req.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const code =
      typeof body.code === "string" && body.code.trim() ? body.code.trim() : null;

    if (!name) {
      return NextResponse.json(
        { error: "El nombre del proyecto es obligatorio." },
        { status: 400 }
      );
    }

    if (name.length > MAX_PROJECT_NAME_LENGTH) {
      return NextResponse.json(
        {
          error: `El nombre del proyecto no puede superar los ${MAX_PROJECT_NAME_LENGTH} caracteres.`,
        },
        { status: 400 }
      );
    }

    if (code && code.length > MAX_PROJECT_CODE_LENGTH) {
      return NextResponse.json(
        {
          error: `El código del proyecto no puede superar los ${MAX_PROJECT_CODE_LENGTH} caracteres.`,
        },
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
      return forbidden("No tienes permisos para actualizar este proyecto.");
    }

    if (code) {
      const duplicatedCode = await prisma.project.findFirst({
        where: {
          userId: project.userId,
          code,
          NOT: {
            id: projectId,
          },
        },
        select: {
          id: true,
        },
      });

      if (duplicatedCode) {
        return NextResponse.json(
          { error: "Ya existe otro proyecto de este propietario con ese código." },
          { status: 409 }
        );
      }
    }

    const updatedProject = await prisma.project.update({
      where: { id: projectId },
      data: {
        name,
        code,
      },
      select: {
        id: true,
        name: true,
        code: true,
        role: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    });

    return NextResponse.json(updatedProject);
  } catch (error) {
    console.error("ERROR PUT /api/projects/[id]:", error);
    return NextResponse.json(
      { error: "No se pudo actualizar el proyecto." },
      { status: 500 }
    );
  }
}
