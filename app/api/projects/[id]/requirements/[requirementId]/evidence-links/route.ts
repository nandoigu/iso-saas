import { NextResponse } from "next/server";
import { getAuthSession, isAdminRole, unauthorized } from "@/app/lib/auth";
import { declareEvidenceRequirementLink } from "@/services/evidence.service";
import {
  DECLARABLE_REQUIREMENT_LINK_TYPES,
  EVIDENCE_REQUIREMENT_LINK_TYPES,
  type EvidenceRequirementLinkType,
} from "@/services/evidence.types";

type RouteContext = { params: Promise<{ id: string; requirementId: string }> };

/**
 * Declaracion del vinculo evidencia-requisito por el dueno del proyecto (ADR-010).
 *
 * No lleva `isAdminRole` a proposito, y no es una omision: ADR-010 acota el punto #2
 * de ADR-004 separando dos actos que antes eran uno. Declarar que un documento se
 * presenta para un requisito es una aportacion del dueno; confirmar que efectivamente
 * lo sustenta sigue siendo del auditor y se queda bajo `/api/admin/`.
 *
 * Por eso esta ruta cuelga del requisito y no de la evidencia: el gesto que la origina
 * es "subo este papel para este requisito", no "clasifico este papel".
 */
export async function POST(req: Request, context: RouteContext) {
  try {
    const user = await getAuthSession(req);
    if (!user) return unauthorized();

    const { id: projectId, requirementId } = await context.params;
    const body = await req.json().catch(() => null);

    const evidenceItemId =
      typeof body?.evidenceItemId === "string" ? body.evidenceItemId.trim() : "";
    if (!evidenceItemId) {
      return NextResponse.json(
        { error: "La evidencia es obligatoria." },
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

    // 403 y no 400: el valor existe y es valido, pero este actor no puede emitirlo.
    // Marcar un documento como contradictorio es juzgar el cumplimiento, y ademas
    // manda la evidencia a `under_review`. Es del auditor (ADR-010).
    if (rawLinkType && !DECLARABLE_REQUIREMENT_LINK_TYPES.includes(rawLinkType as never)) {
      return NextResponse.json(
        {
          error:
            "Solo el auditor puede marcar una evidencia como contradictoria. Valores permitidos aqui: primary, supporting.",
        },
        { status: 403 }
      );
    }

    const result = await declareEvidenceRequirementLink({
      projectId,
      requirementId,
      evidenceItemId,
      linkType: (rawLinkType || undefined) as EvidenceRequirementLinkType | undefined,
      actor: { userId: user.id, isAdmin: isAdminRole(user.role) },
    });

    if ("notFound" in result) {
      const msg =
        result.notFound === "project"
          ? "Proyecto no encontrado."
          : result.notFound === "requirement"
            ? "Requisito no encontrado en el proyecto."
            : "Evidencia no encontrada en el proyecto.";
      return NextResponse.json({ error: msg }, { status: 404 });
    }
    if ("conflict" in result) {
      return NextResponse.json({ error: result.conflict }, { status: 409 });
    }

    return NextResponse.json({ data: result.link }, { status: 201 });
  } catch (error) {
    console.error(
      "ERROR POST /api/projects/[id]/requirements/[requirementId]/evidence-links:",
      error
    );
    return NextResponse.json(
      { error: "No se pudo declarar la evidencia para el requisito." },
      { status: 500 }
    );
  }
}
