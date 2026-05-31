import { NextResponse } from "next/server";
import { getAuthSession, isAdminRole, unauthorized } from "@/app/lib/auth";
import {
  buildComplianceReport,
  normalizeStatus,
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

type ProjectWithRequirements = {
  id: string;
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
};

export async function GET(req: Request) {
  try {
    if (!isAuthorizedCronRequest(req)) {
      return NextResponse.json({ success: false }, { status: 401 });
    }

    const url = new URL(req.url);
    const dryRun = url.searchParams.get("dryRun") === "1";
    const prepareAdminEmailTest =
      url.searchParams.get("prepareAdminEmailTest") === "1";

    if (prepareAdminEmailTest) {
      const email = url.searchParams.get("email") || "figual@eficax.com";
      const testCondition = await prepareAdminAlertEmailTest(email);

      return NextResponse.json({
        success: true,
        prepared: true,
        ...testCondition,
      });
    }

    const users = await prisma.user.findMany({
      where: {
        status: ACTIVE_USER_STATUS,
        OR: [{ notifyAlerts: true }, { notifyReports: true }],
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
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
    const adminProjects =
      users.some((user) => isAdminRole(user.role)) ? await getAllProjects() : null;

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

    const orderedUsers = [...users].sort(
      (a, b) => Number(isAdminRole(a.role)) - Number(isAdminRole(b.role))
    );

    for (const user of orderedUsers) {
      try {
        const isAdminUser = isAdminRole(user.role);
        const projectScope = isAdminUser && adminProjects ? adminProjects : user.projects;
        const allRequirements = flattenProjectRequirements(projectScope);
        const overdueRequirements: AlertRequirement[] = [];
        const upcomingRequirements: AlertRequirement[] = [];

        for (const requirement of allRequirements) {
          if (!requirement.deadline) {
            continue;
          }

          if (normalizeStatus(requirement.status) === "total") {
            continue;
          }

          const deadline = new Date(requirement.deadline);
          if (Number.isNaN(deadline.getTime())) {
            continue;
          }

          if (
            !isAdminUser &&
            wasNotifiedToday(requirement.lastNotifiedAt, startOfToday)
          ) {
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
        role: true,
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

    const projectScope = isAdminRole(fullUser.role)
      ? await getAllProjects()
      : fullUser.projects;
    const allRequirements = flattenProjectRequirements(projectScope);
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

async function getAllProjects(): Promise<ProjectWithRequirements[]> {
  return prisma.project.findMany({
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
  });
}

function flattenProjectRequirements(
  projects: Array<Pick<ProjectWithRequirements, "name" | "requirements">>
): AlertRequirement[] {
  return projects.flatMap((project) =>
    project.requirements.map((requirement) => ({
      ...requirement,
      projectName: project.name,
    }))
  );
}

async function prepareAdminAlertEmailTest(email: string) {
  const admin = await prisma.user.findFirst({
    where: {
      email,
      role: "admin",
      status: ACTIVE_USER_STATUS,
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      notifyAlerts: true,
      projects: {
        select: {
          id: true,
          name: true,
          code: true,
        },
        take: 1,
      },
    },
  });

  if (!admin) {
    return {
      adminFound: false,
      message: `No se encontro un Admin activo con email ${email}.`,
    };
  }

  const project =
    admin.projects[0] ||
    (await prisma.project.create({
      data: {
        name: "Proyecto prueba alertas Admin",
        code: "ADMIN-ALERT-TEST",
        role: "adjudicatario",
        userId: admin.id,
      },
      select: {
        id: true,
        name: true,
        code: true,
      },
    }));

  const deadline = new Date();
  deadline.setDate(deadline.getDate() - 1);
  deadline.setHours(0, 0, 0, 0);

  const item = "ALERTA-ADMIN-TEST";
  const existingRequirement = await prisma.requirement.findFirst({
    where: {
      projectId: project.id,
      norma: "TEST",
      item,
    },
    select: {
      id: true,
    },
  });

  const requirement = existingRequirement
    ? await prisma.requirement.update({
        where: {
          id: existingRequirement.id,
        },
        data: getAdminEmailTestRequirementData(deadline),
        select: getRequirementTestSelect(),
      })
    : await prisma.requirement.create({
        data: {
          projectId: project.id,
          ...getAdminEmailTestRequirementData(deadline),
        },
        select: getRequirementTestSelect(),
      });

  const updatedAdmin = await prisma.user.update({
    where: {
      id: admin.id,
    },
    data: {
      notifyAlerts: true,
      lastAlertEmailAt: null,
    },
    select: {
      email: true,
      role: true,
      status: true,
      notifyAlerts: true,
      lastAlertEmailAt: true,
    },
  });

  return {
    adminFound: true,
    admin: updatedAdmin,
    project,
    requirement,
  };
}

function getAdminEmailTestRequirementData(deadline: Date) {
  return {
    name: "Prueba controlada de alerta por email Admin",
    titulo: "Prueba alerta email Admin",
    descripcion:
      "Requisito creado para verificar el envio automatico de alertas al usuario Admin.",
    norma: "TEST",
    item: "ALERTA-ADMIN-TEST",
    evidencia: "Condicion de prueba: requisito no conforme vencido ayer.",
    status: "no_conforme",
    completed: false,
    deadline,
    lastNotifiedAt: null,
  };
}

function getRequirementTestSelect() {
  return {
    id: true,
    norma: true,
    item: true,
    name: true,
    status: true,
    deadline: true,
    lastNotifiedAt: true,
  };
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
