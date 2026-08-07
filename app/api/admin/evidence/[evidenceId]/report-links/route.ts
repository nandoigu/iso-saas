import { NextResponse } from "next/server";
import { forbidden, getAuthSession, isAdminRole, unauthorized } from "@/app/lib/auth";
import { addEvidenceReportLink } from "@/services/evidence.service";
import {
  EVIDENCE_REPORT_LINK_USAGES,
  type EvidenceReportLinkUsage,
} from "@/services/evidence.types";

type RouteContext = { params: Promise<{ evidenceId: string }> };

/**
 * Citar evidencia en un informe. El servicio aplica en transaccion las invariantes
 * #2 (solo evidencia validada) y #7 (informe cerrado no admite citas nuevas): son el
 * corte que impide que evidencia sin revisar llegue a un informe firmado.
 */
export async function POST(req: Request, context: RouteContext) {
  try {
    const user = await getAuthSession(req);
    if (!user) return unauthorized();
    if (!isAdminRole(user.role)) return forbidden();

    const { evidenceId } = await context.params;
    const body = await req.json().catch(() => null);

    const auditReportId =
      typeof body?.auditReportId === "string" ? body.auditReportId.trim() : "";
    if (!auditReportId) {
      return NextResponse.json({ error: "El informe es obligatorio." }, { status: 400 });
    }

    const rawUsedAs = typeof body.usedAs === "string" ? body.usedAs.trim() : "";
    if (rawUsedAs && !EVIDENCE_REPORT_LINK_USAGES.includes(rawUsedAs as never)) {
      return NextResponse.json(
        {
          error:
            "Uso invalido. Valores permitidos: supporting, conclusion_basis, referenced.",
        },
        { status: 400 }
      );
    }

    const result = await addEvidenceReportLink({
      evidenceItemId: evidenceId,
      auditReportId,
      usedAs: (rawUsedAs || undefined) as EvidenceReportLinkUsage | undefined,
      addedBy: user.id,
    });

    if ("notFound" in result) {
      const msg =
        result.notFound === "evidence"
          ? "Evidencia no encontrada."
          : "Informe no encontrado en el proyecto de la evidencia.";
      return NextResponse.json({ error: msg }, { status: 404 });
    }
    if ("conflict" in result) {
      return NextResponse.json({ error: result.conflict }, { status: 409 });
    }

    return NextResponse.json({ data: result.link }, { status: 201 });
  } catch (error) {
    console.error("ERROR POST /api/admin/evidence/[evidenceId]/report-links:", error);
    return NextResponse.json(
      { error: "No se pudo citar la evidencia en el informe." },
      { status: 500 }
    );
  }
}
