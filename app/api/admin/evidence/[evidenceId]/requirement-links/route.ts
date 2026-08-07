import { NextResponse } from "next/server";
import { forbidden, getAuthSession, isAdminRole, unauthorized } from "@/app/lib/auth";
import { addEvidenceRequirementLink } from "@/services/evidence.service";
import {
  EVIDENCE_REQUIREMENT_LINK_TYPES,
  type EvidenceRequirementLinkType,
} from "@/services/evidence.types";

type RouteContext = { params: Promise<{ evidenceId: string }> };

/**
 * El vinculo normativo es criterio de auditor: admin only, sin excepcion, como toda
 * ruta bajo `/api/admin/` (ADR-004, decision #2).
 */
export async function POST(req: Request, context: RouteContext) {
  try {
    const user = await getAuthSession(req);
    if (!user) return unauthorized();
    if (!isAdminRole(user.role)) return forbidden();

    const { evidenceId } = await context.params;
    const body = await req.json().catch(() => null);

    const requirementId =
      typeof body?.requirementId === "string" ? body.requirementId.trim() : "";
    if (!requirementId) {
      return NextResponse.json(
        { error: "El requisito es obligatorio." },
        { status: 400 }
      );
    }

    const rawLinkType = typeof body.linkType === "string" ? body.linkType.trim() : "";
    if (rawLinkType && !EVIDENCE_REQUIREMENT_LINK_TYPES.includes(rawLinkType as never)) {
      return NextResponse.json(
        {
          error:
            "Tipo de vinculo invalido. Valores permitidos: primary, supporting, contradictory.",
        },
        { status: 400 }
      );
    }

    const result = await addEvidenceRequirementLink({
      evidenceItemId: evidenceId,
      requirementId,
      linkType: (rawLinkType || undefined) as EvidenceRequirementLinkType | undefined,
      addedBy: user.id,
    });

    if ("notFound" in result) {
      const msg =
        result.notFound === "evidence"
          ? "Evidencia no encontrada."
          : "Requisito no encontrado en el proyecto de la evidencia.";
      return NextResponse.json({ error: msg }, { status: 404 });
    }
    if ("conflict" in result) {
      return NextResponse.json({ error: result.conflict }, { status: 409 });
    }

    return NextResponse.json({ data: result.link }, { status: 201 });
  } catch (error) {
    console.error("ERROR POST /api/admin/evidence/[evidenceId]/requirement-links:", error);
    return NextResponse.json(
      { error: "No se pudo vincular la evidencia al requisito." },
      { status: 500 }
    );
  }
}
