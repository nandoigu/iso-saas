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
 * Invariant #7 del domain model: un informe finalizado no admite citas nuevas.
 *
 * El domain model nombra ese estado `final`, pero ese valor NO existe en este
 * codigo: los estados que marcan un informe cerrado son `signed` y `finalizado`
 * (ver audit-team.service.ts, que bloquea contra esos dos). Se cubren los tres
 * para que la invariante no quede muerta si el contrato se corrige mas adelante.
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
