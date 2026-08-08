import { NextResponse } from "next/server";
import { getAuthSession, isAdminRole, unauthorized } from "@/app/lib/auth";
import {
  deleteEvidenceItem,
  getEvidenceItem,
  updateEvidenceItem,
} from "@/services/evidence.service";

const MAX_TITLE_LENGTH = 255;

type RouteContext = { params: Promise<{ evidenceId: string }> };

export async function GET(req: Request, context: RouteContext) {
  try {
    const user = await getAuthSession(req);
    if (!user) return unauthorized();

    const { evidenceId } = await context.params;
    const item = await getEvidenceItem(evidenceId, {
      userId: user.id,
      isAdmin: isAdminRole(user.role),
    });

    // Fuera del tenant se responde 404, nunca 403: no se revela que existe.
    if (!item) {
      return NextResponse.json({ error: "Evidencia no encontrada." }, { status: 404 });
    }

    return NextResponse.json({ data: item });
  } catch (error) {
    console.error("ERROR GET /api/evidence/[evidenceId]:", error);
    return NextResponse.json(
      { error: "No se pudo cargar la evidencia." },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request, context: RouteContext) {
  try {
    const user = await getAuthSession(req);
    if (!user) return unauthorized();

    const { evidenceId } = await context.params;
    const body = await req.json().catch(() => null);
    const actor = { userId: user.id, isAdmin: isAdminRole(user.role) };

    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Cuerpo de peticion invalido." }, { status: 400 });
    }

    const title = typeof body.title === "string" ? body.title.trim() : undefined;
    if (title !== undefined && !title) {
      return NextResponse.json(
        { error: "El titulo no puede quedar vacio." },
        { status: 400 }
      );
    }
    if (title !== undefined && title.length > MAX_TITLE_LENGTH) {
      return NextResponse.json(
        { error: `El titulo no puede superar los ${MAX_TITLE_LENGTH} caracteres.` },
        { status: 400 }
      );
    }

    const description =
      typeof body.description === "string" ? body.description : undefined;
    const sourceRef = typeof body.sourceRef === "string" ? body.sourceRef : undefined;

    if (title === undefined && description === undefined && sourceRef === undefined) {
      return NextResponse.json(
        { error: "No hay nada que actualizar. Indica titulo, descripcion o archivo." },
        { status: 400 }
      );
    }

    // `status`, `version` y `projectId` no son actualizables por esta via.
    const result = await updateEvidenceItem(
      evidenceId,
      { title, description, sourceRef, updatedBy: user.id },
      actor
    );

    if ("notFound" in result) {
      return NextResponse.json({ error: "Evidencia no encontrada." }, { status: 404 });
    }
    // Inalcanzable mientras la comprobacion de campos de arriba siga en su sitio; se
    // mapea igualmente para que el servicio pueda endurecerse sin dejar el handler
    // devolviendo un 500 por una rama no contemplada.
    if ("invalid" in result) {
      return NextResponse.json({ error: result.invalid }, { status: 400 });
    }
    if ("conflict" in result) {
      return NextResponse.json({ error: result.conflict }, { status: 409 });
    }

    // El contrato exige devolver el mismo shape que GET, con vinculos y validaciones.
    const detail = await getEvidenceItem(evidenceId, actor);
    return NextResponse.json({ data: detail });
  } catch (error) {
    console.error("ERROR PATCH /api/evidence/[evidenceId]:", error);
    return NextResponse.json(
      { error: "No se pudo actualizar la evidencia." },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request, context: RouteContext) {
  try {
    const user = await getAuthSession(req);
    if (!user) return unauthorized();

    const { evidenceId } = await context.params;
    const result = await deleteEvidenceItem(evidenceId, {
      userId: user.id,
      isAdmin: isAdminRole(user.role),
    });

    if ("notFound" in result) {
      return NextResponse.json({ error: "Evidencia no encontrada." }, { status: 404 });
    }
    // Invariante #3: citada en un informe es inmutable. La salida es archivarla.
    if ("conflict" in result) {
      return NextResponse.json({ error: result.conflict }, { status: 409 });
    }

    return NextResponse.json({ deleted: true, id: result.id });
  } catch (error) {
    console.error("ERROR DELETE /api/evidence/[evidenceId]:", error);
    return NextResponse.json(
      { error: "No se pudo eliminar la evidencia." },
      { status: 500 }
    );
  }
}
