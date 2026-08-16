import { NextResponse } from "next/server";
import type { HandleUploadBody } from "@vercel/blob/client";
import { getAuthSession, isAdminRole, unauthorized } from "@/app/lib/auth";
import { assertProjectAccess } from "@/services/evidence.service";
import {
  EvidencePathnameRejected,
  handleEvidenceUploadToken,
} from "@/services/evidence-storage.service";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Emision del token que autoriza al cliente a escribir directamente en el store
 * (ADR-004, decision #3). El binario nunca atraviesa la funcion serverless, que
 * tiene un limite de ~4,5 MB de body incompatible con planos BIM.
 *
 * Este es el punto critico de seguridad del flujo de subida: sesion y pertenencia
 * del proyecto se comprueban ANTES de conceder escritura, y el pathname se acota
 * al prefijo del proyecto dentro del propio handshake.
 */
export async function POST(req: Request, context: RouteContext) {
  try {
    const user = await getAuthSession(req);
    if (!user) return unauthorized();

    const { id: projectId } = await context.params;
    const access = await assertProjectAccess(projectId, {
      userId: user.id,
      isAdmin: isAdminRole(user.role),
    });

    if ("notFound" in access) {
      return NextResponse.json({ error: "Proyecto no encontrado." }, { status: 404 });
    }

    const body = (await req.json()) as HandleUploadBody;
    const result = await handleEvidenceUploadToken({
      request: req,
      body,
      projectId: access.projectId,
    });

    return NextResponse.json(result);
  } catch (error) {
    // Un pathname fuera del prefijo es error del cliente, no del servidor: nada
    // ha fallado aqui, se ha denegado. Un 500 lo haria parecer un incidente.
    if (error instanceof EvidencePathnameRejected) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    console.error("ERROR POST /api/projects/[id]/evidence/upload-token:", error);
    return NextResponse.json(
      { error: "No se pudo autorizar la subida." },
      { status: 500 }
    );
  }
}
