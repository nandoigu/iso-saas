import { NextResponse } from "next/server";
import {
  createPasswordResetToken,
  hashPasswordResetToken,
  isValidEmail,
  normalizeEmail,
} from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";
import { EmailDeliveryError, sendPasswordResetEmail } from "@/lib/email";
import { getEmailDeliveryMode } from "@/lib/resend";

const GENERIC_SUCCESS_MESSAGE =
  "Si existe una cuenta con ese email, te enviaremos un enlace para restablecer la contrasena.";
const TEST_MODE_HINT =
  "El entorno de email esta en modo de pruebas. Solo los destinatarios autorizados por Resend recibiran correos reales hasta verificar el dominio remitente.";

export async function POST(req: Request) {
  try {
    const deliveryMode = getEmailDeliveryMode();
    const body = await req.json();
    const email = normalizeEmail(body.email || "");

    if (!isValidEmail(email)) {
      return NextResponse.json({ error: "Email no valido." }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        name: true,
      },
    });

    if (user) {
      const rawToken = createPasswordResetToken();
      const token = hashPasswordResetToken(rawToken);
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
      const origin = new URL(req.url).origin;
      const resetUrl = `${origin}/reset-password?token=${rawToken}`;

      await prisma.passwordResetToken.deleteMany({
        where: { userId: user.id },
      });

      await prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          token,
          expiresAt,
        },
      });

      try {
        await sendPasswordResetEmail({
          to: user.email,
          userName: user.name,
          resetUrl,
        });
      } catch (error) {
        await prisma.passwordResetToken.deleteMany({
          where: {
            userId: user.id,
            token,
          },
        });

        if (error instanceof EmailDeliveryError) {
          console.error(
            `PASSWORD_RESET_EMAIL_UNDELIVERABLE user=${user.id} kind=${error.kind}: ${error.message}`
          );
        }

        throw error;
      }
    }

    return NextResponse.json({
      data: {
        sent: true,
        message: GENERIC_SUCCESS_MESSAGE,
        deliveryMode,
        deliveryHint: deliveryMode === "test" ? TEST_MODE_HINT : null,
      },
    });
  } catch (error) {
    console.error("ERROR POST /api/auth/forgot-password:", error);
    const deliveryMode =
      safelyGetDeliveryMode();

    return NextResponse.json(
      {
        data: {
          sent: true,
          message: GENERIC_SUCCESS_MESSAGE,
          deliveryMode,
          deliveryHint: deliveryMode === "test" ? TEST_MODE_HINT : null,
        },
      },
      { status: 200 }
    );
  }
}

function safelyGetDeliveryMode() {
  try {
    return getEmailDeliveryMode();
  } catch {
    return "production" as const;
  }
}
