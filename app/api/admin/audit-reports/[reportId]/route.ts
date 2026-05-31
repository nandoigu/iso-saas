import { NextResponse } from "next/server";
import { forbidden, getAuthSession, isAdminRole, unauthorized } from "@/app/lib/auth";
import {
  deleteAuditReport,
  getAuditReport,
  regenerateAuditReport,
  saveAuditReportContent,
} from "@/services/audit-report.service";
import type { AuditReportContent } from "@/services/audit-report.types";

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
    const body = await req.json().catch(() => null);
    const action = typeof body?.action === "string" ? body.action : "regenerate";
    const report =
      action === "save"
        ? await saveAuditReportContent({
            reportId,
            content: body.content as AuditReportContent,
            createdById: user.id,
          })
        : await regenerateAuditReport(reportId, user.id);

    if (!report) {
      return NextResponse.json({ error: "Informe no encontrado." }, { status: 404 });
    }

    return NextResponse.json({ data: report });
  } catch (error) {
    console.error("ERROR PATCH /api/admin/audit-reports/[reportId]:", error);
    return NextResponse.json({ error: "No se pudo guardar o versionar el informe." }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ reportId: string }> }
) {
  try {
    const user = await getAuthSession(req);

    if (!user) return unauthorized();
    if (!isAdminRole(user.role)) return forbidden();

    const { reportId } = await params;
    const deleted = await deleteAuditReport(reportId);

    if (!deleted) {
      return NextResponse.json({ error: "Informe no encontrado." }, { status: 404 });
    }

    return NextResponse.json({ data: { id: deleted.id } });
  } catch (error) {
    console.error("ERROR DELETE /api/admin/audit-reports/[reportId]:", error);
    return NextResponse.json({ error: "No se pudo eliminar el informe." }, { status: 500 });
  }
}
