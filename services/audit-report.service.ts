import { Prisma } from "@prisma/client";
import { prisma } from "@/app/lib/prisma";
import { buildAuditReportContent } from "@/services/audit-report.generator";
import type {
  AuditReportContent,
  AuditReportIndicators,
  AuditReportInput,
  AuditReportNonConformity,
} from "@/services/audit-report.types";

export async function listAuditReports() {
  const reports = await prisma.auditReport.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      project: { select: { id: true, name: true, code: true } },
      createdBy: { select: { id: true, email: true, name: true } },
    },
  });

  return reports.map(withNormalizedGeneratedContent);
}

export async function getAuditReport(reportId: string) {
  const report = await prisma.auditReport.findUnique({
    where: { id: reportId },
    include: {
      project: { select: { id: true, name: true, code: true } },
      createdBy: { select: { id: true, email: true, name: true } },
      versions: { orderBy: { version: "desc" } },
    },
  });

  return report ? withNormalizedGeneratedContent(report) : null;
}

export async function createAuditReport(input: AuditReportInput, createdById: string) {
  const project = await prisma.project.findUnique({
    where: { id: input.projectId },
    select: { name: true, code: true },
  });

  if (!project) return null;

  const reportNumber = await nextReportNumber();
  const content = buildAuditReportContent(input, reportNumber, project);

  return prisma.$transaction(async (tx) => {
    const report = await tx.auditReport.create({
      data: {
        auditId: input.auditId,
        reportNumber,
        auditType: input.auditType,
        scope: input.scope,
        auditedOrgName: input.organization.name,
        auditedOrgAddress: input.organization.address || null,
        auditedOrgRep: input.organization.representative || null,
        leadAuditor: input.leadAuditor.name,
        auditors: toJsonValue([]),
        technicalExperts: toJsonValue([]),
        auditStartDate: new Date(input.dates.start),
        auditEndDate: new Date(input.dates.end),
        reportDate: new Date(input.dates.report),
        applicableStandards: toJsonValue(input.standards),
        sourceData: toJsonValue(input),
        generatedContent: toJsonValue(content),
        traceability: toJsonValue(content.traceability),
        complianceScore: content.executiveResult.complianceScore,
        maturityScore: content.executiveResult.complianceScore,
        riskScore: content.executiveResult.riskScore,
        confidenceScore: content.executiveResult.confidenceScore,
        globalStatus: content.executiveResult.status,
        finalOpinion: content.finalOpinion.decision,
        projectId: input.projectId,
        createdById,
      },
      include: {
        project: { select: { id: true, name: true, code: true } },
        createdBy: { select: { id: true, email: true, name: true } },
      },
    });

    await createVersion(tx, {
      reportId: report.id,
      version: report.version,
      status: report.status,
      content,
      createdById,
    });

    return report;
  });
}

export async function saveAuditReportContent({
  reportId,
  content,
  createdById,
}: {
  reportId: string;
  content: AuditReportContent;
  createdById: string;
}) {
  const report = await prisma.auditReport.findUnique({ where: { id: reportId } });

  if (!report) return null;

  const nextVersion = report.version + 1;
  const normalizedContent = normalizeContent(content);

  return prisma.$transaction(async (tx) => {
    const updated = await tx.auditReport.update({
      where: { id: reportId },
      data: {
        version: nextVersion,
        generatedContent: toJsonValue(normalizedContent),
        traceability: toJsonValue(normalizedContent.traceability),
        complianceScore: normalizedContent.executiveResult.complianceScore,
        maturityScore: normalizedContent.executiveResult.complianceScore,
        riskScore: normalizedContent.executiveResult.riskScore,
        confidenceScore: normalizedContent.executiveResult.confidenceScore,
        globalStatus: normalizedContent.executiveResult.status,
        finalOpinion: normalizedContent.finalOpinion.decision,
      },
      include: {
        project: { select: { id: true, name: true, code: true } },
        createdBy: { select: { id: true, email: true, name: true } },
      },
    });

    await createVersion(tx, {
      reportId,
      version: nextVersion,
      status: updated.status,
      content: normalizedContent,
      createdById,
    });

    return updated;
  });
}

