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

    return NextResponse.json({ data: projects });
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

    if (!name) {
      return NextResponse.json(
        { error: "El nombre del proyecto es obligatorio" },
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

    const templates = await prisma.requirementTemplate.findMany({
      orderBy: [{ norma: "asc" }, { item: "asc" }, { name: "asc" }],
    });

    const project = await prisma.project.create({
      data: {
        name,
        code: code || null,
        userId: user.id,
        companyId: user.companyId,
        requirements: {
          create: templates.map((template) => ({
            norma: template.norma,
            item: template.item,
            name: template.name,
            evidencia: template.evidencia,
            status: template.defaultStatus,
            completed: template.defaultStatus === "total",
            deadline: template.deadline,
          })),
        },
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

    return NextResponse.json({ data: project }, { status: 201 });
  } catch (error) {
    console.error("ERROR POST /api/projects:", error);
    return NextResponse.json(
      { error: "Error creando proyecto" },
      { status: 500 }
    );
  }
}
