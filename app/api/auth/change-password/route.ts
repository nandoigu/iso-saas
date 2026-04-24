import { NextResponse } from "next/server";
import {
  getAuthSession,
  hashPassword,
  unauthorized,
  validatePassword,
  verifyPassword,
} from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";

export async function POST(req: Request) {
  try {
    const user = await getAuthSession(req);

    if (!user) {
      return unauthorized();
    }

    const body = await req.json();
    const currentPassword = String(body.currentPassword || "");
    const newPassword = String(body.newPassword || "");

    const passwordError = validatePassword(newPassword);

    if (!currentPassword || passwordError) {
      return NextResponse.json(
        { error: passwordError || "Debes indicar tu contrasena actual." },
        { status: 400 }
      );
    }

    const userWithPassword = await prisma.user.findUnique({
      where: { id: user.id },
      select: { id: true, password: true },
    });

    if (!userWithPassword) {
      return unauthorized();
    }

    const validPassword = await verifyPassword(currentPassword, userWithPassword.password);

    if (!validPassword) {
      return NextResponse.json(
        { error: "La contrasena actual no es correcta." },
        { status: 400 }
      );
    }

    const password = await hashPassword(newPassword);

    await prisma.user.update({
      where: { id: user.id },
      data: { password },
    });

    return NextResponse.json({ data: { changed: true } });
  } catch (error) {
    console.error("ERROR POST /api/auth/change-password:", error);
    return NextResponse.json(
      { error: "No se pudo actualizar la contrasena." },
      { status: 500 }
    );
  }
}