export async function regenerateAuditReport(reportId: string, createdById: string) {
  const report = await prisma.auditReport.findUnique({
    where: { id: reportId },
    include: { project: { select: { name: true, code: true } } },
  });

  if (!report) return null;

  const input = report.sourceData as unknown as AuditReportInput;
  const content = buildAuditReportContent(input, report.reportNumber, report.project);

  return saveAuditReportContent({ reportId, content, createdById });
}

export async function buildInputFromProject(projectId: string, body: Partial<AuditReportInput>) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      company: true,
      requirements: { orderBy: [{ norma: "asc" }, { item: "asc" }] },
      user: { select: { name: true, email: true } },
    },
  });

  if (!project) return null;

  const auditedRequirements = project.requirements.map((requirement) => ({
    id: requirement.id,
    title: requirement.titulo || requirement.name,
    norma: requirement.norma,
    item: requirement.item,
    status: requirement.completed ? "conforme" : requirement.status,
    evidence: requirement.evidencia,
  }));
  const analyzedEvidence = project.requirements
    .filter((requirement) => Boolean(requirement.evidencia))
    .map((requirement) => ({
      id: `evidence-${requirement.id}`,
      title: requirement.evidencia || requirement.titulo || requirement.name,
      requirementId: requirement.id,
    }));
  const complianceScore = calculateComplianceScore(auditedRequirements);

  return {
    auditId: body.auditId || `AUD-${project.code || project.id.slice(-6).toUpperCase()}`,
    projectId,
    organization: {
      name: body.organization?.name || project.company?.name || project.name,
      address: body.organization?.address || "",
      representative: body.organization?.representative || project.user.name || project.user.email,
    },
    scope: body.scope || `Certificacion ISO 19650 del proyecto ${project.name}`,
    auditType: body.auditType || "Fase 2",
    leadAuditor: body.leadAuditor || { name: "Auditor jefe BAOS", initials: "BA" },
    dates: {
      start: body.dates?.start || new Date().toISOString(),
      end: body.dates?.end || new Date().toISOString(),
      report: body.dates?.report || new Date().toISOString(),
    },
    standards: body.standards || ["ISO 19650-1", "ISO 19650-2"],
    results: {
      auditedRequirements,
      analyzedEvidence,
      complianceScore: body.results?.complianceScore ?? complianceScore,
      riskScore: body.results?.riskScore ?? Math.max(0, 100 - complianceScore),
      confidenceScore:
        body.results?.confidenceScore ?? Math.min(95, 50 + analyzedEvidence.length * 5),
    },
  } satisfies AuditReportInput;
}

function calculateComplianceScore(requirements: Array<{ status: string }>) {
  if (requirements.length === 0) return 0;

  const compliant = requirements.filter((requirement) => isCompliantStatus(requirement.status)).length;
  const partial = requirements.filter((requirement) => isPartialStatus(requirement.status)).length;

  return Math.round(((compliant + partial * 0.5) / requirements.length) * 100);
}

function normalizeContent(content: AuditReportContent): AuditReportContent {
  const auditMatrix = normalizeAuditMatrix(content.annexes.auditMatrix);
  const indicators = buildIndicatorsFromAuditMatrix(auditMatrix, content.annexes.kpis);

  return {
    ...content,
    executiveSummary: {
      ...content.executiveSummary,
      nonConformities: buildNonConformitiesFromAuditMatrix(
        auditMatrix,
        content.executiveSummary.nonConformities
      ),
    },
    executiveResult: {
      ...content.executiveResult,
      complianceScore: indicators.weightedComplianceScore,
      riskScore: Math.max(0, 100 - indicators.weightedComplianceScore),
      confidenceScore: clampScore(content.executiveResult.confidenceScore),
    },
    annexes: {
      ...content.annexes,
      auditMatrix,
      kpis: indicators,
    },
  };
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
}

