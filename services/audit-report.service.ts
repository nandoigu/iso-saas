import crypto from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/app/lib/prisma";
import { buildAuditReportContent } from "@/services/audit-report.generator";
import type { AuditReportInput } from "@/services/audit-report.types";

export async function listAuditReports() {
  try {
    return await findAuditReports();
  } catch (error) {
    if (!isMissingAuditReportTableError(error)) throw error;
    await ensureAuditReportStorage();
    return findAuditReports();
  }
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
  await ensureAuditReportStorage();
  const reportNumber = await nextReportNumber();
  const content = buildAuditReportContent(input, reportNumber);
  const sourceData = toJsonValue(input);
  const generatedContent = toJsonValue(content);
  const traceability = toJsonValue(content.traceability);

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
        auditors: toJsonValue(input.auditors),
        technicalExperts: toJsonValue(input.technicalExperts),
        auditStartDate: new Date(input.dates.start),
        auditEndDate: new Date(input.dates.end),
        reportDate: new Date(input.dates.report),
        applicableStandards: toJsonValue(content.cover.standards),
        sourceData,
        generatedContent,
        traceability,
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
        snapshot: generatedContent,
        traceability,
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
  await ensureAuditReportStorage();
  const report = await prisma.auditReport.findUnique({ where: { id: reportId } });

  if (!report) return null;

  const input = report.sourceData as unknown as AuditReportInput;
  const nextVersion = report.version + 1;
  const content = buildAuditReportContent(input, report.reportNumber);
  const generatedContent = toJsonValue(content);
  const traceability = toJsonValue(content.traceability);

  return prisma.$transaction(async (tx) => {
    const updated = await tx.auditReport.update({
      where: { id: reportId },
      data: {
        version: nextVersion,
        generatedContent,
        traceability,
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
        snapshot: generatedContent,
        traceability,
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

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function findAuditReports() {
  return prisma.auditReport.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      project: { select: { id: true, name: true, code: true } },
      createdBy: { select: { id: true, email: true, name: true } },
    },
  });
}

function isMissingAuditReportTableError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2021" &&
    String(error.meta?.table || "").includes("AuditReport")
  );
}

async function ensureAuditReportStorage() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "AuditReport" (
      "id" TEXT NOT NULL,
      "auditId" TEXT NOT NULL,
      "reportNumber" TEXT NOT NULL,
      "version" INTEGER NOT NULL DEFAULT 1,
      "status" TEXT NOT NULL DEFAULT 'draft',
      "auditType" TEXT NOT NULL,
      "scope" TEXT NOT NULL,
      "auditedOrgName" TEXT NOT NULL,
      "auditedOrgAddress" TEXT,
      "auditedOrgRep" TEXT,
      "leadAuditor" TEXT NOT NULL,
      "auditors" JSONB NOT NULL,
      "technicalExperts" JSONB NOT NULL,
      "auditStartDate" TIMESTAMP(3) NOT NULL,
      "auditEndDate" TIMESTAMP(3) NOT NULL,
      "reportDate" TIMESTAMP(3) NOT NULL,
      "applicableStandards" JSONB NOT NULL,
      "sourceData" JSONB NOT NULL,
      "generatedContent" JSONB NOT NULL,
      "traceability" JSONB NOT NULL,
      "complianceScore" INTEGER NOT NULL,
      "maturityScore" INTEGER NOT NULL,
      "riskScore" INTEGER NOT NULL,
      "confidenceScore" INTEGER NOT NULL,
      "globalStatus" TEXT NOT NULL,
      "finalOpinion" TEXT NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL,
      "projectId" TEXT NOT NULL,
      "createdById" TEXT NOT NULL,
      CONSTRAINT "AuditReport_pkey" PRIMARY KEY ("id")
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "AuditReportVersion" (
      "id" TEXT NOT NULL,
      "version" INTEGER NOT NULL,
      "status" TEXT NOT NULL,
      "snapshot" JSONB NOT NULL,
      "traceability" JSONB NOT NULL,
      "complianceScore" INTEGER NOT NULL,
      "maturityScore" INTEGER NOT NULL,
      "riskScore" INTEGER NOT NULL,
      "confidenceScore" INTEGER NOT NULL,
      "globalStatus" TEXT NOT NULL,
      "finalOpinion" TEXT NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "reportId" TEXT NOT NULL,
      "createdById" TEXT NOT NULL,
      CONSTRAINT "AuditReportVersion_pkey" PRIMARY KEY ("id")
    )
  `);

  await prisma.$executeRawUnsafe(
    `CREATE UNIQUE INDEX IF NOT EXISTS "AuditReport_reportNumber_version_key" ON "AuditReport"("reportNumber", "version")`
  );
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "AuditReport_projectId_idx" ON "AuditReport"("projectId")`
  );
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "AuditReport_createdById_idx" ON "AuditReport"("createdById")`
  );
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "AuditReport_auditId_idx" ON "AuditReport"("auditId")`
  );
  await prisma.$executeRawUnsafe(
    `CREATE UNIQUE INDEX IF NOT EXISTS "AuditReportVersion_reportId_version_key" ON "AuditReportVersion"("reportId", "version")`
  );
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "AuditReportVersion_createdById_idx" ON "AuditReportVersion"("createdById")`
  );

  await addConstraintIfMissing(
    "AuditReport_projectId_fkey",
    `ALTER TABLE "AuditReport" ADD CONSTRAINT "AuditReport_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE`
  );
  await addConstraintIfMissing(
    "AuditReport_createdById_fkey",
    `ALTER TABLE "AuditReport" ADD CONSTRAINT "AuditReport_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE`
  );
  await addConstraintIfMissing(
    "AuditReportVersion_reportId_fkey",
    `ALTER TABLE "AuditReportVersion" ADD CONSTRAINT "AuditReportVersion_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "AuditReport"("id") ON DELETE CASCADE ON UPDATE CASCADE`
  );

  await markAuditReportMigrationApplied();
}

async function addConstraintIfMissing(name: string, sql: string) {
  await prisma.$executeRawUnsafe(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = '${name.replace(/'/g, "''")}'
      ) THEN
        ${sql};
      END IF;
    END $$;
  `);
}

async function markAuditReportMigrationApplied() {
  const migrationName = "20260529110000_add_audit_report_generator";
  const checksum = "09f3f16dfbb718856dd0bbfe3a2f5dfd788e8c736e0310a08e7aff94175e9b9d";

  await prisma.$executeRawUnsafe(
    `INSERT INTO "_prisma_migrations" ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count")
     SELECT $1, $2, NOW(), $3, NULL, NULL, NOW(), 1
     WHERE NOT EXISTS (
       SELECT 1 FROM "_prisma_migrations" WHERE "migration_name" = $3
     )`,
    crypto.randomUUID(),
    checksum,
    migrationName
  );
}
