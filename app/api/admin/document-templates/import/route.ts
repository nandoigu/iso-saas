import { NextResponse } from "next/server";
import {
  BLOCKED_ACCOUNT_MESSAGE,
  forbidden,
  getAuthSession,
  isAdminRole,
  isBlockedStatus,
  unauthorized,
} from "@/app/lib/auth";
import { readSafeXlsxUpload } from "@/app/lib/excelUpload";
import { parseDocumentTemplateWorkbook } from "@/app/lib/documentTemplateImport";
import { importDocumentTemplates } from "@/services/document-template.service";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const user = await getAuthSession(req, { allowBlocked: true });
    if (!user) return unauthorized();
    if (isBlockedStatus(user.status)) return forbidden(BLOCKED_ACCOUNT_MESSAGE);
    if (!isAdminRole(user.role)) {
      return forbidden("Solo el administrador puede importar el catálogo documental.");
    }

    const formData = await req.formData().catch(() => null);
    const file = formData?.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Debes subir un archivo .xlsx." }, { status: 400 });
    }

    const upload = await readSafeXlsxUpload(file);
    if (!upload.ok) return NextResponse.json({ error: upload.error }, { status: 400 });

    const parsed = await parseDocumentTemplateWorkbook(upload.buffer);
    if (parsed.errors.length > 0) {
      return NextResponse.json(
        { error: "El libro tiene errores.", details: parsed.errors },
        { status: 400 }
      );
    }

    // El actor sale de la sesion; el cuerpo no acepta actores (security-spec).
    const result = await importDocumentTemplates(parsed.rows, user.id);
    if (!result.ok) {
      return NextResponse.json(
        { error: "El libro tiene errores.", details: result.errors },
        { status: 400 }
      );
    }

    return NextResponse.json({ data: result.summary });
  } catch (error) {
    console.error("ERROR POST /api/admin/document-templates/import:", error);
    return NextResponse.json(
      { error: "No se pudo importar el catálogo documental." },
      { status: 500 }
    );
  }
}