function normalizeNonConformities(value: unknown): AuditReportNonConformity[] {
  if (Array.isArray(value)) {
    return value.map((entry, index) => {
      const row = entry as Partial<AuditReportNonConformity>;
      return {
        requirementId: String(row.requirementId || row.itemCode || `nc-${index + 1}`),
        itemCode: String(row.itemCode || row.requirementId || `NC-${index + 1}`),
        status: String(row.status || "no_conforme"),
        reason: String(row.reason || ""),
      };
    });
  }

  if (typeof value === "string" && value.trim()) {
    return value
      .split("\n")
      .map((line, index) => ({
        requirementId: `legacy-nc-${index + 1}`,
        itemCode: line.split(":")[0]?.trim() || `NC-${index + 1}`,
        status: "no_conforme",
        reason: line.includes(":") ? line.split(":").slice(1).join(":").trim() : "",
      }))
      .filter((entry) => entry.itemCode);
  }

  return [];
}

function normalizeAuditMatrix(
  value: unknown
): AuditReportContent["annexes"]["auditMatrix"] {
  if (!Array.isArray(value)) return [];

  return value.map((row, index) => {
    const item = row as Partial<AuditReportContent["annexes"]["auditMatrix"][number]>;
    return {
      requirementId: String(item.requirementId || `matrix-${index + 1}`),
      requirement: String(item.requirement || "Requisito sin codigo"),
      status: String(item.status || "Sin estado"),
      evidence: String(item.evidence || "Sin evidencia registrada"),
    };
  });
}

function buildNonConformitiesFromAuditMatrix(
  auditMatrix: AuditReportContent["annexes"]["auditMatrix"],
  currentValue: unknown
): AuditReportNonConformity[] {
  const existing = normalizeNonConformities(currentValue);

  return auditMatrix
    .filter((row) => isNonConformityStatus(row.status))
    .map((row) => {
      const itemCode = extractRequirementCode(row.requirement);
      const previous = findExistingNonConformity(existing, row.requirementId, itemCode);

      return {
        requirementId: row.requirementId,
        itemCode,
        status: row.status,
        reason: previous?.reason || "",
      };
    });
}

function buildIndicatorsFromAuditMatrix(
  auditMatrix: AuditReportContent["annexes"]["auditMatrix"],
  legacyValue?: unknown
): AuditReportIndicators {
  const totalRequirements = auditMatrix.length;
  const compliantRequirements = auditMatrix.filter((row) => isCompliantStatus(row.status)).length;
  const partialRequirements = auditMatrix.filter((row) => isPartialStatus(row.status)).length;
  const nonCompliantRequirements = auditMatrix.filter((row) => isNoConformityStatus(row.status)).length;
  const evidenceCount = auditMatrix.filter((row) => hasEvidence(row.evidence)).length;

  if (totalRequirements === 0) {
    const legacy = legacyValue as Partial<AuditReportIndicators> | undefined;
    return {
      totalRequirements: Number(legacy?.totalRequirements || 0),
      compliantRequirements: Number(legacy?.compliantRequirements || 0),
      partialRequirements: Number(legacy?.partialRequirements || 0),
      nonCompliantRequirements: Number(legacy?.nonCompliantRequirements || 0),
      evidenceCount: Number(legacy?.evidenceCount || 0),
      weightedComplianceScore: clampScore(Number(legacy?.weightedComplianceScore || 0)),
    };
  }

  return {
    totalRequirements,
    compliantRequirements,
    partialRequirements,
    nonCompliantRequirements,
    evidenceCount,
    weightedComplianceScore: Math.round(
      ((compliantRequirements + partialRequirements * 0.5) / totalRequirements) * 100
    ),
  };
}

function findExistingNonConformity(
  items: AuditReportNonConformity[],
  requirementId: string,
  itemCode: string
) {
  const normalizedCode = normalizeCode(itemCode);
  const shortCode = normalizeCode(itemCode.split(" - ").pop() || itemCode);

  return items.find((item) => {
    const candidateCode = normalizeCode(item.itemCode);
    return (
      item.requirementId === requirementId ||
      candidateCode === normalizedCode ||
      candidateCode === shortCode
    );
  });
}

function isNonConformityStatus(status: string) {
  return ["no_conforme", "no conforme", "non compliant", "parcial", "partial"].includes(
    status.trim().toLowerCase()
  );
}

function isCompliantStatus(status: string) {
  return ["total", "conforme", "cumple", "completed", "compliant", "aprobado"].includes(
    status.trim().toLowerCase()
  );
}

function isPartialStatus(status: string) {
  return ["parcial", "partial"].includes(status.trim().toLowerCase());
}

