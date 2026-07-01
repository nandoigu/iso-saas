import { NextResponse } from "next/server";
import { forbidden, getAuthSession, isAdminRole, unauthorized } from "@/app/lib/auth";
import { createAuditTeam, listAuditTeams } from "@/services/audit-team.service";

export async function GET(req: Request) {
  try {
    const user = await getAuthSession(req);
    if (!user) return unauthorized();
    if (!isAdminRole(user.role)) return forbidden();

    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId") ?? undefined;
    const status = searchParams.get("status") ?? undefined;

    const data = await listAuditTeams(user.companyId ?? "", { projectId, status });
    return NextResponse.json({ data });
  } catch (error) {
    console.error("ERROR GET /api/admin/audit-teams:", error);
    return NextResponse.json({ error: "No se pudieron cargar los equipos." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await getAuthSession(req);
    if (!user) return unauthorized();
    if (!isAdminRole(user.role)) return forbidden();

    const body = await req.json().catch(() => null);
    const projectId = typeof body?.projectId === "string" ? body.projectId.trim() : "";
    const auditId = typeof body?.auditId === "string" ? body.auditId.trim() : "";

    if (!projectId) {
      return NextResponse.json({ error: "El proyecto es obligatorio." }, { status: 400 });
    }
    if (!auditId) {
      return NextResponse.json({ error: "El identificador de auditoría es obligatorio." }, { status: 400 });
    }

    const result = await createAuditTeam({
      companyId: user.companyId ?? "",
      projectId,
      auditId,
      name: typeof body.name === "string" ? body.name.trim() : undefined,
      createdById: user.id,
    });

    if ("notFound" in result) {
      return NextResponse.json({ error: "Proyecto no encontrado." }, { status: 404 });
    }

    return NextResponse.json({ data: result.team }, { status: 201 });
  } catch (error) {
    console.error("ERROR POST /api/admin/audit-teams:", error);
    return NextResponse.json({ error: "No se pudo crear el equipo." }, { status: 500 });
  }
}
