import { Prisma } from "@prisma/client";
import { prisma } from "@/app/lib/prisma";
import {
  IMMUTABLE_AUDIT_REPORT_STATUSES,
  IMMUTABLE_EVIDENCE_STATUSES,
  type AddEvidenceReportLinkInput,
  type AddEvidenceRequirementLinkInput,
  type CreateEvidenceItemInput,
  type CreateEvidenceValidationInput,
  type EvidenceActor,
  type EvidenceStatus,
  type ListEvidenceFilters,
  type UpdateEvidenceItemInput,
} from "@/services/evidence.types";

/**
 * Opciones para las transacciones que leen un estado y escriben en funcion de el.
 *
 * El security-spec exige transaccion en las invariantes #1, #2 y #7 para evitar
 * carreras entre dos admins operando sobre la misma evidencia. Se aplica tambien a
 * la #3, que comparte el patron y tiene la peor consecuencia: entre el recuento de
 * citas y el borrado, otro admin puede citar la evidencia, y como el vinculo cae en
 * cascada, la cita desapareceria de un informe sin dejar rastro.
 *
 * `Serializable` es necesario, no decorativo: con el nivel por defecto de Postgres
 * (READ COMMITTED) leer dentro de la transaccion no bloquea la fila, y la carrera
 * seguiria abierta. Bajo contencion Postgres aborta una de las dos transacciones en
 * vez de permitir el resultado inconsistente.
 */
const GUARDED_TRANSACTION = {
  isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
} as const;

const EVIDENCE_SUMMARY_SELECT = {
  id: true,
  projectId: true,
  title: true,
  type: true,
  status: true,
  version: true,
  createdAt: true,
  createdBy: true,
} as const;

const EVIDENCE_DETAIL_INCLUDE = {
  requirementLinks: {
    select: {
      id: true,
      requirementId: true,
      linkType: true,
      addedAt: true,
      addedBy: true,
    },
    orderBy: { addedAt: "asc" },
  },
  reportLinks: {
    select: {
      id: true,
      auditReportId: true,
      usedAs: true,
      addedAt: true,
      addedBy: true,
    },
    orderBy: { addedAt: "asc" },
  },
  validations: {
    select: {
      id: true,
      outcome: true,
      notes: true,
      validatedAt: true,
      validatedBy: true,
    },
    orderBy: { validatedAt: "desc" },
  },
} as const;

// ─── EvidenceItem ────────────────────────────────────────────────────────────

export async function listEvidenceItems(
  projectId: string,
  actor: EvidenceActor,
  filters: ListEvidenceFilters = {}
) {
  const project = await findProjectForActor(projectId, actor);
  if (!project) return { notFound: true as const };

  const items = await prisma.evidenceItem.findMany({
    where: {
      projectId,
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.requirementId
        ? { requirementLinks: { some: { requirementId: filters.requirementId } } }
        : {}),
    },
    select: EVIDENCE_SUMMARY_SELECT,
    orderBy: { createdAt: "desc" },
  });

  return { items };
}

export async function getEvidenceItem(evidenceId: string, actor: EvidenceActor) {
  return prisma.evidenceItem.findFirst({
    where: { id: evidenceId, ...evidenceTenantWhere(actor) },
    include: EVIDENCE_DETAIL_INCLUDE,
  });
}

/**
 * Crea la evidencia en `draft` (api-contract: `status` nunca se acepta del body)
 * junto a su snapshot de version 1.
 *
 * El snapshot inicial es lo que mantiene la invariante #5 (`EvidenceItem.version`
 * == mayor `EvidenceItemVersion.version`) cierta desde el primer instante, y sigue
 * el patron de `AuditReport`, que tambien versiona en la creacion.
 */
export async function createEvidenceItem(
  input: CreateEvidenceItemInput,
  actor: EvidenceActor
) {
  const project = await findProjectForActor(input.projectId, actor);
  if (!project) return { notFound: true as const };

  const item = await prisma.$transaction(async (tx) => {
    const created = await tx.evidenceItem.create({
      data: {
        projectId: input.projectId,
        title: input.title,
        description: input.description ?? "",
        type: input.type,
        sourceRef: input.sourceRef ?? null,
        createdBy: input.createdBy,
      },
    });

    await createVersionSnapshot(tx, created, {
      changeReason: "Creacion de la evidencia",
      createdBy: input.createdBy,
    });

    return created;
  });

  return { item };
}

