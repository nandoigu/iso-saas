import { NextResponse } from "next/server";
import { getAuthSession, isAdminRole, unauthorized } from "@/app/lib/auth";
import { listApplicableTemplates } from "@/services/document-template.service";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(req: Request, context: RouteContext) {
  try {
    const user = await getAuthSession(req);
    if (!user) return unauthorized();

    const { id: projectId } = await context.params;
    const result = await listApplicableTemplates(projectId, {
      userId: user.id,
      isAdmin: isAdminRole(user.role),
    });

    if ("notFound" in result) {
      return NextResponse.json({ error: "Proyecto no encontrado." }, { status: 404 });
    }

    return NextResponse.json({ data: result });
  } catch (error) {
    console.error("ERROR GET /api/projects/[id]/document-templates:", error);
    return NextResponse.json(
      { error: "No se pudo cargar la documentación del proyecto." },
      { status: 500 }
    );
  }
}
