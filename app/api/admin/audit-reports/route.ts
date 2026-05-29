import { NextResponse } from "next/server";
import { forbidden, getAuthSession, isAdminRole, unauthorized } from "@/app/lib/auth";
import {
  buildInputFromProject,
  createAuditReport,
  listAuditReports,
} from "@/services/audit-report.service";

export async function GET(req: Request) {
  try {
    const user = await getAuthSession(req);

    if (!user) return unauthorized();
    if (!isAdminRole(user.role)) return forbidden();

    const reports = await listAuditReports();
    return NextResponse.json({ data: reports });
  } catch (error) {
    console.error("ERROR GET /api/admin/audit-reports:", error);
    return NextResponse.json({ error: "No se pudieron cargar los informes." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await getAuthSession(req);

    if (!user) return unauthorized();
    if (!isAdminRole(user.role)) return forbidden();

    const body = await req.json();
    const projectId = typeof body.projectId === "string" ? body.projectId : "";

    if (!projectId) {
      return NextResponse.json({ error: "Debes indicar el proyecto." }, { status: 400 });
    }

    const input = await buildInputFromProject(projectId, body);

    if (!input) {
      return NextResponse.json({ error: "Proyecto no encontrado." }, { status: 404 });
    }

    const report = await createAuditReport(input, user.id);
    return NextResponse.json({ data: report }, { status: 201 });
  } catch (error) {
    console.error("ERROR POST /api/admin/audit-reports:", error);
    return NextResponse.json({ error: "No se pudo generar el informe." }, { status: 500 });
  }
}
