import { NextResponse } from "next/server";
import {
  createSessionToken,
  forbidden,
  isValidEmail,
  isBlockedStatus,
  needsPasswordRehash,
  normalizeEmail,
  setSessionCookie,
  hashPassword,
  verifyPassword,
} from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const email = normalizeEmail(body.email || "");
    const password = String(body.password || "");

    if (!isValidEmail(email) || !password) {
      return NextResponse.json(
        { error: "Email o contrasena incorrectos" },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        name: true,
        password: true,
        role: true,
        status: true,
        companyId: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Email o contrasena incorrectos" },
        { status: 401 }
      );
    }

    const validPassword = await verifyPassword(password, user.password);

    if (!validPassword) {
      return NextResponse.json(
        { error: "Email o contrasena incorrectos" },
        { status: 401 }
      );
    }

    if (isBlockedStatus(user.status)) {
      return forbidden("Tu cuenta esta bloqueada. Contacta con el administrador.");
    }

    if (needsPasswordRehash(user.password)) {
      const passwordHash = await hashPassword(password);

      await prisma.user.update({
        where: { id: user.id },
        data: { password: passwordHash },
      });
    }

    const publicUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      status: user.status,
      companyId: user.companyId,
    };

    const response = NextResponse.json({ data: { user: publicUser } });
    setSessionCookie(response, createSessionToken(publicUser));
    return response;
  } catch (error) {
    console.error("ERROR LOGIN:", error);
    return NextResponse.json(
      { error: "Error iniciando sesion" },
      { status: 500 }
    );
  }
}
