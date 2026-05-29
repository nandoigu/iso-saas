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

export type FindingSeverity = "Menor" | "Mayor" | "Critica";
export type ImprovementPriority = "Alta" | "Media" | "Baja";

export type TraceabilityRef = {
  requirementId: string;
  evidenceIds: string[];
  confidenceScore: number;
};

export type ReportParagraph = TraceabilityRef & {
  id: string;
  text: string;
};

export type Strength = TraceabilityRef & {
  code: string;
  description: string;
  evidence: string;
};

export type Improvement = TraceabilityRef & {
  code: string;
  description: string;
  recommendation: string;
  priority: ImprovementPriority;
};

export type Observation = TraceabilityRef & {
  reference: string;
  observation: string;
  requirement: string;
};

export type NonConformity = TraceabilityRef & {
  id: string;
  isoRequirement: string;
  severity: FindingSeverity;
  description: string;
  evidence: string;
  impact: string;
  probableCause: string;
};

export type IsoDomainEvaluation = TraceabilityRef & {
  domain: string;
  result: string;
  strengths: string[];
  weaknesses: string[];
  evidenceUsed: string[];
  complianceLevel: number;
};

export type CorrectiveAction = {
  nonConformityId: string;
  requiredAction: string;
  owner: string;
  targetDate: string;
  priority: ImprovementPriority;
};

export type AuditReportInput = {
  auditId: string;
  projectId: string;
  organization: {
    name: string;
    address?: string;
    representative?: string;
    logoUrl?: string;
  };
  scope: string;
  auditType: AuditType;
  leadAuditor: AuditPerson;
  auditors: AuditPerson[];
  technicalExperts: AuditPerson[];
  dates: {
    start: string;
    end: string;
    report: string;
  };
  results: {
    auditedRequirements: Array<{
      id: string;
      name: string;
      norma?: string | null;
      item?: string | null;
      status: string;
      evidencia?: string | null;
    }>;
    analyzedEvidence: Array<{ id: string; title: string; source?: string }>;
    complianceScore: number;
    maturityScore: number;
    riskScore: number;
    confidenceScore: number;
  };
  findings?: {
    strengths?: Strength[];
    improvements?: Improvement[];
    observations?: Observation[];
    nonConformities?: NonConformity[];
  };
  standards?: string[];
  internalProcedures?: string[];
  contractualRequirements?: string[];
  legalRequirements?: string[];
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
    organization: AuditReportInput["organization"];
    auditTeam: AuditPerson[];
    auditCriteria: string[];
  };
  executiveSummary: ReportParagraph[];
  executiveResults: {
    complianceScore: number;
    maturityScore: number;
    riskScore: number;
    confidenceScore: number;
    globalStatus: string;
  };
  strengths: Strength[];
  improvements: Improvement[];
  observations: Observation[];
  nonConformities: NonConformity[];
  isoEvaluation: IsoDomainEvaluation[];
  finalOpinion: {
    recommendation: string;
    reasoning: ReportParagraph[];
  };
  correctiveActions: CorrectiveAction[];
  annexes: {
    auditMatrix: Array<{ requirement: string; status: string; evidence: string }>;
    evidenceUsed: AuditReportInput["results"]["analyzedEvidence"];
    requirementEvidenceTraceability: TraceabilityRef[];
    auditedDocumentRegister: string[];
    previousAuditHistory: string[];
  };
  traceability: Record<string, TraceabilityRef>;
};
