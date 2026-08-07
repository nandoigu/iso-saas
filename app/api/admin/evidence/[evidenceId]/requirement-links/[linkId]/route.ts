import { NextResponse } from "next/server";
import { forbidden, getAuthSession, isAdminRole, unauthorized } from "@/app/lib/auth";
import { removeEvidenceRequirementLink } from "@/services/evidence.service";

type RouteContext = { params: Promise<{ evidenceId: string; linkId: string }> };

export async function DELETE(req: Request, context: RouteContext) {
  try {
    const user = await getAuthSession(req);
    if (!user) return unauthorized();
    if (!isAdminRole(user.role)) return forbidden();

    const { evidenceId, linkId } = await context.params;
    const result = await removeEvidenceRequirementLink(evidenceId, linkId);

    if ("notFound" in result) {
      return NextResponse.json({ error: "Vinculo no encontrado." }, { status: 404 });
    }

    return NextResponse.json({ deleted: true, id: result.id });
  } catch (error) {
    console.error(
      "ERROR DELETE /api/admin/evidence/[evidenceId]/requirement-links/[linkId]:",
      error
    );
    return NextResponse.json(
      { error: "No se pudo eliminar el vinculo." },
      { status: 500 }
    );
  }
}
