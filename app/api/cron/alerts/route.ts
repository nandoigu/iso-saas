import { NextResponse } from "next/server";
import { getAuthSession, unauthorized } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";
import { EmailDeliveryError, sendAlertDigestEmail } from "@/lib/email";

export const runtime = "nodejs";

const UPCOMING_DAYS = 7;

export async function GET(req: Request) {
  try {
    if (!isAuthorizedCronRequest(req)) {
      return NextResponse.json({ success: false }, { status: 401 });
    }

    const users = await prisma.user.findMany({
      where: {
        notifyAlerts: true,
      },
      select: {
        id: true,
        email: true,
        name: true,
        projects: {
          select: {
            id: true,
            name: true,
            requirements: {
              where: {
                deadline: {
                  not: null,
                },
                NOT: {
                  status: "total",
                },
              },
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

    for (const user of users) {
      try {
        const overdueRequirements = [];
        const upcomingRequirements = [];

        for (const project of user.projects) {
          for (const requirement of project.requirements) {
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

            const enrichedRequirement = {
              ...requirement,
              projectName: project.name,
            };

            if (deadline < startOfToday) {
              overdueRequirements.push(enrichedRequirement);
              continue;
            }

            if (deadline <= endOfUpcomingWindow) {
              upcomingRequirements.push(enrichedRequirement);
            }
          }
        }

        if (overdueRequirements.length === 0 && upcomingRequirements.length === 0) {
          continue;
        }

        await sendAlertDigestEmail({
          to: user.email,
          userName: user.name,
          overdueRequirements,
          upcomingRequirements,
        });

        const requirementIds = [...overdueRequirements, ...upcomingRequirements].map(
          (requirement) => requirement.id
        );

        await prisma.requirement.updateMany({
          where: {
            id: {
              in: requirementIds,
            },
          },
          data: {
            lastNotifiedAt: new Date(),
          },
        });

        emailsSent += 1;
      } catch (error) {
        console.error(`ERROR /api/cron/alerts user ${user.id}:`, error);
        emailFailures += 1;
      }
    }

    return NextResponse.json({
      success: true,
      usersProcessed: users.length,
      emailsSent,
      emailFailures,
    });
  } catch (error) {
    console.error("ERROR GET /api/cron/alerts:", error);
    return NextResponse.json(
      {
        success: false,
        usersProcessed: 0,
        emailsSent: 0,
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
              where: {
                deadline: {
                  not: null,
                },
                NOT: {
                  status: "total",
                },
              },
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

    const startOfToday = getStartOfToday();
    const endOfUpcomingWindow = getUpcomingLimit(startOfToday, UPCOMING_DAYS);
    const overdueRequirements = [];
    const upcomingRequirements = [];

    for (const project of fullUser.projects) {
      for (const requirement of project.requirements) {
        if (!requirement.deadline) {
          continue;
        }

        const deadline = new Date(requirement.deadline);
        if (Number.isNaN(deadline.getTime())) {
          continue;
        }

        const enrichedRequirement = {
          ...requirement,
          projectName: project.name,
        };

        if (deadline < startOfToday) {
          overdueRequirements.push(enrichedRequirement);
          continue;
        }

        if (deadline <= endOfUpcomingWindow) {
          upcomingRequirements.push(enrichedRequirement);
        }
      }
    }

    if (overdueRequirements.length === 0 && upcomingRequirements.length === 0) {
      return NextResponse.json({
        success: true,
        usersProcessed: 1,
        emailsSent: 0,
        message: "No hay alertas pendientes para enviar.",
      });
    }

    await sendAlertDigestEmail({
      to: fullUser.email,
      userName: fullUser.name,
      overdueRequirements,
      upcomingRequirements,
    });

    return NextResponse.json({
      success: true,
      usersProcessed: 1,
      emailsSent: 1,
      message: "Informe enviado correctamente.",
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

function wasNotifiedToday(
  lastNotifiedAt: Date | null,
  startOfToday: Date
) {
  if (!lastNotifiedAt) {
    return false;
  }

  return lastNotifiedAt >= startOfToday;
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
