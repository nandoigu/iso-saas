import { NextResponse } from "next/server";
import { getAuthSession, unauthorized } from "@/app/lib/auth";
import {
  buildComplianceReport,
  shouldSendDailyEmail,
  shouldSendReportEmail,
  type AlertRequirement,
} from "@/app/lib/alerts";
import { prisma } from "@/app/lib/prisma";
import {
  EmailDeliveryError,
  sendAlertDigestEmail,
  sendComplianceEmail,
} from "@/lib/email";

export const runtime = "nodejs";

const UPCOMING_DAYS = 7;
const ACTIVE_USER_STATUS = "active";

export async function GET(req: Request) {
  try {
    if (!isAuthorizedCronRequest(req)) {
      return NextResponse.json({ success: false }, { status: 401 });
    }

    const url = new URL(req.url);
    const dryRun = url.searchParams.get("dryRun") === "1";

    const users = await prisma.user.findMany({
      where: {
        status: ACTIVE_USER_STATUS,
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
          select: {
            id: true,
            name: true,
            requirements: {
              select: {
                id: true,
                norma: true,
                item: true,
                name: true,
                status: true,
                deadline: true,
                lastNotifiedAt: true,
              },
            },
          },
        },
      },
    });

    const startOfToday = getStartOfToday();
    const endOfUpcomingWindow = getUpcomingLimit(startOfToday, UPCOMING_DAYS);
    let emailsSent = 0;
    let emailFailures = 0;
    let alertEmailsSent = 0;
    let reportEmailsSent = 0;
    let alertEmailsReady = 0;
    let reportEmailsReady = 0;
    let alertRequirementsReady = 0;
    let reportRequirementsReady = 0;

    for (const user of users) {
      try {
        const allRequirements = flattenUserRequirements(user.projects);
        const overdueRequirements: AlertRequirement[] = [];
        const upcomingRequirements: AlertRequirement[] = [];

        for (const requirement of allRequirements) {
          if (!requirement.deadline) {
            continue;
          }

          const deadline = new Date(requirement.deadline);
          if (Number.isNaN(deadline.getTime())) {
            continue;
          }

          if (wasNotifiedToday(requirement.lastNotifiedAt, startOfToday)) {
            continue;
          }

          if (deadline < startOfToday) {
            overdueRequirements.push(requirement);
            continue;
          }

          if (deadline <= endOfUpcomingWindow) {
            upcomingRequirements.push(requirement);
          }
        }

        if (
          user.notifyAlerts &&
          shouldSendDailyEmail(user.lastAlertEmailAt) &&
          (overdueRequirements.length > 0 || upcomingRequirements.length > 0)
        ) {
          alertEmailsReady += 1;
          alertRequirementsReady +=
            overdueRequirements.length + upcomingRequirements.length;

          if (!dryRun) {
            await sendAlertDigestEmail({
              to: user.email,
              userName: user.name,
              overdueRequirements,
              upcomingRequirements,
              deliveryMode: "cron",
            });

            const requirementIds = [...overdueRequirements, ...upcomingRequirements].map(
              (requirement) => requirement.id
            );

            await prisma.$transaction([
              prisma.requirement.updateMany({
                where: {
                  id: {
                    in: requirementIds,
                  },
                },
                data: {
                  lastNotifiedAt: new Date(),
                },
              }),
              prisma.user.update({
                where: { id: user.id },
                data: { lastAlertEmailAt: new Date() },
              }),
            ]);

            emailsSent += 1;
            alertEmailsSent += 1;
          }
        }

        if (
          user.notifyReports &&
          shouldSendReportEmail(user.reportFrequency, user.lastReportEmailAt)
        ) {
          const report = buildComplianceReport(allRequirements, UPCOMING_DAYS);
          reportEmailsReady += 1;
          reportRequirementsReady += report.metrics.totalRequirements;

          if (!dryRun) {
            await sendComplianceEmail({
              to: user.email,
              userName: user.name,
              subject: getReportSubject(user.reportFrequency, report.metrics.compliance),
              report,
              deliveryMode: "cron",
            });

            await prisma.user.update({
              where: { id: user.id },
              data: { lastReportEmailAt: new Date() },
            });

            emailsSent += 1;
            reportEmailsSent += 1;
          }
        }
      } catch (error) {
        console.error(`ERROR /api/cron/alerts user ${user.id}:`, error);
        emailFailures += 1;
      }
    }

    return NextResponse.json({
      success: true,
      dryRun,
      usersProcessed: users.length,
      emailsSent,
      alertEmailsSent,
      reportEmailsSent,
      alertEmailsReady,
      reportEmailsReady,
      alertRequirementsReady,
      reportRequirementsReady,
      emailFailures,
    });
  } catch (error) {
    console.error("ERROR GET /api/cron/alerts:", error);
    return NextResponse.json(
      {
        success: false,
        dryRun: false,
        usersProcessed: 0,
        emailsSent: 0,
        alertEmailsSent: 0,
        reportEmailsSent: 0,
        alertEmailsReady: 0,
        reportEmailsReady: 0,
        alertRequirementsReady: 0,
        reportRequirementsReady: 0,
        emailFailures: 0,
      },
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
          select: {
            id: true,
            name: true,
            requirements: {
              select: {
                id: true,
                norma: true,
                item: true,
                name: true,
                status: true,
                deadline: true,
                lastNotifiedAt: true,
              },
            },
          },
        },
      },
    });

    if (!fullUser) {
      return unauthorized();
    }

    const allRequirements = flattenUserRequirements(fullUser.projects);
    const report = buildComplianceReport(allRequirements, UPCOMING_DAYS);

    if (allRequirements.length === 0) {
      return NextResponse.json({
        success: true,
        usersProcessed: 1,
        emailsSent: 0,
        message: "No hay requerimientos para incluir en el informe.",
      });
    }

    await sendComplianceEmail({
      to: fullUser.email,
      userName: fullUser.name,
      subject: `Informe manual ISO 19650 - ${report.metrics.compliance}% cumplimiento`,
      report,
      deliveryMode: "manual",
    });

    return NextResponse.json({
      success: true,
      usersProcessed: 1,
      emailsSent: 1,
      message: "Informe manual enviado correctamente.",
    });
  } catch (error) {
    console.error("ERROR POST /api/cron/alerts:", error);

    const message =
      error instanceof EmailDeliveryError
        ? error.message
        : "No se pudo enviar el informe.";

    return NextResponse.json(
      {
        success: false,
        usersProcessed: 1,
        emailsSent: 0,
        error: message,
      },
      {
        status:
          error instanceof EmailDeliveryError &&
          error.kind === "provider_restriction"
            ? 503
            : 500,
      }
    );
  }
}

