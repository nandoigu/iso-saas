import { NextResponse } from "next/server";
import {
  BLOCKED_ACCOUNT_MESSAGE,
  forbidden,
  getAuthSession,
  isBlockedStatus,
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
      return forbidden(BLOCKED_ACCOUNT_MESSAGE);
    }

    const preferences = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        notifyAlerts: true,
        notifyReports: true,
        reportFrequency: true,
      },
    });

    return NextResponse.json({
      data: preferences || {
        notifyAlerts: true,
        notifyReports: false,
        reportFrequency: "weekly",
      },
    });
  } catch (error) {
    console.error("ERROR GET /api/notifications/preferences:", error);
    return NextResponse.json(
      { error: "Error obteniendo preferencias de notificacion" },
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
      return forbidden(BLOCKED_ACCOUNT_MESSAGE);
    }

    const body = await req.json();
    const notifyAlerts =
      typeof body.notifyAlerts === "boolean" ? body.notifyAlerts : undefined;
    const notifyReports =
      typeof body.notifyReports === "boolean" ? body.notifyReports : undefined;
    const reportFrequency =
      body.reportFrequency === "daily" || body.reportFrequency === "weekly"
        ? body.reportFrequency
        : undefined;

    const preferences = await prisma.user.update({
      where: { id: user.id },
      data: {
        ...(notifyAlerts !== undefined ? { notifyAlerts } : {}),
        ...(notifyReports !== undefined ? { notifyReports } : {}),
        ...(reportFrequency ? { reportFrequency } : {}),
      },
      select: {
        notifyAlerts: true,
        notifyReports: true,
        reportFrequency: true,
      },
    });

    return NextResponse.json({ data: preferences });
  } catch (error) {
    console.error("ERROR PATCH /api/notifications/preferences:", error);
    return NextResponse.json(
      { error: "Error actualizando preferencias de notificacion" },
      { status: 500 }
    );
  }
}
