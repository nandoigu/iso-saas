import { NextResponse } from "next/server";
import { forbidden, getAuthSession, isAdminRole, unauthorized } from "@/app/lib/auth";
import { addAuditTeamMember } from "@/services/audit-team.service";
import { MEMBER_ROLES } from "@/services/audit-team.types";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const user = await getAuthSession(req);
    if (!user) return unauthorized();
    if (!isAdminRole(user.role)) return forbidden();

    const { teamId } = await params;
    const body = await req.json().catch(() => null);
    const auditorId = typeof body?.auditorId === "string" ? body.auditorId.trim() : "";
    const role = typeof body?.role === "string" ? body.role.trim() : "";

    if (!auditorId) {
      return NextResponse.json({ error: "El auditor es obligatorio." }, { status: 400 });
    }
    if (!MEMBER_ROLES.includes(role as never)) {
      return NextResponse.json(
        { error: "Rol inválido. Valores permitidos: lead_auditor, support_auditor, technical_expert." },
        { status: 400 }
      );
    }

    const result = await addAuditTeamMember({
      auditTeamId: teamId,
      auditorId,
      role: role as (typeof MEMBER_ROLES)[number],
      notes: typeof body.notes === "string" ? body.notes : undefined,
      createdById: user.id,
    });

    if ("notFound" in result) {
      const msg = result.notFound === "team" ? "Equipo no encontrado." : "Auditor no encontrado o inactivo.";
      return NextResponse.json({ error: msg }, { status: 404 });
    }
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 409 });
    }

    return NextResponse.json({ data: result.member }, { status: 201 });
  } catch (error) {
    console.error("ERROR POST /api/admin/audit-teams/[teamId]/members:", error);
    return NextResponse.json({ error: "No se pudo añadir el miembro." }, { status: 500 });
  }
}
