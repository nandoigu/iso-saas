import { Prisma } from "@prisma/client";
import { prisma } from "@/app/lib/prisma";
import { buildAuditReportContent } from "@/services/audit-report.generator";
import type { AuditReportInput } from "@/services/audit-report.types";

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
  const reportNumber = await nextReportNumber();
  const content = buildAuditReportContent(input, reportNumber);

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
        auditors: input.auditors as unknown as Prisma.InputJsonValue,
        technicalExperts: input.technicalExperts as unknown as Prisma.InputJsonValue,
        auditStartDate: new Date(input.dates.start),
        auditEndDate: new Date(input.dates.end),
        reportDate: new Date(input.dates.report),
        applicableStandards: content.cover.standards as Prisma.InputJsonValue,
        sourceData: input as unknown as Prisma.InputJsonValue,
        generatedContent: content as unknown as Prisma.InputJsonValue,
        traceability: content.traceability as Prisma.InputJsonValue,
        complianceScore: content.executiveResults.complianceScore,
        maturityScore: content.executiveResults.maturityScore,
        riskScore: content.executiveResults.riskScore,
        confidenceScore: content.executiveResults.confidenceScore,
        globalStatus: content.executiveResults.globalStatus,
        finalOpinion: content.finalOpinion.recommendation,
        projectId: input.projectId,
        createdById,
      },
    });

    await tx.auditReportVersion.create({
      data: {
        reportId: report.id,
        version: report.version,
        status: report.status,
        snapshot: content as unknown as Prisma.InputJsonValue,
        traceability: content.traceability as Prisma.InputJsonValue,
        complianceScore: report.complianceScore,
        maturityScore: report.maturityScore,
        riskScore: report.riskScore,
        confidenceScore: report.confidenceScore,
        globalStatus: report.globalStatus,
        finalOpinion: report.finalOpinion,
        createdById,
      },
    });

    return report;
  });
}

export async function regenerateAuditReport(reportId: string, createdById: string) {
  const report = await prisma.auditReport.findUnique({ where: { id: reportId } });

  if (!report) return null;

  const input = report.sourceData as unknown as AuditReportInput;
  const nextVersion = report.version + 1;
  const content = buildAuditReportContent(input, report.reportNumber);

  return prisma.$transaction(async (tx) => {
    const updated = await tx.auditReport.update({
      where: { id: reportId },
      data: {
        version: nextVersion,
        generatedContent: content as unknown as Prisma.InputJsonValue,
        traceability: content.traceability as Prisma.InputJsonValue,
        complianceScore: content.executiveResults.complianceScore,
        maturityScore: content.executiveResults.maturityScore,
        riskScore: content.executiveResults.riskScore,
        confidenceScore: content.executiveResults.confidenceScore,
        globalStatus: content.executiveResults.globalStatus,
        finalOpinion: content.finalOpinion.recommendation,
      },
    });

    await tx.auditReportVersion.create({
      data: {
        reportId,
        version: nextVersion,
        status: updated.status,
        snapshot: content as unknown as Prisma.InputJsonValue,
        traceability: content.traceability as Prisma.InputJsonValue,
        complianceScore: updated.complianceScore,
        maturityScore: updated.maturityScore,
        riskScore: updated.riskScore,
        confidenceScore: updated.confidenceScore,
        globalStatus: updated.globalStatus,
        finalOpinion: updated.finalOpinion,
        createdById,
      },
    });

    return updated;
  });
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
    name: requirement.titulo || requirement.name,
    norma: requirement.norma,
    item: requirement.item,
    status: requirement.status,
    evidencia: requirement.evidencia,
  }));
  const analyzedEvidence = project.requirements
    .filter((requirement) => Boolean(requirement.evidencia))
    .map((requirement) => ({
      id: requirement.id,
      title: requirement.evidencia || requirement.titulo || requirement.name,
      source: requirement.norma || undefined,
    }));
  const complianceScore = calculateComplianceScore(auditedRequirements);

  return {
    auditId: body.auditId || `AUD-${project.code || project.id.slice(-6).toUpperCase()}`,
    projectId,
    organization: {
      name: body.organization?.name || project.company?.name || project.name,
      address: body.organization?.address,
      representative: body.organization?.representative || project.user.name || project.user.email,
      logoUrl: body.organization?.logoUrl,
    },
    scope: body.scope || `Auditoria ISO 19650 del proyecto ${project.name}`,
    auditType: body.auditType || "Fase 2",
    leadAuditor: body.leadAuditor || { name: "Auditor jefe BAOS", initials: "BA" },
    auditors: body.auditors || [],
    technicalExperts: body.technicalExperts || [],
    dates: {
      start: body.dates?.start || new Date().toISOString(),
      end: body.dates?.end || new Date().toISOString(),
      report: body.dates?.report || new Date().toISOString(),
    },
    results: {
      auditedRequirements,
      analyzedEvidence,
      complianceScore: body.results?.complianceScore ?? complianceScore,
      maturityScore: body.results?.maturityScore ?? complianceScore,
      riskScore: body.results?.riskScore ?? Math.max(0, 100 - complianceScore),
      confidenceScore: body.results?.confidenceScore ?? (analyzedEvidence.length ? 82 : 55),
    },
    findings: body.findings,
    standards: body.standards || ["ISO 19650-1", "ISO 19650-2"],
    internalProcedures: body.internalProcedures,
    contractualRequirements: body.contractualRequirements,
    legalRequirements: body.legalRequirements,
  } satisfies AuditReportInput;
}

function calculateComplianceScore(requirements: Array<{ status: string }>) {
  if (requirements.length === 0) return 0;

  const compliant = requirements.filter((requirement) =>
    ["conforme", "cumple", "completed", "compliant"].includes(requirement.status.toLowerCase())
  ).length;

  return Math.round((compliant / requirements.length) * 100);
}

async function nextReportNumber() {
  const count = await prisma.auditReport.count();
  return `BAOS-AR-${String(count + 1).padStart(5, "0")}`;
}
