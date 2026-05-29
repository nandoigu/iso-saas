export type AuditType =
  | "Fase 1"
  | "Fase 2"
  | "Seguimiento"
  | "Renovacion"
  | "Extraordinaria";

export type AuditPerson = {
  name: string;
  initials: string;
  role?: string;
};

export type AuditReportInput = {
  auditId: string;
  projectId: string;
  organization: {
    name: string;
    address?: string;
    representative?: string;
  };
  scope: string;
  auditType: AuditType;
  leadAuditor: AuditPerson;
  dates: {
    start: string;
    end: string;
    report: string;
  };
  standards: string[];
  results: {
    auditedRequirements: AuditRequirementSnapshot[];
    analyzedEvidence: AuditEvidenceSnapshot[];
    complianceScore: number;
    riskScore: number;
    confidenceScore: number;
  };
};

export type AuditRequirementSnapshot = {
  id: string;
  title: string;
  norma?: string | null;
  item?: string | null;
  status: string;
  evidence?: string | null;
};

export type AuditEvidenceSnapshot = {
  id: string;
  title: string;
  requirementId: string;
};

export type AuditReportNonConformity = {
  requirementId: string;
  itemCode: string;
  status: string;
  reason: string;
};

export type AuditReportIndicators = {
  totalRequirements: number;
  compliantRequirements: number;
  partialRequirements: number;
  nonCompliantRequirements: number;
  evidenceCount: number;
  weightedComplianceScore: number;
};

export type AuditReportContent = {
  cover: {
    reportNumber: string;
    auditNumber: string;
    organizationName: string;
    auditType: AuditType;
    standards: string[];
    auditDates: string;
    reportDate: string;
  };
  generalData: {
    projectName: string;
    projectCode: string;
    organizationName: string;
    organizationAddress: string;
    organizationRepresentative: string;
    leadAuditorName: string;
    leadAuditorInitials: string;
    certificationScope: string;
  };
  auditCriteria: string[];
  executiveSummary: {
    generalIssues: string;
    scopeAdequacy: string;
    auditObjectives: string;
    auditContext: string;
    auditorGeneralConsiderations: string;
    strengths: string;
    weaknessesAndImprovements: string;
    observations: string;
    nonConformities: AuditReportNonConformity[];
  };
  executiveResult: {
    complianceScore: number;
    riskScore: number;
    confidenceScore: number;
    status: string;
  };
  finalOpinion: {
    decision: string;
    rationale: string;
  };
  annexes: {
    auditMatrix: Array<{
      requirementId: string;
      requirement: string;
      status: string;
      evidence: string;
    }>;
    kpis: AuditReportIndicators;
  };
  traceability: Array<{
    section: string;
    requirementIds: string[];
    evidenceIds: string[];
    confidenceScore: number;
  }>;
};
