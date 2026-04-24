import { NextResponse } from "next/server";
import {
  hashPassword,
  hashPasswordResetToken,
  validatePassword,
} from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const rawToken = String(body.token || "").trim();
    const newPassword = String(body.newPassword || "");
    const passwordError = validatePassword(newPassword);

    if (!rawToken || passwordError) {
      return NextResponse.json(
        { error: passwordError || "Token no valido." },
        { status: 400 }
      );
    }

    const token = hashPasswordResetToken(rawToken);
    const candidateTokens = new Set<string>([token]);

    // Compatibilidad defensiva para posibles tokens legacy almacenados sin hash.
    if (/^[a-f0-9]{64}$/i.test(rawToken)) {
      candidateTokens.add(rawToken.toLowerCase());
    }

    const now = new Date();
    const resetToken = await prisma.passwordResetToken.findFirst({
      where: {
        token: {
          in: Array.from(candidateTokens),
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      select: {
        id: true,
        userId: true,
        expiresAt: true,
      },
    });

    if (!resetToken || new Date(resetToken.expiresAt).getTime() <= now.getTime()) {
      return NextResponse.json(
        { error: "El enlace de restablecimiento no es valido o ha caducado." },
        { status: 400 }
      );
    }

    const password = await hashPassword(newPassword);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: resetToken.userId },
        data: { password },
      }),
      prisma.passwordResetToken.deleteMany({
        where: {
          OR: [{ id: resetToken.id }, { userId: resetToken.userId }],
        },
      }),
    ]);

    return NextResponse.json({ data: { reset: true } });
  } catch (error) {
    console.error("ERROR POST /api/auth/reset-password:", error);
    return NextResponse.json(
      { error: "No se pudo restablecer la contrasena." },
      { status: 500 }
    );
  }
}
