import { NextResponse } from "next/server";
import { getAuthSession, isAdminRole, unauthorized } from "@/app/lib/auth";
import { prisma } from "../../lib/prisma";

const VALID_STATUSES = ["total", "parcial", "no_conforme"] as const;

type RequirementStatus = (typeof VALID_STATUSES)[number];

export async function GET(req: Request) {
  try {
    const user = await getAuthSession(req);

    if (!user) {
      return unauthorized();
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

    return NextResponse.json({ data: requirements });
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
    const user = await getAuthSession(req);

    if (!user) {
      return unauthorized();
    }

    const body = await req.json();
    const projectId = String(body.projectId || "");
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const status = normalizeStatus(body.status);

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
        status,
        completed: status === "total",
        deadline: body.deadline ? new Date(body.deadline) : null,
      },
    });

    return NextResponse.json({ data: newRequirement }, { status: 201 });
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
    const user = await getAuthSession(req);

    if (!user) {
      return unauthorized();
    }

    const body = await req.json();
    const requirementId = String(body.id || "");
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const status = normalizeStatus(body.status);

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
        status,
        completed: status === "total",
        deadline: body.deadline ? new Date(body.deadline) : null,
      },
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error("ERROR PUT /api/requirements:", error);
    return NextResponse.json(
      { error: "Error actualizando requirement" },
      { status: 500 }
    );
  }
}

function cleanOptional(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeStatus(value: unknown): RequirementStatus {
  return VALID_STATUSES.includes(value as RequirementStatus)
    ? (value as RequirementStatus)
    : "no_conforme";
}
