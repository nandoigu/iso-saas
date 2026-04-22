import { NextResponse } from "next/server";
import {
  buildComplianceReport,
  flattenProjectRequirements,
  shouldSendDailyEmail,
  shouldSendReportEmail,
} from "@/app/lib/alerts";
import { getAuthSession, unauthorized } from "@/app/lib/auth";
import { sendComplianceEmail } from "@/app/lib/email";
import { prisma } from "@/app/lib/prisma";

const DEFAULT_UPCOMING_DAYS = 7;

export async function GET(req: Request) {
  try {
    const authError = validateCronRequest(req);

    if (authError) {
      return authError;
    }

    const users = await prisma.user.findMany({
      where: {
        OR: [{ notifyAlerts: true }, { notifyReports: true }],
      },
      select: {
        id: true,
        email: true,
        name: true,
        notifyAlerts: true,
        notifyReports: true,
        reportFrequency: true,
        lastAlertEmailAt: true,
        lastReportEmailAt: true,
        projects: {
          include: {
            requirements: true,
          },
        },
      },
    });

    const results = [];

    for (const user of users) {
      const report = buildComplianceReport(
        flattenProjectRequirements(user.projects),
        DEFAULT_UPCOMING_DAYS
      );
      const hasAlerts =
        report.overdueRequirements.length > 0 || report.upcomingRequirements.length > 0;
      const shouldSendAlerts =
        user.notifyAlerts && hasAlerts && shouldSendDailyEmail(user.lastAlertEmailAt);
      const shouldSendReport =
        user.notifyReports &&
        shouldSendReportEmail(user.reportFrequency, user.lastReportEmailAt);

      if (!shouldSendAlerts && !shouldSendReport) {
        results.push({ userId: user.id, sent: false, reason: "Sin envios pendientes" });
        continue;
      }

      const subject = shouldSendAlerts
        ? "Alertas de vencimiento ISO 19650"
        : "Informe periodico ISO 19650";
      const emailResult = await sendComplianceEmail({
        to: user.email,
        userName: user.name,
        subject,
        report,
      });

      if (emailResult.sent) {
        await prisma.user.update({
          where: { id: user.id },
          data: {
            ...(shouldSendAlerts ? { lastAlertEmailAt: new Date() } : {}),
            ...(shouldSendReport ? { lastReportEmailAt: new Date() } : {}),
          },
        });
      }

      results.push({
        userId: user.id,
        sent: emailResult.sent,
        skipped: emailResult.skipped,
        reason: "reason" in emailResult ? emailResult.reason : undefined,
        alerts: report.metrics.overdue + report.metrics.upcoming,
      });
    }

    return NextResponse.json({ data: { processed: users.length, results } });
  } catch (error) {
    console.error("ERROR GET /api/cron/alerts:", error);
    return NextResponse.json(
      { error: "Error ejecutando alertas programadas" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const user = await getAuthSession(req);

    if (!user) {
      return unauthorized();
    }

    const fullUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        email: true,
        name: true,
        projects: {
          include: {
            requirements: true,
          },
        },
      },
    });

    if (!fullUser) {
      return unauthorized();
    }

    const report = buildComplianceReport(
      flattenProjectRequirements(fullUser.projects),
      DEFAULT_UPCOMING_DAYS
    );
    const emailResult = await sendComplianceEmail({
      to: fullUser.email,
      userName: fullUser.name,
      subject: "Informe manual ISO 19650",
      report,
    });

    if (!emailResult.sent) {
      return NextResponse.json(
        {
          error:
            "No se pudo enviar el email. Revisa la configuracion de RESEND_API_KEY.",
          details: "reason" in emailResult ? emailResult.reason : undefined,
        },
        { status: 503 }
      );
    }

    return NextResponse.json({
      data: {
        sent: true,
        overdue: report.metrics.overdue,
        upcoming: report.metrics.upcoming,
        totalRequirements: report.metrics.totalRequirements,
      },
    });
  } catch (error) {
    console.error("ERROR POST /api/cron/alerts:", error);
    return NextResponse.json(
      { error: "Error enviando informe manual" },
      { status: 500 }
    );
  }
}

function validateCronRequest(req: Request) {
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret && process.env.NODE_ENV !== "production") {
    return null;
  }

  const authorization = req.headers.get("authorization");

  if (authorization !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  return null;
}
