import { NextResponse } from "next/server";
import { getAuthSession, isAdminRole, unauthorized } from "@/app/lib/auth";
import { createEvidenceItem, listEvidenceItems } from "@/services/evidence.service";
import { EVIDENCE_TYPES, type EvidenceType } from "@/services/evidence.types";

const MAX_TITLE_LENGTH = 255;

/**
 * El contrato nombra el segmento `[projectId]`, pero `app/api/projects/[id]` ya
 * existe y Next.js prohibe dos slugs distintos en el mismo nivel. La URL publica
 * es la del contrato; solo cambia el nombre interno del parametro.
 */
type RouteContext = { params: Promise<{ id: string }> };

export async function GET(req: Request, context: RouteContext) {
  try {
    const user = await getAuthSession(req);
    if (!user) return unauthorized();

    const { id: projectId } = await context.params;
    const url = new URL(req.url);

    const result = await listEvidenceItems(
      projectId,
      { userId: user.id, isAdmin: isAdminRole(user.role) },
      {
        status: url.searchParams.get("status") ?? undefined,
        requirementId: url.searchParams.get("requirementId") ?? undefined,
      }
    );

    if ("notFound" in result) {
      return NextResponse.json({ error: "Proyecto no encontrado." }, { status: 404 });
    }

    return NextResponse.json({ data: result.items });
  } catch (error) {
    console.error("ERROR GET /api/projects/[id]/evidence:", error);
    return NextResponse.json(
      { error: "No se pudo cargar la evidencia del proyecto." },
      { status: 500 }
    );
  }
}

export async function POST(req: Request, context: RouteContext) {
  try {
    const user = await getAuthSession(req);
    if (!user) return unauthorized();

    const { id: projectId } = await context.params;
    const body = await req.json().catch(() => null);

    const title = typeof body?.title === "string" ? body.title.trim() : "";
    const type = typeof body?.type === "string" ? body.type.trim() : "";

    if (!title) {
      return NextResponse.json({ error: "El titulo es obligatorio." }, { status: 400 });
    }
    if (title.length > MAX_TITLE_LENGTH) {
      return NextResponse.json(
        { error: `El titulo no puede superar los ${MAX_TITLE_LENGTH} caracteres.` },
        { status: 400 }
      );
    }
    if (!EVIDENCE_TYPES.includes(type as EvidenceType)) {
      return NextResponse.json(
        { error: "Tipo invalido. Valores permitidos: document, record, declaration." },
        { status: 400 }
      );
    }

    // `status` nunca se acepta del body (siempre nace en `draft`) y `createdBy`
    // sale de la sesion, nunca del cliente (security-spec, audit trail).
    const result = await createEvidenceItem(
      {
        projectId,
        title,
        description: typeof body.description === "string" ? body.description : undefined,
        type: type as EvidenceType,
        sourceRef: typeof body.sourceRef === "string" ? body.sourceRef : undefined,
        createdBy: user.id,
      },
      { userId: user.id, isAdmin: isAdminRole(user.role) }
    );

    if ("notFound" in result) {
      return NextResponse.json({ error: "Proyecto no encontrado." }, { status: 404 });
    }

    const { item } = result;
    return NextResponse.json(
      {
        data: {
          id: item.id,
          projectId: item.projectId,
          title: item.title,
          type: item.type,
          status: item.status,
          version: item.version,
          createdAt: item.createdAt,
          createdBy: item.createdBy,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("ERROR POST /api/projects/[id]/evidence:", error);
    return NextResponse.json(
      { error: "No se pudo registrar la evidencia." },
      { status: 500 }
    );
  }
}
