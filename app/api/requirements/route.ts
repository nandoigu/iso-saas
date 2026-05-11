import { NextResponse } from "next/server";
import {
  BLOCKED_ACCOUNT_MESSAGE,
  forbidden,
  getAuthSession,
  isAdminRole,
  isBlockedStatus,
  unauthorized,
} from "@/app/lib/auth";
import { prisma } from "../../lib/prisma";

const VALID_STATUSES = ["total", "parcial", "no_conforme"] as const;

type RequirementStatus = (typeof VALID_STATUSES)[number];

export async function GET(req: Request) {
  try {
    const user = await getAuthSession(req, { allowBlocked: true });

    if (!user) {
      return unauthorized();
    }

    if (isBlockedStatus(user.status)) {
      return forbidden(BLOCKED_ACCOUNT_MESSAGE);
    }

    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");

    if (!projectId) {
      return NextResponse.json(
        { error: "projectId requerido" },
        { status: 400 }
      );
    }

    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        ...(isAdminRole(user.role) ? {} : { userId: user.id }),
      },
      select: { id: true },
    });

    if (!project) {
      return NextResponse.json(
        { error: "Proyecto no encontrado" },
        { status: 404 }
      );
    }

    const requirements = await prisma.requirement.findMany({
      where: {
        projectId: project.id,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json(requirements);
  } catch (error) {
    console.error("ERROR GET /api/requirements:", error);
    return NextResponse.json(
      { error: "Error cargando requirements" },
      { status: 500 }
    );
  }
}

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
    const projectId = cleanRequiredString(body.projectId);
    const name = cleanRequiredString(body.name);
    const parsedStatus = parseRequirementStatus(body.status);
    const parsedDeadline = parseOptionalDeadline(body.deadline);

    if (!projectId) {
      return NextResponse.json(
        { error: "projectId requerido" },
        { status: 400 }
      );
    }

    if (!name) {
      return NextResponse.json(
        { error: "El requerimiento es obligatorio" },
        { status: 400 }
      );
    }

    if (!parsedStatus.ok) {
      return NextResponse.json({ error: parsedStatus.error }, { status: 400 });
    }

    if (!parsedDeadline.ok) {
      return NextResponse.json({ error: parsedDeadline.error }, { status: 400 });
    }

    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        ...(isAdminRole(user.role) ? {} : { userId: user.id }),
      },
      select: { id: true },
    });

    if (!project) {
      return NextResponse.json(
        { error: "Proyecto no encontrado" },
        { status: 404 }
      );
    }

    const newRequirement = await prisma.requirement.create({
      data: {
        projectId: project.id,
        norma: cleanOptional(body.norma),
        item: cleanOptional(body.item),
        name,
        evidencia: cleanOptional(body.evidencia),
        status: parsedStatus.value,
        completed: parsedStatus.value === "total",
        deadline: parsedDeadline.value,
      },
    });

    return NextResponse.json(newRequirement, { status: 201 });
  } catch (error) {
    console.error("ERROR POST /api/requirements:", error);
    return NextResponse.json(
      { error: "Error creando requirement" },
      { status: 500 }
    );
  }
}

export async function PUT(req: Request) {
  try {
    const user = await getAuthSession(req, { allowBlocked: true });

    if (!user) {
      return unauthorized();
    }

    if (isBlockedStatus(user.status)) {
      return forbidden(BLOCKED_ACCOUNT_MESSAGE);
    }

    const body = await req.json();
    const requirementId = cleanRequiredString(body.id);
    const name = cleanRequiredString(body.name);
    const parsedStatus = parseRequirementStatus(body.status);
    const parsedDeadline = parseOptionalDeadline(body.deadline);

    if (!requirementId) {
      return NextResponse.json(
        { error: "id requerido" },
        { status: 400 }
      );
    }

    if (!name) {
      return NextResponse.json(
        { error: "El requerimiento es obligatorio" },
        { status: 400 }
      );
    }

    if (!parsedStatus.ok) {
      return NextResponse.json({ error: parsedStatus.error }, { status: 400 });
    }

    if (!parsedDeadline.ok) {
      return NextResponse.json({ error: parsedDeadline.error }, { status: 400 });
    }

    const requirement = await prisma.requirement.findFirst({
      where: {
        id: requirementId,
        ...(isAdminRole(user.role)
          ? {}
          : {
              project: {
                userId: user.id,
              },
            }),
      },
      select: { id: true },
    });

    if (!requirement) {
      return NextResponse.json(
        { error: "Requerimiento no encontrado" },
        { status: 404 }
      );
    }

    const updated = await prisma.requirement.update({
      where: { id: requirement.id },
      data: {
        norma: cleanOptional(body.norma),
        item: cleanOptional(body.item),
        name,
        evidencia: cleanOptional(body.evidencia),
        status: parsedStatus.value,
        completed: parsedStatus.value === "total",
        deadline: parsedDeadline.value,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("ERROR PUT /api/requirements:", error);
    return NextResponse.json(
      { error: "Error actualizando requirement" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const user = await getAuthSession(req, { allowBlocked: true });

    if (!user) {
      return unauthorized();
    }

    if (isBlockedStatus(user.status)) {
      return forbidden(BLOCKED_ACCOUNT_MESSAGE);
    }

    const { searchParams } = new URL(req.url);
    const requirementId = searchParams.get("id")?.trim() || "";

    if (!requirementId) {
      return NextResponse.json(
        { error: "id requerido" },
        { status: 400 }
      );
    }

    const requirement = await prisma.requirement.findFirst({
      where: {
        id: requirementId,
        ...(isAdminRole(user.role)
          ? {}
          : {
              project: {
                userId: user.id,
              },
            }),
      },
      select: { id: true },
    });

    if (!requirement) {
      return NextResponse.json(
        { error: "Requerimiento no encontrado" },
        { status: 404 }
      );
    }

    await prisma.requirement.delete({
      where: { id: requirement.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("ERROR DELETE /api/requirements:", error);
    return NextResponse.json(
      { error: "Error eliminando requirement" },
      { status: 500 }
    );
  }
}

function cleanOptional(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function cleanRequiredString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function parseRequirementStatus(
  value: unknown
):
  | { ok: true; value: RequirementStatus }
  | { ok: false; error: string } {
  if (typeof value !== "string" || !value.trim()) {
    return { ok: true, value: "no_conforme" };
  }

  const normalizedValue = value.trim();

  if (VALID_STATUSES.includes(normalizedValue as RequirementStatus)) {
    return {
      ok: true,
      value: normalizedValue as RequirementStatus,
    };
  }

  return {
    ok: false,
    error: "El estado debe ser total, parcial o no_conforme.",
  };
}

function parseOptionalDeadline(
  value: unknown
): { ok: true; value: Date | null } | { ok: false; error: string } {
  if (value == null || value === "") {
    return { ok: true, value: null };
  }

  if (typeof value !== "string") {
    return { ok: false, error: "La fecha límite no es válida." };
  }

  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return { ok: true, value: null };
  }

  const parsedDate = new Date(trimmedValue);

  if (Number.isNaN(parsedDate.getTime())) {
    return { ok: false, error: "La fecha límite no es válida." };
  }

  return { ok: true, value: parsedDate };
}