function isNoConformityStatus(status: string) {
  return ["no_conforme", "no conforme", "non compliant"].includes(status.trim().toLowerCase());
}

function hasEvidence(evidence: string) {
  const normalized = evidence.trim().toLowerCase();
  return Boolean(normalized) && !["sin evidencia registrada", "pendiente de completar"].includes(normalized);
}

function extractRequirementCode(requirement: string) {
  const parts = requirement.split(" - ").map((part) => part.trim()).filter(Boolean);
  if (parts.length >= 2 && /^\d/.test(parts[1])) return `${parts[0]} - ${parts[1]}`;
  return parts[0] || requirement;
}

function normalizeCode(value: string) {
  return value.trim().toLowerCase();
}

async function nextReportNumber() {
  const count = await prisma.auditReport.count();
  return `BAOS-AR-${String(count + 1).padStart(5, "0")}`;
}

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function withNormalizedGeneratedContent<T extends { generatedContent: unknown; reportNumber: string; auditId: string; auditType: string; auditedOrgName: string; scope: string; leadAuditor: string; complianceScore: number; riskScore: number; confidenceScore: number; globalStatus: string; finalOpinion: string; project?: { name: string; code?: string | null } | null }>(
  report: T
) {
  return {
    ...report,
    generatedContent: normalizeStoredContent(report),
  };
}

