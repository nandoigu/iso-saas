import { NextResponse } from "next/server";
import { forbidden, getAuthSession, isAdminRole, unauthorized } from "@/app/lib/auth";
import { getAuditReport, regenerateAuditReport } from "@/services/audit-report.service";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ reportId: string }> }
) {
  try {
    const user = await getAuthSession(req);

    if (!user) return unauthorized();
    if (!isAdminRole(user.role)) return forbidden();

    const { reportId } = await params;
    const report = await getAuditReport(reportId);

    if (!report) {
      return NextResponse.json({ error: "Informe no encontrado." }, { status: 404 });
    }

    return NextResponse.json({ data: report });
  } catch (error) {
    console.error("ERROR GET /api/admin/audit-reports/[reportId]:", error);
    return NextResponse.json({ error: "No se pudo cargar el informe." }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ reportId: string }> }
) {
  try {
    const user = await getAuthSession(req);

    if (!user) return unauthorized();
    if (!isAdminRole(user.role)) return forbidden();

    const { reportId } = await params;
    const report = await regenerateAuditReport(reportId, user.id);

    if (!report) {
      return NextResponse.json({ error: "Informe no encontrado." }, { status: 404 });
    }

    return NextResponse.json({ data: report });
  } catch (error) {
    console.error("ERROR PATCH /api/admin/audit-reports/[reportId]:", error);
    return NextResponse.json({ error: "No se pudo versionar el informe." }, { status: 500 });
  }
}
