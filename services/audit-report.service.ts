import { Prisma } from "@prisma/client";
import { prisma } from "@/app/lib/prisma";
import { buildAuditReportContent } from "@/services/audit-report.generator";
import type { AuditReportContent, AuditReportInput } from "@/services/audit-report.types";

export async function listAuditReports() {
  return prisma.auditReport.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      project: { select: { id: true, name: true, code: true } },
      createdBy: { select: { id: true, email: true, name: true } },
    },
  });
}

export async function getAuditReport(reportId: string) {
  return prisma.auditReport.findUnique({
    where: { id: reportId },
    include: {
      project: { select: { id: true, name: true, code: true } },
      createdBy: { select: { id: true, email: true, name: true } },
      versions: { orderBy: { version: "desc" } },
    },
  });
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

  const compliant = requirements.filter((requirement) =>
    ["conforme", "cumple", "completed", "compliant", "aprobado"].includes(
      requirement.status.toLowerCase()
    )
  ).length;

  return Math.round((compliant / requirements.length) * 100);
}

function normalizeContent(content: AuditReportContent): AuditReportContent {
  return {
    ...content,
    executiveResult: {
      ...content.executiveResult,
      complianceScore: clampScore(content.executiveResult.complianceScore),
      riskScore: clampScore(content.executiveResult.riskScore),
      confidenceScore: clampScore(content.executiveResult.confidenceScore),
    },
    annexes: {
      ...content.annexes,
      kpis: {
        complianceScore: clampScore(content.annexes.kpis.complianceScore),
        riskScore: clampScore(content.annexes.kpis.riskScore),
        confidenceScore: clampScore(content.annexes.kpis.confidenceScore),
      },
    },
  };
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
}

async function nextReportNumber() {
  const count = await prisma.auditReport.count();
  return `BAOS-AR-${String(count + 1).padStart(5, "0")}`;
}

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
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
