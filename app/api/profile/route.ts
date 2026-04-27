import { NextResponse } from "next/server";
import {
  forbidden,
  getAuthSession,
  isBlockedStatus,
  isValidEmail,
  normalizeEmail,
  unauthorized,
} from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";

export async function GET(req: Request) {
  try {
    const user = await getAuthSession(req, { allowBlocked: true });

    if (!user) {
      return unauthorized();
    }

    if (isBlockedStatus(user.status)) {
      return forbidden("Tu cuenta esta bloqueada. Contacta con el administrador.");
    }

    const profile = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        createdAt: true,
        companyId: true,
        company: {
          select: {
            name: true,
          },
        },
      },
    });

    return NextResponse.json({
      data: {
        user: {
          ...profile,
          companyName: profile?.company?.name ?? "",
        },
      },
    });
  } catch (error) {
    console.error("ERROR GET /api/profile:", error);
    return NextResponse.json(
      { error: "No se pudo cargar el perfil." },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request) {
  try {
    const user = await getAuthSession(req, { allowBlocked: true });

    if (!user) {
      return unauthorized();
    }

    if (isBlockedStatus(user.status)) {
      return forbidden("Tu cuenta esta bloqueada. Contacta con el administrador.");
    }

    const body = await req.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const email = normalizeEmail(String(body.email || ""));
    const companyName = typeof body.companyName === "string" ? body.companyName.trim() : "";

    if (!email) {
      return NextResponse.json(
        { error: "El email es obligatorio." },
        { status: 400 }
      );
    }

    if (!isValidEmail(email)) {
      return NextResponse.json(
        { error: "El email no es valido." },
        { status: 400 }
      );
    }

    const existingUser = await prisma.user.findFirst({
      where: {
        email,
        id: {
          not: user.id,
        },
      },
      select: {
        id: true,
      },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "Ya existe otra cuenta con ese email." },
        { status: 409 }
      );
    }

    const updatedUser = await prisma.$transaction(async (tx) => {
      let companyId = user.companyId;

      if (companyName) {
        if (companyId) {
          await tx.company.update({
            where: { id: companyId },
            data: { name: companyName },
          });
        } else {
          const company = await tx.company.create({
            data: { name: companyName },
            select: { id: true },
          });
          companyId = company.id;
        }
      } else if (companyId) {
        companyId = null;
      }

      return tx.user.update({
        where: { id: user.id },
        data: {
          name: name || null,
          email,
          companyId,
        },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          status: true,
          createdAt: true,
          companyId: true,
          company: {
            select: {
              name: true,
            },
          },
        },
      });
    });

    return NextResponse.json({
      data: {
        user: {
          ...updatedUser,
          companyName: updatedUser.company?.name ?? "",
        },
      },
    });
  } catch (error) {
    console.error("ERROR PATCH /api/profile:", error);
    return NextResponse.json(
      { error: "No se pudo actualizar el perfil." },
      { status: 500 }
    );
  }
}