/**
 * Actualiza el contenido y deja constancia versionada del cambio.
 *
 * - Invariante #4/#5: incrementa `version` y fotografia el estado YA actualizado,
 *   de modo que los numeros de version son monotonos y nunca se reutilizan.
 * - api-contract: bloqueado si la evidencia es `validated` o `archived`.
 * - api-contract: si estaba `rejected`, reingresa al flujo como `submitted`.
 */
export async function updateEvidenceItem(
  evidenceId: string,
  input: UpdateEvidenceItemInput,
  actor: EvidenceActor
) {
  const current = await prisma.evidenceItem.findFirst({
    where: { id: evidenceId, ...evidenceTenantWhere(actor) },
  });
  if (!current) return { notFound: true as const };

  if (IMMUTABLE_EVIDENCE_STATUSES.includes(current.status as EvidenceStatus)) {
    return {
      conflict:
        "Una evidencia validada o archivada no se puede editar por esta via." as const,
    };
  }

  const nextStatus: EvidenceStatus =
    current.status === "rejected" ? "submitted" : (current.status as EvidenceStatus);

  const item = await prisma.$transaction(async (tx) => {
    const updated = await tx.evidenceItem.update({
      where: { id: evidenceId },
      data: {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.sourceRef !== undefined ? { sourceRef: input.sourceRef } : {}),
        status: nextStatus,
        version: current.version + 1,
        updatedBy: input.updatedBy,
      },
    });

    await createVersionSnapshot(tx, updated, {
      changeReason: "Actualizacion de contenido",
      createdBy: input.updatedBy,
    });

    return updated;
  });

  return { item };
}

/**
 * Invariante #3: una evidencia citada en un informe es inmutable. El borrado se
 * bloquea y la salida prevista es `status = archived`.
 *
 * Los vinculos a requisito, validaciones y versiones caen en cascada por schema.
 */
export async function deleteEvidenceItem(evidenceId: string, actor: EvidenceActor) {
  return prisma.$transaction(
    async (tx) => {
      const evidence = await tx.evidenceItem.findFirst({
        where: { id: evidenceId, ...evidenceTenantWhere(actor) },
        select: { id: true, _count: { select: { reportLinks: true } } },
      });
      if (!evidence) return { notFound: true as const };

      if (evidence._count.reportLinks > 0) {
        return {
          conflict:
            "La evidencia esta citada en un informe de auditoria y no se puede eliminar. Archivala en su lugar." as const,
        };
      }

      await tx.evidenceItem.delete({ where: { id: evidenceId } });
      return { deleted: true as const, id: evidenceId };
    },
    GUARDED_TRANSACTION
  );
}

/**
 * Transicion `draft → submitted` (ADR-004, decision #1). No versiona: no cambia el
 * contenido, solo su disponibilidad para revision.
 */
export async function submitEvidenceItem(evidenceId: string, actor: EvidenceActor) {
  const evidence = await prisma.evidenceItem.findFirst({
    where: { id: evidenceId, ...evidenceTenantWhere(actor) },
    select: { id: true, status: true },
  });
  if (!evidence) return { notFound: true as const };

  if (evidence.status !== "draft") {
    return {
      conflict: "Solo una evidencia en borrador se puede presentar a revision." as const,
    };
  }

  const item = await prisma.evidenceItem.update({
    where: { id: evidenceId },
    data: { status: "submitted" },
    select: EVIDENCE_SUMMARY_SELECT,
  });

  return { item };
}

// ─── EvidenceRequirementLink (admin) ─────────────────────────────────────────

/**
 * Invariante #6: un vinculo `contradictory` fuerza la reapertura de la revision
 * (`status → under_review`). Es la unica notificacion al Contradiction Engine en
 * Phase 1 — sin cola ni tabla de trigger (ADR-003, decision #3).
 */
