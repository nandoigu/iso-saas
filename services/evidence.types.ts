export type EvidenceType = "document" | "record" | "declaration";

export type EvidenceStatus =
  | "draft"
  | "submitted"
  | "under_review"
  | "validated"
  | "rejected"
  | "archived";

export type EvidenceRequirementLinkType = "primary" | "supporting" | "contradictory";

export type EvidenceReportLinkUsage = "supporting" | "conclusion_basis" | "referenced";

export type EvidenceValidationOutcome = "approved" | "rejected" | "pending_clarification";

export const EVIDENCE_TYPES: EvidenceType[] = ["document", "record", "declaration"];

export const EVIDENCE_STATUSES: EvidenceStatus[] = [
  "draft",
  "submitted",
  "under_review",
  "validated",
  "rejected",
  "archived",
];

export const EVIDENCE_REQUIREMENT_LINK_TYPES: EvidenceRequirementLinkType[] = [
  "primary",
  "supporting",
  "contradictory",
];

/**
 * ADR-010: el dueno del proyecto DECLARA que un documento sustenta un requisito.
 * `contradictory` queda fuera a proposito: afirmar que un documento contradice el
 * requisito es un juicio sobre el cumplimiento (y ademas empuja la evidencia a
 * `under_review`), asi que es acto de auditor y se queda en la ruta admin.
 */
export const DECLARABLE_REQUIREMENT_LINK_TYPES: EvidenceRequirementLinkType[] = [
  "primary",
  "supporting",
];

export const EVIDENCE_REPORT_LINK_USAGES: EvidenceReportLinkUsage[] = [
  "supporting",
  "conclusion_basis",
  "referenced",
];

export const EVIDENCE_VALIDATION_OUTCOMES: EvidenceValidationOutcome[] = [
  "approved",
  "rejected",
  "pending_clarification",
];

/**
 * Estados de `EvidenceItem` inmutables por la via de PATCH (api-contract:
 * "Bloqueado si status ∈ {validated, archived}").
 */
export const IMMUTABLE_EVIDENCE_STATUSES: EvidenceStatus[] = ["validated", "archived"];

/**
 * Invariant #7 del domain model: un informe cerrado no admite citas nuevas.
 *
 * Los estados reales que cierran un informe son `signed` y `finalizado` (ver
 * audit-team.service.ts, que bloquea contra esos dos). El api-contract definia la
 * invariante contra un `final` inexistente; corregido el 2026-08-06. `final` se
 * mantiene en la lista por si algun dia se introduce: cubrir de mas no puede
 * romper nada, quedarse corto dejaria pasar citas a un informe firmado.
 */
export const IMMUTABLE_AUDIT_REPORT_STATUSES = ["final", "signed", "finalizado"];

export type EvidenceItem = {
  id: string;
  projectId: string;
  title: string;
  description: string;
  type: EvidenceType;
  sourceRef: string | null;
  status: EvidenceStatus;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  updatedBy: string | null;
};

export type EvidenceRequirementLink = {
  id: string;
  evidenceItemId: string;
  requirementId: string;
  linkType: EvidenceRequirementLinkType;
  addedAt: Date;
  addedBy: string;
};

export type EvidenceReportLink = {
  id: string;
  evidenceItemId: string;
  auditReportId: string;
  usedAs: EvidenceReportLinkUsage;
  addedAt: Date;
  addedBy: string;
};

export type EvidenceValidation = {
  id: string;
  evidenceItemId: string;
  outcome: EvidenceValidationOutcome;
  notes: string;
  validatedAt: Date;
  validatedBy: string;
};

export type EvidenceItemVersion = {
  id: string;
  evidenceItemId: string;
  version: number;
  snapshot: Record<string, unknown>;
  changeReason: string;
  createdAt: Date;
  createdBy: string;
};

/**
 * Quien ejecuta la operacion. El RBAC se aplica en el route handler (api-contract:
 * los handlers son thin); el servicio lo usa solo para acotar el tenant, ya que
 * `admin` ve cualquier proyecto y `user` solo los suyos.
 */
export type EvidenceActor = {
  userId: string;
  isAdmin: boolean;
};

export type CreateEvidenceItemInput = {
  projectId: string;
  title: string;
  description?: string;
  type: EvidenceType;
  sourceRef?: string;
  createdBy: string;
};

export type UpdateEvidenceItemInput = Partial<
  Pick<EvidenceItem, "title" | "description" | "sourceRef">
> & {
  updatedBy: string;
};

export type DeclareEvidenceRequirementLinkInput = {
  projectId: string;
  requirementId: string;
  evidenceItemId: string;
  linkType?: EvidenceRequirementLinkType;
  actor: EvidenceActor;
};

export type AddEvidenceRequirementLinkInput = {
  evidenceItemId: string;
  requirementId: string;
  linkType?: EvidenceRequirementLinkType;
  addedBy: string;
};

export type AddEvidenceReportLinkInput = {
  evidenceItemId: string;
  auditReportId: string;
  usedAs?: EvidenceReportLinkUsage;
  addedBy: string;
};

export type CreateEvidenceValidationInput = {
  evidenceItemId: string;
  outcome: EvidenceValidationOutcome;
  notes?: string;
  validatedBy: string;
};

export type ListEvidenceFilters = {
  status?: string;
  requirementId?: string;
};