function normalizeStoredContent(report: {
  generatedContent: unknown;
  reportNumber: string;
  auditId: string;
  auditType: string;
  auditedOrgName: string;
  scope: string;
  leadAuditor: string;
  complianceScore: number;
  riskScore: number;
  confidenceScore: number;
  globalStatus: string;
  finalOpinion: string;
  project?: { name: string; code?: string | null } | null;
}): AuditReportContent {
  const content = report.generatedContent as Partial<AuditReportContent> & {
    executiveResults?: {
      complianceScore?: number;
      riskScore?: number;
      confidenceScore?: number;
      globalStatus?: string;
    };
    finalOpinion?: AuditReportContent["finalOpinion"] | { recommendation?: string; reasoning?: Array<{ text?: string }> };
    generalData?: Partial<AuditReportContent["generalData"]> & {
      organization?: { name?: string; address?: string; representative?: string };
      auditCriteria?: string[];
    };
    executiveSummary?:
      | (Partial<AuditReportContent["executiveSummary"]> & { nonConformities?: unknown })
      | Array<{ text?: string }>;
    annexes?: Partial<AuditReportContent["annexes"]> & {
      auditMatrix?: AuditReportContent["annexes"]["auditMatrix"] | Array<{ requirement?: string; status?: string; evidence?: string }>;
      evidenceUsed?: Array<{ id: string; title: string }>;
      requirementEvidenceTraceability?: Array<{ requirementId: string; evidenceIds: string[] }>;
    };
  };

  if (content?.executiveResult && content.generalData?.projectName && content.annexes?.kpis) {
    return normalizeContent(content as AuditReportContent);
  }

  const legacySummary = Array.isArray(content?.executiveSummary)
    ? content.executiveSummary.map((entry) => entry.text || "").filter(Boolean)
    : [];
  const legacyMatrix = Array.isArray(content?.annexes?.auditMatrix)
    ? content.annexes.auditMatrix
    : [];
  const recommendation =
    "recommendation" in (content?.finalOpinion || {})
      ? (content.finalOpinion as { recommendation?: string }).recommendation
      : content?.finalOpinion?.decision;
  const rationale =
    "reasoning" in (content?.finalOpinion || {}) && Array.isArray((content.finalOpinion as { reasoning?: Array<{ text?: string }> }).reasoning)
      ? (content.finalOpinion as { reasoning?: Array<{ text?: string }> }).reasoning?.map((entry) => entry.text || "").join("\n")
      : content?.finalOpinion?.rationale;

  const normalizedLegacyContent: AuditReportContent = {
    cover: {
      reportNumber: content?.cover?.reportNumber || report.reportNumber,
      auditNumber: content?.cover?.auditNumber || report.auditId,
      organizationName: content?.cover?.organizationName || report.auditedOrgName,
      auditType: (content?.cover?.auditType || report.auditType) as AuditReportContent["cover"]["auditType"],
      standards: content?.cover?.standards || ["ISO 19650-1", "ISO 19650-2"],
      auditDates: content?.cover?.auditDates || "No informado",
      reportDate: content?.cover?.reportDate || "No informado",
    },
    generalData: {
      projectName: content?.generalData?.projectName || report.project?.name || report.auditedOrgName,
      projectCode: content?.generalData?.projectCode || report.project?.code || "Sin codigo",
      organizationName:
        content?.generalData?.organizationName ||
        content?.generalData?.organization?.name ||
        report.auditedOrgName,
      organizationAddress:
        content?.generalData?.organizationAddress ||
        content?.generalData?.organization?.address ||
        "No informado",
      organizationRepresentative:
        content?.generalData?.organizationRepresentative ||
        content?.generalData?.organization?.representative ||
        "No informado",
      leadAuditorName: content?.generalData?.leadAuditorName || report.leadAuditor,
      leadAuditorInitials: content?.generalData?.leadAuditorInitials || initials(report.leadAuditor),
      certificationScope: content?.generalData?.certificationScope || report.scope,
    },
    auditCriteria:
      content?.auditCriteria ||
      content?.generalData?.auditCriteria || ["ISO 19650-1", "ISO 19650-2"],
    executiveSummary: {
      generalIssues: legacySummary[0] || "Informe migrado desde una version anterior del modulo.",
      scopeAdequacy: legacySummary[1] || "Pendiente de revision por el auditor.",
      auditObjectives: legacySummary[2] || "Verificar requisitos y evidencias registrados en BAOS.",
      auditContext: legacySummary[3] || "Contexto generado desde datos existentes.",
      auditorGeneralConsiderations: legacySummary[4] || "Pendiente de completar.",
      strengths: legacySummary[5] || "Pendiente de completar.",
      weaknessesAndImprovements: legacySummary[6] || "Pendiente de completar.",
      observations: legacySummary[7] || "Pendiente de completar.",
      nonConformities: normalizeNonConformities(legacySummary[8]),
    },
    executiveResult: {
      complianceScore: content?.executiveResults?.complianceScore ?? report.complianceScore,
      riskScore: content?.executiveResults?.riskScore ?? report.riskScore,
      confidenceScore: content?.executiveResults?.confidenceScore ?? report.confidenceScore,
      status: content?.executiveResults?.globalStatus || report.globalStatus,
    },
    finalOpinion: {
      decision: recommendation || report.finalOpinion,
      rationale: rationale || "Razonamiento pendiente de revision por el auditor.",
    },
    annexes: {
      auditMatrix: legacyMatrix.map((row, index) => ({
        requirementId: "requirementId" in row ? String(row.requirementId) : `legacy-${index + 1}`,
        requirement: String(row.requirement || "Requisito sin titulo"),
        status: String(row.status || "Sin estado"),
        evidence: String(row.evidence || "Sin evidencia registrada"),
      })),
      kpis: {
        totalRequirements: 0,
        compliantRequirements: 0,
        partialRequirements: 0,
        nonCompliantRequirements: 0,
        evidenceCount: 0,
        weightedComplianceScore:
          content?.executiveResults?.complianceScore ?? report.complianceScore,
      },
    },
    traceability: [],
  };

  return normalizeContent(normalizedLegacyContent);
}

function initials(value: string) {
  return value
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "AU";
}

async function createVersion(
  tx: Prisma.TransactionClient,
  {
    reportId,
    version,
    status,
    content,
    createdById,
  }: {
    reportId: string;
    version: number;
    status: string;
    content: AuditReportContent;
    createdById: string;
  }
) {
  await tx.auditReportVersion.create({
    data: {
      reportId,
      version,
      status,
      snapshot: toJsonValue(content),
      traceability: toJsonValue(content.traceability),
      complianceScore: content.executiveResult.complianceScore,
      maturityScore: content.executiveResult.complianceScore,
      riskScore: content.executiveResult.riskScore,
      confidenceScore: content.executiveResult.confidenceScore,
      globalStatus: content.executiveResult.status,
      finalOpinion: content.finalOpinion.decision,
      createdById,
    },
  });
}
