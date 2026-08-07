import { NextResponse } from "next/server";
import { getAuthSession, isAdminRole, unauthorized } from "@/app/lib/auth";
import { getEvidenceSourceRef } from "@/services/evidence.service";

type RouteContext = { params: Promise<{ evidenceId: string }> };

/**
 * Signed URL de corta duracion para el archivo fuente (ADR-003, decision #1).
 *
 * No cuelga de `/api/admin/` a proposito: un dueño que no pudiera abrir su propio
 * documento no tendria forma de verificar que presento (ADR-004, decision #2).
 *
 * FASE C: aplica sesion y corte de tenant, que es lo que decide si este usuario
 * puede llegar al archivo. FASE D: firmar el `sourceRef` con `@vercel/blob`, que
 * todavia no es dependencia del proyecto. Hasta entonces se devuelve 501 en lugar
 * de una URL inventada: el contrato promete una signed URL utilizable.
 */
export async function GET(req: Request, context: RouteContext) {
  try {
    const user = await getAuthSession(req);
    if (!user) return unauthorized();

    const { evidenceId } = await context.params;
    const result = await getEvidenceSourceRef(evidenceId, {
      userId: user.id,
      isAdmin: isAdminRole(user.role),
    });

    // Cubre tanto "no es de tu tenant" como "no tiene archivo": el contrato manda
    // 404 en ambos casos, y nunca revelar cual de los dos es.
    if ("notFound" in result) {
      return NextResponse.json(
        { error: "Archivo de evidencia no encontrado." },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        error:
          "La descarga de archivos aun no esta disponible. Pendiente de la Fase D del Evidence Graph.",
      },
      { status: 501 }
    );
  } catch (error) {
    console.error("ERROR GET /api/evidence/[evidenceId]/file:", error);
    return NextResponse.json(
      { error: "No se pudo preparar el acceso al archivo." },
      { status: 500 }
    );
  }
}
