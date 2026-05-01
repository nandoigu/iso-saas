import { NextResponse } from "next/server";
import {
  BLOCKED_ACCOUNT_MESSAGE,
  forbidden,
  getAuthSession,
  isAdminRole,
  isBlockedStatus,
  unauthorized,
} from "@/app/lib/auth";
import { isProjectRole } from "@/app/lib/projectRoles";
import { prisma } from "@/app/lib/prisma";
import { generateRequirementsForProject } from "@/services/requirement.service";

const USER_PROJECT_LIMIT = 5;

export async function GET(req: Request) {
  try {
    const user = await getAuthSession(req, { allowBlocked: true });

    if (!user) {
      return unauthorized();
    }

    if (isBlockedStatus(user.status)) {
      return forbidden(BLOCKED_ACCOUNT_MESSAGE);
    }

    const projects = await prisma.project.findMany({
      where: isAdminRole(user.role)
        ? undefined
        : {
            userId: user.id,
          },
      orderBy: { createdAt: "desc" },
      include: {
        requirements: true,
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    });

    return NextResponse.json(projects);
  } catch (error) {
    console.error("ERROR GET /api/projects:", error);
    return NextResponse.json(
      { error: "Error obteniendo proyectos" },
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
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const code = typeof body.code === "string" ? body.code.trim() : "";
    const role = typeof body.role === "string" ? body.role.trim() : "";

    if (!name) {
      return NextResponse.json(
        { error: "El nombre del proyecto es obligatorio" },
        { status: 400 }
      );
    }

    if (!isProjectRole(role)) {
      return NextResponse.json(
        {
          error:
            "Debes seleccionar una funcion valida: adjudicador, adjudicatario principal o adjudicatario.",
        },
        { status: 400 }
      );
    }

    if (!isAdminRole(user.role)) {
      const userProjectsCount = await prisma.project.count({
        where: { userId: user.id },
      });

      if (userProjectsCount >= USER_PROJECT_LIMIT) {
        return NextResponse.json(
          { error: `Has alcanzado el limite de proyectos (${USER_PROJECT_LIMIT})` },
          { status: 403 }
        );
      }
    }

    const project = await prisma.project.create({
      data: {
        name,
        code: code || null,
        role,
        userId: user.id,
        companyId: user.companyId,
      },
      include: {
        requirements: true,
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    });

    try {
      await generateRequirementsForProject(project.id, role);
    } catch (generationError) {
      await prisma.project.delete({
        where: { id: project.id },
      });
      throw generationError;
    }

    const hydratedProject = await prisma.project.findUnique({
      where: { id: project.id },
      include: {
        requirements: true,
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    });

    if (!hydratedProject) {
      return NextResponse.json(
        { error: "Proyecto creado pero no se pudo recuperar su informacion." },
        { status: 500 }
      );
    }

    return NextResponse.json(hydratedProject, { status: 201 });
  } catch (error) {
    console.error("ERROR POST /api/projects:", error);
    return NextResponse.json(
      { error: "Error creando proyecto" },
      { status: 500 }
    );
  }
}
