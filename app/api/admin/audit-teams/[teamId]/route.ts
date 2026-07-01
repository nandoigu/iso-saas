import { NextResponse } from "next/server";
import { forbidden, getAuthSession, isAdminRole, unauthorized } from "@/app/lib/auth";
import { getAuditTeam, updateAuditTeam } from "@/services/audit-team.service";
import { AUDIT_TEAM_STATUSES } from "@/services/audit-team.types";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const user = await getAuthSession(req);
    if (!user) return unauthorized();
    if (!isAdminRole(user.role)) return forbidden();

    const { teamId } = await params;
    const team = await getAuditTeam(teamId, user.companyId ?? "");

    if (!team) {
      return NextResponse.json({ error: "Equipo no encontrado." }, { status: 404 });
    }

    return NextResponse.json({ data: team });
  } catch (error) {
    console.error("ERROR GET /api/admin/audit-teams/[teamId]:", error);
    return NextResponse.json({ error: "No se pudo cargar el equipo." }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const user = await getAuthSession(req);
    if (!user) return unauthorized();
    if (!isAdminRole(user.role)) return forbidden();

    const { teamId } = await params;
    const body = await req.json().catch(() => null);

    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Cuerpo de la petición inválido." }, { status: 400 });
    }

    if (body.status !== undefined && !AUDIT_TEAM_STATUSES.includes(body.status)) {
      return NextResponse.json(
        { error: "Estado inválido. Valores permitidos: forming, active, completed, disbanded." },
        { status: 400 }
      );
    }

    const result = await updateAuditTeam(teamId, user.companyId ?? "", {
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.status !== undefined ? { status: body.status } : {}),
    });

    if ("notFound" in result) {
      return NextResponse.json({ error: "Equipo no encontrado." }, { status: 404 });
    }
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 403 });
    }

    return NextResponse.json({ data: result.team });
  } catch (error) {
    console.error("ERROR PATCH /api/admin/audit-teams/[teamId]:", error);
    return NextResponse.json({ error: "No se pudo actualizar el equipo." }, { status: 500 });
  }
}
