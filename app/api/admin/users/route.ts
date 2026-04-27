import { NextResponse } from "next/server";
import { forbidden, getAuthSession, isAdminRole, unauthorized } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";

const VALID_ROLES = ["admin", "user"] as const;
const VALID_STATUSES = ["active", "suspended", "blocked"] as const;

type ValidRole = (typeof VALID_ROLES)[number];
type ValidStatus = (typeof VALID_STATUSES)[number];

export async function GET(req: Request) {
  try {
    const user = await getAuthSession(req);

    if (!user) {
      return unauthorized();
    }

    if (!isAdminRole(user.role)) {
      return forbidden();
    }

    const users = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        company: {
          select: {
            name: true,
          },
        },
        createdAt: true,
        _count: {
          select: {
            projects: true,
          },
        },
      },
    });

    return NextResponse.json({
      data: users.map((entry) => ({
        id: entry.id,
        email: entry.email,
        name: entry.name,
        role: entry.role,
        status: entry.status,
        companyName: entry.company?.name ?? null,
        createdAt: entry.createdAt,
        projectCount: entry._count.projects,
      })),
    });
  } catch (error) {
    console.error("ERROR GET /api/admin/users:", error);
    return NextResponse.json(
      { error: "No se pudieron cargar los usuarios." },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request) {
  try {
    const currentUser = await getAuthSession(req);

    if (!currentUser) {
      return unauthorized();
    }

    if (!isAdminRole(currentUser.role)) {
      return forbidden();
    }

    const body = await req.json();
    const userId = String(body.userId || "");
    const role = body.role ? (String(body.role || "") as ValidRole) : null;
    const status = body.status ? (String(body.status || "") as ValidStatus) : null;

    if (
      !userId ||
      (!role && !status) ||
      (role && !VALID_ROLES.includes(role)) ||
      (status && !VALID_STATUSES.includes(status))
    ) {
      return NextResponse.json(
        { error: "Datos de actualizacion no validos." },
        { status: 400 }
      );
    }

    if (userId === currentUser.id && role === "user") {
      return NextResponse.json(
        { error: "No puedes retirar tu propio acceso de administrador." },
        { status: 400 }
      );
    }

    if (userId === currentUser.id && status === "blocked") {
      return NextResponse.json(
        { error: "No puedes bloquear tu propia cuenta de administrador." },
        { status: 400 }
      );
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(role ? { role } : {}),
        ...(status ? { status } : {}),
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        company: {
          select: {
            name: true,
          },
        },
        createdAt: true,
        _count: {
          select: {
            projects: true,
          },
        },
      },
    });

    return NextResponse.json({
      data: {
        id: updatedUser.id,
        email: updatedUser.email,
        name: updatedUser.name,
        role: updatedUser.role,
        status: updatedUser.status,
        companyName: updatedUser.company?.name ?? null,
        createdAt: updatedUser.createdAt,
        projectCount: updatedUser._count.projects,
      },
    });
  } catch (error) {
    console.error("ERROR PATCH /api/admin/users:", error);
    return NextResponse.json(
      { error: "No se pudo actualizar el rol del usuario." },
      { status: 500 }
    );
  }
}
