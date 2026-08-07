import { NextResponse } from "next/server";
import { getAuthSession, isAdminRole, unauthorized } from "@/app/lib/auth";
import { assertProjectAccess } from "@/services/evidence.service";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Emision del token que autoriza al cliente a escribir directamente en el store
 * (ADR-004, decision #3). El binario nunca atraviesa la funcion serverless, que
 * tiene un limite de ~4,5 MB de body incompatible con planos BIM.
 *
 * Este es el punto critico de seguridad del flujo de subida: es aqui donde se
 * comprueban sesion y pertenencia del proyecto ANTES de conceder escritura. Esa
 * parte esta completa en la Fase C.
 *
 * FASE D: el handshake de `@vercel/blob/client`, que exige el paquete instalado.
 * Se devuelve 501 y no se firma nada mientras tanto — conceder escritura al store
 * sin poder aplicar el prefijo por `projectId` dejaria archivos no atribuibles.
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

    return NextResponse.json(
      {
        error:
          "La subida de archivos aun no esta disponible. Pendiente de la Fase D del Evidence Graph.",
      },
      { status: 501 }
    );
  } catch (error) {
    console.error("ERROR POST /api/projects/[id]/evidence/upload-token:", error);
    return NextResponse.json(
      { error: "No se pudo autorizar la subida." },
      { status: 500 }
    );
  }
}