function isAuthorizedCronRequest(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authorization = req.headers.get("authorization");

  if (!cronSecret) {
    console.error("CRON_SECRET is missing");
    return false;
  }

  return authorization === `Bearer ${cronSecret}`;
}

function flattenUserRequirements(
  projects: Array<{
    name: string;
    requirements: Array<{
      id: string;
      norma: string | null;
      item: string | null;
      name: string;
      status: string;
      deadline: Date | null;
      lastNotifiedAt: Date | null;
    }>;
  }>
): AlertRequirement[] {
  return projects.flatMap((project) =>
    project.requirements.map((requirement) => ({
      ...requirement,
      projectName: project.name,
    }))
  );
}

function getReportSubject(frequency: string, compliance: number) {
  const label = frequency === "daily" ? "diario" : "semanal";
  return `Informe ${label} ISO 19650 - ${compliance}% cumplimiento`;
}

function wasNotifiedToday(
  lastNotifiedAt: Date | string | null | undefined,
  startOfToday: Date
) {
  if (!lastNotifiedAt) {
    return false;
  }

  const notifiedAt =
    lastNotifiedAt instanceof Date ? lastNotifiedAt : new Date(lastNotifiedAt);

  if (Number.isNaN(notifiedAt.getTime())) {
    return false;
  }

  return notifiedAt >= startOfToday;
}

function getStartOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function getUpcomingLimit(startOfToday: Date, upcomingDays: number) {
  const limit = new Date(startOfToday);
  limit.setDate(limit.getDate() + upcomingDays);
  return limit;
}
