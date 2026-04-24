import { NextResponse } from "next/server";
import { forbidden, getAuthSession, isAdminRole, unauthorized } from "@/app/lib/auth";
import { parseRequirementTemplateWorkbook } from "@/app/lib/requirementImport";
import { prisma } from "@/app/lib/prisma";

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

    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      return NextResponse.json(
        { error: "Formato no valido. Solo se aceptan archivos .xlsx." },
        { status: 400 }
      );
    }

    const buffer = await file.arrayBuffer();
    const parsed = parseRequirementTemplateWorkbook(buffer);
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
      await prisma.requirementTemplate.deleteMany();
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
