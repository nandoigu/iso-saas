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
import { importTemplates } from "@/services/template.service";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const user = await getAuthSession(req, { allowBlocked: true });

    if (!user) {
      return unauthorized();
    }

    if (isBlockedStatus(user.status)) {
      return forbidden(BLOCKED_ACCOUNT_MESSAGE);
    }

    if (!isAdminRole(user.role)) {
      return forbidden("Solo el administrador puede importar plantillas.");
    }

    const formData = await req.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "Debes adjuntar un archivo Excel." },
        { status: 400 }
      );
    }

    const upload = await readSafeXlsxUpload(file);

    if (!upload.ok) {
      return NextResponse.json({ error: upload.error }, { status: 400 });
    }

    const buffer = Buffer.from(upload.buffer);
    const result = await importTemplates(buffer, file.name);

    return NextResponse.json({
      data: result,
    });
  } catch (error) {
    console.error("ERROR POST /api/import-templates:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No se pudieron importar las plantillas.",
      },
      { status: 500 }
    );
  }
}
