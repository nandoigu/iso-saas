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

export async function DELETE(req: Request) {
  try {
    const currentUser = await getAuthSession(req);

    if (!currentUser) {
      return unauthorized();
    }

    if (!isAdminRole(currentUser.role)) {
      return forbidden();
    }

    const { searchParams } = new URL(req.url);
    const userId = String(searchParams.get("userId") || "");

    if (!userId) {
      return NextResponse.json(
        { error: "Debes indicar el usuario a eliminar." },
        { status: 400 }
      );
    }

    if (userId === currentUser.id) {
      return NextResponse.json(
        { error: "No puedes eliminar tu propia cuenta de administrador." },
        { status: 400 }
      );
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        companyId: true,
        projects: {
          select: {
            id: true,
          },
        },
      },
    });

    if (!targetUser) {
      return NextResponse.json(
        { error: "Usuario no encontrado." },
        { status: 404 }
      );
    }

    const projectIds = targetUser.projects.map((project) => project.id);

    await prisma.$transaction(async (tx) => {
      if (projectIds.length > 0) {
        await tx.requirement.deleteMany({
          where: {
            projectId: {
              in: projectIds,
            },
          },
        });

        await tx.project.deleteMany({
          where: {
            id: {
              in: projectIds,
            },
          },
        });
      }

      await tx.passwordResetToken.deleteMany({
        where: {
          userId,
        },
      });

      await tx.user.delete({
        where: { id: userId },
      });

      if (targetUser.companyId) {
        const [usersUsingCompany, projectsUsingCompany] = await Promise.all([
          tx.user.count({
            where: {
              companyId: targetUser.companyId,
            },
          }),
          tx.project.count({
            where: {
              companyId: targetUser.companyId,
            },
          }),
        ]);

        if (usersUsingCompany === 0 && projectsUsingCompany === 0) {
          await tx.company.delete({
            where: {
              id: targetUser.companyId,
            },
          });
        }
      }
    });

    return NextResponse.json({
      data: {
        deleted: true,
        userId,
      },
    });
  } catch (error) {
    console.error("ERROR DELETE /api/admin/users:", error);
    return NextResponse.json(
      { error: "No se pudo eliminar el usuario." },
      { status: 500 }
    );
  }
}
