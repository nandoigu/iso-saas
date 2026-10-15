import { createReadStream } from "fs";
import { Readable } from "stream";
import { NextResponse } from "next/server";
import { getAuthSession, isAdminRole, unauthorized } from "@/app/lib/auth";
import { contentDisposition } from "@/app/lib/contentDisposition";
import { resolveTemplateFile } from "@/services/document-template.service";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string; templateId: string }> };

// Fijado por formato, nunca deducido del fichero (security-spec).
const CONTENT_TYPES: Record<string, string> = {
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

export async function GET(req: Request, context: RouteContext) {
  try {
    const user = await getAuthSession(req);
    if (!user) return unauthorized();

    const { id: projectId, templateId } = await context.params;
    const result = await resolveTemplateFile(projectId, templateId, {
      userId: user.id,
      isAdmin: isAdminRole(user.role),
    });

    // Un solo cuerpo para todas las causas: no revela si existe el proyecto o la plantilla.
    if ("notFound" in result) {
      return NextResponse.json({ error: "Plantilla no encontrada." }, { status: 404 });
    }

    if ("missing" in result) {
      console.error("plantilla en catalogo sin binario desplegado", {
        projectId,
        templateId,
        fichero: result.fichero,
      });
      return NextResponse.json({ error: "No se pudo descargar la plantilla." }, { status: 500 });
    }

    const cuerpo = Readable.toWeb(createReadStream(result.ruta)) as ReadableStream<Uint8Array>;
    return new Response(cuerpo, {
      status: 200,
      headers: {
        "Content-Type": CONTENT_TYPES[result.formato] ?? "application/octet-stream",
        "Content-Disposition": contentDisposition(result.fichero),
        "Content-Length": String(result.size),
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("ERROR GET /api/projects/[id]/document-templates/[templateId]/file:", error);
    return NextResponse.json({ error: "No se pudo descargar la plantilla." }, { status: 500 });
  }
}
