import { NextResponse } from "next/server";
import { forbidden, getAuthSession, isAdminRole, unauthorized } from "@/app/lib/auth";
import { updateAuditTeamMember } from "@/services/audit-team.service";
import { UPDATABLE_MEMBER_STATUSES } from "@/services/audit-team.types";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ teamId: string; memberId: string }> }
) {
  try {
    const user = await getAuthSession(req);
    if (!user) return unauthorized();
    if (!isAdminRole(user.role)) return forbidden();

    const { teamId, memberId } = await params;
    const body = await req.json().catch(() => null);

    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Cuerpo de la petición inválido." }, { status: 400 });
    }

    if (
      body.status !== undefined &&
      !(UPDATABLE_MEMBER_STATUSES as readonly string[]).includes(body.status)
    ) {
      return NextResponse.json(
        { error: "Estado inválido. Valores permitidos: confirmed, active, withdrawn, completed." },
        { status: 400 }
      );
    }

    const result = await updateAuditTeamMember(memberId, teamId, user.companyId ?? "", {
      ...(body.status !== undefined ? { status: body.status } : {}),
      ...(body.withdrawnReason !== undefined ? { withdrawnReason: body.withdrawnReason } : {}),
      ...(body.notes !== undefined ? { notes: body.notes } : {}),
    });

    if ("notFound" in result) {
      return NextResponse.json({ error: "Miembro no encontrado." }, { status: 404 });
    }
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 409 });
    }

    return NextResponse.json({ data: result.member });
  } catch (error) {
    console.error("ERROR PATCH /api/admin/audit-teams/[teamId]/members/[memberId]:", error);
    return NextResponse.json({ error: "No se pudo actualizar el miembro." }, { status: 500 });
  }
}