export async function addEvidenceRequirementLink(
  input: AddEvidenceRequirementLinkInput
) {
  const evidence = await prisma.evidenceItem.findUnique({
    where: { id: input.evidenceItemId },
    select: { id: true, projectId: true, status: true },
  });
  if (!evidence) return { notFound: "evidence" as const };

  // El requisito debe vivir en el mismo proyecto que la evidencia: en Phase 1 la
  // evidencia es project-scoped y no hay reuso entre proyectos (ADR-003 #2).
  const requirement = await prisma.requirement.findFirst({
    where: { id: input.requirementId, projectId: evidence.projectId },
    select: { id: true },
  });
  if (!requirement) return { notFound: "requirement" as const };

  const linkType = input.linkType ?? "supporting";
  const contradictory = linkType === "contradictory";

  try {
    const result = await prisma.$transaction(async (tx) => {
      const link = await tx.evidenceRequirementLink.create({
        data: {
          evidenceItemId: input.evidenceItemId,
          requirementId: input.requirementId,
          linkType,
          addedBy: input.addedBy,
        },
      });

      let evidenceStatus = evidence.status;
      if (contradictory && evidence.status !== "under_review") {
        const updated = await tx.evidenceItem.update({
          where: { id: input.evidenceItemId },
          data: { status: "under_review" },
          select: { status: true },
        });
        evidenceStatus = updated.status;
      }

      return { link, evidenceStatus };
    });

    return result;
  } catch (e: unknown) {
    if (isPrismaUniqueError(e)) {
      return { conflict: "Esa evidencia ya esta vinculada a ese requisito." as const };
    }
    throw e;
  }
}

export async function removeEvidenceRequirementLink(evidenceId: string, linkId: string) {
  const link = await prisma.evidenceRequirementLink.findFirst({
    where: { id: linkId, evidenceItemId: evidenceId },
    select: { id: true },
  });
  if (!link) return { notFound: true as const };

  await prisma.evidenceRequirementLink.delete({ where: { id: linkId } });
  return { deleted: true as const, id: linkId };
}

// ─── EvidenceValidation (admin) ──────────────────────────────────────────────

/**
 * Invariante #1: ninguna evidencia alcanza `validated` sin un `EvidenceValidation`
 * con `validatedBy` humano. Registro y transicion ocurren en la misma transaccion
 * para que no pueda existir uno sin el otro.
 */
export async function createEvidenceValidation(input: CreateEvidenceValidationInput) {
  return prisma.$transaction(
    async (tx) => {
      const evidence = await tx.evidenceItem.findUnique({
        where: { id: input.evidenceItemId },
        select: { id: true, status: true },
      });
      if (!evidence) return { notFound: true as const };

      if (evidence.status === "archived") {
        return { conflict: "Una evidencia archivada no se puede validar." as const };
      }

      const nextStatus: EvidenceStatus =
        input.outcome === "approved"
          ? "validated"
          : input.outcome === "rejected"
            ? "rejected"
            : "under_review";

      const validation = await tx.evidenceValidation.create({
        data: {
          evidenceItemId: input.evidenceItemId,
          outcome: input.outcome,
          notes: input.notes ?? "",
          validatedBy: input.validatedBy,
        },
      });

      const updated = await tx.evidenceItem.update({
        where: { id: input.evidenceItemId },
        data: { status: nextStatus },
        select: { status: true },
      });

      return { validation, evidenceStatus: updated.status };
    },
    GUARDED_TRANSACTION
  );
}

// ─── EvidenceReportLink (admin) ──────────────────────────────────────────────

/**
 * Citar una evidencia en un informe. Dos invariantes se aplican aqui:
 *
 * - #2: solo evidencia `validated` puede sustentar una conclusion. Es el corte que
 *   impide que evidencia sin revisar se filtre a un informe firmado.
 * - #7: un informe cerrado no admite citas nuevas. Ver la nota de
 *   IMMUTABLE_AUDIT_REPORT_STATUSES sobre el desajuste de nombres con el contrato.
 */
