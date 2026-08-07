import { NextResponse } from "next/server";
import { getAuthSession, isAdminRole, unauthorized } from "@/app/lib/auth";
import { submitEvidenceItem } from "@/services/evidence.service";

type RouteContext = { params: Promise<{ evidenceId: string }> };

/**
 * `draft → submitted` (ADR-004, decision #1). Presentar la evidencia es un acto del
 * auditado, no del auditor: por eso esta ruta no cuelga de `/api/admin/`.
 */
export async function POST(req: Request, context: RouteContext) {
  try {
    const user = await getAuthSession(req);
    if (!user) return unauthorized();

    const { evidenceId } = await context.params;
    const result = await submitEvidenceItem(evidenceId, {
      userId: user.id,
      isAdmin: isAdminRole(user.role),
    });

    if ("notFound" in result) {
      return NextResponse.json({ error: "Evidencia no encontrada." }, { status: 404 });
    }
    if ("conflict" in result) {
      return NextResponse.json({ error: result.conflict }, { status: 409 });
    }

    return NextResponse.json({ data: result.item });
  } catch (error) {
    console.error("ERROR POST /api/evidence/[evidenceId]/submit:", error);
    return NextResponse.json(
      { error: "No se pudo presentar la evidencia a revision." },
      { status: 500 }
    );
  }
}
