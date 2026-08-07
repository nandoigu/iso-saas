import { NextResponse } from "next/server";
import { forbidden, getAuthSession, isAdminRole, unauthorized } from "@/app/lib/auth";
import { createEvidenceValidation } from "@/services/evidence.service";
import {
  EVIDENCE_VALIDATION_OUTCOMES,
  type EvidenceValidationOutcome,
} from "@/services/evidence.types";

type RouteContext = { params: Promise<{ evidenceId: string }> };

/**
 * Punto de control humano obligatorio (invariante #1). `validatedBy` sale siempre de
 * la sesion: aceptarlo del body permitiria atribuirse la validacion de otro admin.
 */
export async function POST(req: Request, context: RouteContext) {
  try {
    const user = await getAuthSession(req);
    if (!user) return unauthorized();
    if (!isAdminRole(user.role)) return forbidden();

    const { evidenceId } = await context.params;
    const body = await req.json().catch(() => null);

    const outcome = typeof body?.outcome === "string" ? body.outcome.trim() : "";
    if (!EVIDENCE_VALIDATION_OUTCOMES.includes(outcome as EvidenceValidationOutcome)) {
      return NextResponse.json(
        {
          error:
            "Resultado invalido. Valores permitidos: approved, rejected, pending_clarification.",
        },
        { status: 400 }
      );
    }

    const result = await createEvidenceValidation({
      evidenceItemId: evidenceId,
      outcome: outcome as EvidenceValidationOutcome,
      notes: typeof body.notes === "string" ? body.notes : undefined,
      validatedBy: user.id,
    });

    if ("notFound" in result) {
      return NextResponse.json({ error: "Evidencia no encontrada." }, { status: 404 });
    }
    if ("conflict" in result) {
      return NextResponse.json({ error: result.conflict }, { status: 409 });
    }

    return NextResponse.json(
      { data: result.validation, evidenceStatus: result.evidenceStatus },
      { status: 201 }
    );
  } catch (error) {
    console.error("ERROR POST /api/admin/evidence/[evidenceId]/validate:", error);
    return NextResponse.json(
      { error: "No se pudo registrar la validacion." },
      { status: 500 }
    );
  }
}