export async function addEvidenceReportLink(input: AddEvidenceReportLinkInput) {
  try {
    return await prisma.$transaction(
      async (tx) => {
        const evidence = await tx.evidenceItem.findUnique({
          where: { id: input.evidenceItemId },
          select: { id: true, projectId: true, status: true },
        });
        if (!evidence) return { notFound: "evidence" as const };

        const report = await tx.auditReport.findFirst({
          where: { id: input.auditReportId, projectId: evidence.projectId },
          select: { id: true, status: true },
        });
        if (!report) return { notFound: "report" as const };

        if (evidence.status !== "validated") {
          return {
            conflict: "Solo se puede citar en un informe una evidencia validada." as const,
          };
        }

        if (IMMUTABLE_AUDIT_REPORT_STATUSES.includes(report.status)) {
          return { conflict: "El informe esta cerrado y no admite citas nuevas." as const };
        }

        const link = await tx.evidenceReportLink.create({
          data: {
            evidenceItemId: input.evidenceItemId,
            auditReportId: input.auditReportId,
            usedAs: input.usedAs ?? "supporting",
            addedBy: input.addedBy,
          },
        });

        return { link };
      },
      GUARDED_TRANSACTION
    );
  } catch (e: unknown) {
    if (isPrismaUniqueError(e)) {
      return { conflict: "Esa evidencia ya esta citada en ese informe." as const };
    }
    throw e;
  }
}

// ─── Acceso al binario ───────────────────────────────────────────────────────

/**
 * Resuelve el `sourceRef` de una evidencia dentro del tenant del actor.
 *
 * Devuelve la referencia, no una URL: firmarla exige `@vercel/blob`, que todavia
 * no es dependencia del proyecto. La firma es trabajo de la Fase D; el corte de
 * tenant es este.
 */
export async function getEvidenceSourceRef(evidenceId: string, actor: EvidenceActor) {
  const evidence = await prisma.evidenceItem.findFirst({
    where: { id: evidenceId, ...evidenceTenantWhere(actor) },
    select: { id: true, sourceRef: true },
  });

  // api-contract: `sourceRef` vacio se responde 404, no 200 con url nula.
  if (!evidence || !evidence.sourceRef) return { notFound: true as const };

  return { sourceRef: evidence.sourceRef };
}

/**
 * Verificacion de pertenencia del proyecto para la emision del token de subida
 * (ADR-004, decision #3). Es el punto donde se decide si se concede escritura en
 * el store, asi que vive en el servicio y no en el handler.
 */
export async function assertProjectAccess(projectId: string, actor: EvidenceActor) {
  const project = await findProjectForActor(projectId, actor);
  if (!project) return { notFound: true as const };
  return { projectId: project.id };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Tenant scope: el dueño ve sus proyectos, `admin` ve todos. Mismo patron que
 * `Requirement`. Un recurso fuera del tenant se responde 404, nunca 403
 * (api-contract), para no revelar que existe.
 */
async function findProjectForActor(projectId: string, actor: EvidenceActor) {
  return prisma.project.findFirst({
    where: {
      id: projectId,
      ...(actor.isAdmin ? {} : { userId: actor.userId }),
    },
    select: { id: true },
  });
}

function evidenceTenantWhere(actor: EvidenceActor) {
  return actor.isAdmin ? {} : { project: { userId: actor.userId } };
}

async function createVersionSnapshot(
  tx: Prisma.TransactionClient,
  item: {
    id: string;
    projectId: string;
    title: string;
    description: string;
    type: string;
    sourceRef: string | null;
    status: string;
    version: number;
    createdAt: Date;
    updatedAt: Date;
    createdBy: string;
    updatedBy: string | null;
  },
  meta: { changeReason: string; createdBy: string }
) {
  await tx.evidenceItemVersion.create({
    data: {
      evidenceItemId: item.id,
      version: item.version,
      snapshot: {
        id: item.id,
        projectId: item.projectId,
        title: item.title,
        description: item.description,
        type: item.type,
        sourceRef: item.sourceRef,
        status: item.status,
        version: item.version,
        createdAt: item.createdAt.toISOString(),
        updatedAt: item.updatedAt.toISOString(),
        createdBy: item.createdBy,
        updatedBy: item.updatedBy,
      } satisfies Prisma.InputJsonObject,
      changeReason: meta.changeReason,
      createdBy: meta.createdBy,
    },
  });
}

function isPrismaUniqueError(e: unknown): boolean {
  return (
    typeof e === "object" &&
    e !== null &&
    "code" in e &&
    (e as { code: string }).code === "P2002"
  );
}
