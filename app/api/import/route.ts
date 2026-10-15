import { NextResponse } from "next/server";
import { forbidden, getAuthSession, isAdminRole, unauthorized } from "@/app/lib/auth";
import { readSafeXlsxUpload } from "@/app/lib/excelUpload";
import { parseRequirementTemplateWorkbook } from "@/app/lib/requirementImport";
import { prisma } from "@/app/lib/prisma";
import { isForeignKeyError } from "@/app/lib/prismaErrors";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const user = await getAuthSession(req);

    if (!user) {
      return unauthorized();
    }

    if (!isAdminRole(user.role)) {
      return forbidden("Solo el administrador puede importar plantillas globales.");
    }

    const formData = await req.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "Debes subir un archivo .xlsx." },
        { status: 400 }
      );
    }

    const upload = await readSafeXlsxUpload(file);

    if (!upload.ok) {
      return NextResponse.json({ error: upload.error }, { status: 400 });
    }

    const parsed = await parseRequirementTemplateWorkbook(upload.buffer);
    const replaceExisting = formData.get("replace") === "true";

    if (parsed.errors.length > 0) {
      return NextResponse.json(
        {
          error: "El archivo tiene errores de formato.",
          details: parsed.errors,
        },
        { status: 400 }
      );
    }

    if (replaceExisting) {
      try {
        await prisma.requirementTemplate.deleteMany();
      } catch (error) {
        // DocumentTemplateRequirement es Restrict hacia RequirementTemplate (domain model,
        // decision del usuario 13-oct): el catalogo de requisitos no se reemplaza en silencio.
        if (isForeignKeyError(error)) {
          return NextResponse.json(
            {
              error:
                "No se puede reemplazar el catálogo de requisitos: hay plantillas documentales que justifican algunos de ellos.",
            },
            { status: 409 }
          );
        }
        throw error;
      }
    }

    const result = await prisma.requirementTemplate.createMany({
      data: parsed.rows,
      skipDuplicates: true,
    });

    return NextResponse.json({
      data: {
        imported: result.count,
        skippedDuplicates: parsed.skippedDuplicates + (parsed.rows.length - result.count),
        totalRows: parsed.rows.length,
        replaced: replaceExisting,
      },
    });
  } catch (error) {
    console.error("ERROR POST /api/import:", error);
    return NextResponse.json(
      { error: "Error importando requisitos desde Excel." },
      { status: 500 }
    );
  }
}
