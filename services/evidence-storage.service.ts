import { issueSignedToken, presignUrl } from "@vercel/blob";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";

/**
 * Acceso al binario de una evidencia (Fase D del Evidence Graph).
 *
 * Aisla `@vercel/blob` del resto del dominio: ningun route handler ni servicio
 * importa el SDK del store directamente, del mismo modo que la inferencia IA se
 * concentra en `services/ai-provider.ts`. Cambiar de proveedor de storage es
 * reescribir este fichero, no rastrear imports por el arbol.
 *
 * Dos operaciones, las dos con el mismo principio (ADR-003, decision #1): el
 * binario NUNCA se sirve por una URL publica ni permanente.
 */

/**
 * Vida de una signed URL de lectura. "Corta duracion" en ADR-003 no fijaba
 * numero; cinco minutos es suficiente para abrir o descargar un documento y
 * deja poca ventana si la URL se filtra por historial, proxy o captura.
 */
export const EVIDENCE_SIGNED_URL_TTL_MS = 5 * 60 * 1000;

/**
 * Techo por archivo. No sale de ninguna norma: es una barrera de coste. El plan
 * Hobby da 1 GB de store y, al superarlo, Vercel corta el acceso al Blob durante
 * 30 dias sin opcion de pagar para desbloquear. Un unico archivo no deberia
 * poder consumir una fraccion grande de ese cupo por accidente.
 */
export const EVIDENCE_MAX_UPLOAD_BYTES = 200 * 1024 * 1024;

/**
 * Prefijo obligatorio de todo binario de evidencia. El api-contract solo exige
 * que incluya el `projectId`: es lo que hace que un archivo huerfano —subido y
 * nunca referenciado desde un `EvidenceItem`— siga siendo atribuible a su
 * proyecto y, por tanto, borrable en el ciclo de cierre (ADR-005).
 */
export function evidencePathnamePrefix(projectId: string): string {
  return `evidence/${projectId}/`;
}

export class EvidencePathnameRejected extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EvidencePathnameRejected";
  }
}

/**
 * Firma una URL de lectura para el `sourceRef` guardado en la evidencia.
 *
 * `issueSignedToken` pide material de firma al control plane del store y
 * `presignUrl` lo convierte en una URL concreta. El `access: 'private'` va del
 * lado del servidor y entra en la cadena firmada: el receptor de la URL no puede
 * cambiarlo. `validUntil` acota las dos capas a la misma marca de tiempo.
 */
export async function createEvidenceFileSignedUrl(
  sourceRef: string
): Promise<{ url: string; expiresAt: string }> {
  const validUntil = Date.now() + EVIDENCE_SIGNED_URL_TTL_MS;

  const delegation = await issueSignedToken({
    pathname: sourceRef,
    operations: ["get"],
    validUntil,
  });

  const { presignedUrl } = await presignUrl(delegation, {
    operation: "get",
    pathname: sourceRef,
    access: "private",
    validUntil,
  });

  return { url: presignedUrl, expiresAt: new Date(validUntil).toISOString() };
}

/**
 * Resuelve el handshake de client upload de `@vercel/blob/client` (ADR-004 #3).
 *
 * La pertenencia del proyecto ya la ha comprobado el handler antes de llegar
 * aqui. Lo que queda por decidir es DONDE puede escribir ese usuario, y esa es
 * la unica responsabilidad de `onBeforeGenerateToken`: el token que se emite
 * queda acotado al pathname que se valida en este callback.
 *
 * El `access` no se fija aqui porque no se puede: en este handshake lo declara
 * el cliente en su llamada a `upload()`. La garantia efectiva la da el store,
 * que esta configurado como privado y rechaza toda escritura publica
 * ("Cannot use public access on a private store", verificado contra
 * `iso-saas-evidence-fra`). Es una propiedad de la infraestructura, no del
 * codigo: un store creado sin acceso privado dejaria esta ruta sin proteccion.
 */
export async function handleEvidenceUploadToken(args: {
  request: Request;
  body: HandleUploadBody;
  projectId: string;
}) {
  const prefix = evidencePathnamePrefix(args.projectId);

  return handleUpload({
    request: args.request,
    body: args.body,
    onBeforeGenerateToken: async (pathname) => {
      if (!pathname.startsWith(prefix) || pathname.includes("..")) {
        // El mensaje no repite el pathname recibido: las reglas de logging del
        // security-spec prohiben devolver la ruta real del store al cliente.
        throw new EvidencePathnameRejected(
          "La ruta de subida debe estar bajo el prefijo del proyecto."
        );
      }

      // Sin `allowedContentTypes` a proposito: la evidencia ISO 19650 incluye
      // formatos BIM (IFC, DWG, RVT) cuyo MIME type el navegador reporta de
      // forma inconsistente o vacia. Una lista blanca aqui rechazaria evidencia
      // legitima, y el limite real de superficie lo pone el store privado.
      return {
        maximumSizeInBytes: EVIDENCE_MAX_UPLOAD_BYTES,
        // Dos evidencias distintas pueden llamarse igual. Sin sufijo, la segunda
        // subida chocaria con la primera en vez de convivir con ella.
        addRandomSuffix: true,
        tokenPayload: JSON.stringify({ projectId: args.projectId }),
      };
    },
  });
}
