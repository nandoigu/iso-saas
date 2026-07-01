import { NextResponse } from "next/server";
import { forbidden, getAuthSession, isAdminRole, unauthorized } from "@/app/lib/auth";
import { createAuditor, listAuditors } from "@/services/audit-team.service";
import { AUDITOR_STATUSES } from "@/services/audit-team.types";

export async function GET(req: Request) {
  try {
    const user = await getAuthSession(req);
    if (!user) return unauthorized();
    if (!isAdminRole(user.role)) return forbidden();

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") ?? undefined;
    const isExternalParam = searchParams.get("isExternal");
    const isExternal =
      isExternalParam === "true" ? true : isExternalParam === "false" ? false : undefined;

    const data = await listAuditors(user.companyId ?? "", { status, isExternal });
    return NextResponse.json({ data });
  } catch (error) {
    console.error("ERROR GET /api/admin/auditors:", error);
    return NextResponse.json({ error: "No se pudieron cargar los auditores." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await getAuthSession(req);
    if (!user) return unauthorized();
    if (!isAdminRole(user.role)) return forbidden();

    const body = await req.json().catch(() => null);
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    const email = typeof body?.email === "string" ? body.email.trim() : "";

    if (!name) {
      return NextResponse.json({ error: "El nombre es obligatorio." }, { status: 400 });
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Email inválido." }, { status: 400 });
    }

    const result = await createAuditor({
      companyId: user.companyId ?? "",
      createdById: user.id,
      name,
      email,
      phone: typeof body.phone === "string" ? body.phone : undefined,
      certificationBody: typeof body.certificationBody === "string" ? body.certificationBody : undefined,
      certificationNumber: typeof body.certificationNumber === "string" ? body.certificationNumber : undefined,
      certificationLevel: typeof body.certificationLevel === "string" ? body.certificationLevel : undefined,
      qualifications: Array.isArray(body.qualifications) ? body.qualifications : undefined,
      isExternal: typeof body.isExternal === "boolean" ? body.isExternal : undefined,
      notes: typeof body.notes === "string" ? body.notes : undefined,
      userId: typeof body.userId === "string" ? body.userId : undefined,
    });

    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 409 });
    }

    return NextResponse.json({ data: result.auditor }, { status: 201 });
  } catch (error) {
    console.error("ERROR POST /api/admin/auditors:", error);
    return NextResponse.json({ error: "No se pudo registrar el auditor." }, { status: 500 });
  }
}

// make AUDITOR_STATUSES available for validation in [auditorId] route
export { AUDITOR_STATUSES };
