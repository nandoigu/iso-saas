import { NextResponse } from "next/server";
import { forbidden, getAuthSession, isAdminRole, unauthorized } from "@/app/lib/auth";
import { generateAuditReportDocx } from "@/services/audit-report.docx";
import { generateAuditReportPdf } from "@/services/audit-report.pdf";
import { getAuditReport } from "@/services/audit-report.service";
import type { AuditReportContent } from "@/services/audit-report.types";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ reportId: string; format: string }> }
) {
  try {
    const user = await getAuthSession(req);

    if (!user) return unauthorized();
    if (!isAdminRole(user.role)) return forbidden();

    const { reportId, format } = await params;
    const report = await getAuditReport(reportId);

    if (!report) {
      return NextResponse.json({ error: "Informe no encontrado." }, { status: 404 });
    }

    const content = report.generatedContent as unknown as AuditReportContent;

    if (format === "docx") {
      const buffer = await generateAuditReportDocx(content);
      return fileResponse(buffer, "application/vnd.openxmlformats-officedocument.wordprocessingml.document", `${report.reportNumber}-v${report.version}.docx`);
    }

    if (format === "pdf") {
      const buffer = await generateAuditReportPdf(content);
      return fileResponse(buffer, "application/pdf", `${report.reportNumber}-v${report.version}.pdf`);
    }

    return NextResponse.json({ error: "Formato no soportado." }, { status: 400 });
  } catch (error) {
    console.error("ERROR GET /api/admin/audit-reports/[reportId]/export/[format]:", error);
    return NextResponse.json({ error: "No se pudo exportar el informe." }, { status: 500 });
  }
}

function fileResponse(buffer: Buffer, contentType: string, filename: string) {
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
