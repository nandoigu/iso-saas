import { NextResponse } from "next/server";
import { forbidden, getAuthSession, isAdminRole, unauthorized } from "@/app/lib/auth";
import { getAuditor, updateAuditor } from "@/services/audit-team.service";
import { AUDITOR_STATUSES } from "@/services/audit-team.types";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ auditorId: string }> }
) {
  try {
    const user = await getAuthSession(req);
    if (!user) return unauthorized();
    if (!isAdminRole(user.role)) return forbidden();

    const { auditorId } = await params;
    const auditor = await getAuditor(auditorId, user.companyId ?? "");

    if (!auditor) {
      return NextResponse.json({ error: "Auditor no encontrado." }, { status: 404 });
    }

    return NextResponse.json({ data: auditor });
  } catch (error) {
    console.error("ERROR GET /api/admin/auditors/[auditorId]:", error);
    return NextResponse.json({ error: "No se pudo cargar el auditor." }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ auditorId: string }> }
) {
  try {
    const user = await getAuthSession(req);
    if (!user) return unauthorized();
    if (!isAdminRole(user.role)) return forbidden();

    const { auditorId } = await params;
    const body = await req.json().catch(() => null);

    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Cuerpo de la petición inválido." }, { status: 400 });
    }

    if (body.status !== undefined && !AUDITOR_STATUSES.includes(body.status)) {
      return NextResponse.json(
        { error: "Estado inválido. Valores permitidos: active, suspended, retired." },
        { status: 400 }
      );
    }

    const result = await updateAuditor(auditorId, user.companyId ?? "", {
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.phone !== undefined ? { phone: body.phone } : {}),
      ...(body.certificationBody !== undefined ? { certificationBody: body.certificationBody } : {}),
      ...(body.certificationNumber !== undefined ? { certificationNumber: body.certificationNumber } : {}),
      ...(body.certificationLevel !== undefined ? { certificationLevel: body.certificationLevel } : {}),
      ...(body.qualifications !== undefined ? { qualifications: body.qualifications } : {}),
      ...(body.isExternal !== undefined ? { isExternal: body.isExternal } : {}),
      ...(body.notes !== undefined ? { notes: body.notes } : {}),
      ...(body.status !== undefined ? { status: body.status } : {}),
    });

    if ("notFound" in result) {
      return NextResponse.json({ error: "Auditor no encontrado." }, { status: 404 });
    }
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 403 });
    }

    return NextResponse.json({ data: result.auditor });
  } catch (error) {
    console.error("ERROR PATCH /api/admin/auditors/[auditorId]:", error);
    return NextResponse.json({ error: "No se pudo actualizar el auditor." }, { status: 500 });
  }
}
