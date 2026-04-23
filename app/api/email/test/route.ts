import { NextResponse } from "next/server";
import { getAuthSession, isValidEmail, unauthorized } from "@/app/lib/auth";
import { sendTestEmail } from "@/lib/email";

export const runtime = "nodejs";

const RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 5;

const requestStore = new Map<string, number[]>();

export async function POST(req: Request) {
  try {
    const user = await getAuthSession(req);

    if (!user) {
      return unauthorized();
    }

    const rateLimitKey = user.id;
    if (isRateLimited(rateLimitKey)) {
      return NextResponse.json(
        {
          error:
            "Has alcanzado el limite temporal de envios de prueba. Espera unos minutos antes de reintentar.",
        },
        { status: 429 }
      );
    }

    const body = await req.json();
    const to = typeof body.to === "string" ? body.to.trim().toLowerCase() : "";

    if (!to || !isValidEmail(to)) {
      return NextResponse.json(
        { error: "Introduce un email destinatario valido." },
        { status: 400 }
      );
    }

    const result = await sendTestEmail({
      to,
      recipientName: user.name,
    });

    registerRequest(rateLimitKey);

    return NextResponse.json({
      data: {
        sent: true,
        id: result.id,
        to,
        message: "Email de prueba enviado correctamente.",
      },
    });
  } catch (error) {
    console.error("ERROR POST /api/email/test:", error);

    if (error instanceof Error) {
      if (error.message === "RESEND_API_KEY_MISSING") {
        return NextResponse.json(
          {
            error:
              "Falta configurar RESEND_API_KEY en el entorno del servidor.",
          },
          { status: 500 }
        );
      }

      if (error.message === "EMAIL_FROM_MISSING") {
        return NextResponse.json(
          {
            error:
              "Falta configurar EMAIL_FROM en el entorno del servidor.",
          },
          { status: 500 }
        );
      }
    }

    return NextResponse.json(
      {
        error:
          "No se pudo enviar el email de prueba. Revisa la configuracion del servicio de correo.",
      },
      { status: 500 }
    );
  }
}

function isRateLimited(key: string) {
  const now = Date.now();
  const requests = (requestStore.get(key) || []).filter(
    (timestamp) => now - timestamp < RATE_LIMIT_WINDOW_MS
  );

  requestStore.set(key, requests);

  return requests.length >= RATE_LIMIT_MAX_REQUESTS;
}

function registerRequest(key: string) {
  const now = Date.now();
  const requests = (requestStore.get(key) || []).filter(
    (timestamp) => now - timestamp < RATE_LIMIT_WINDOW_MS
  );

  requests.push(now);
  requestStore.set(key, requests);
}
