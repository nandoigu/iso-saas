CREATE TABLE "AuditReport" (
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
);

CREATE TABLE "AuditReportVersion" (
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
);

CREATE UNIQUE INDEX "AuditReport_reportNumber_version_key" ON "AuditReport"("reportNumber", "version");
CREATE INDEX "AuditReport_projectId_idx" ON "AuditReport"("projectId");
CREATE INDEX "AuditReport_createdById_idx" ON "AuditReport"("createdById");
CREATE INDEX "AuditReport_auditId_idx" ON "AuditReport"("auditId");
CREATE UNIQUE INDEX "AuditReportVersion_reportId_version_key" ON "AuditReportVersion"("reportId", "version");
CREATE INDEX "AuditReportVersion_createdById_idx" ON "AuditReportVersion"("createdById");

ALTER TABLE "AuditReport" ADD CONSTRAINT "AuditReport_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AuditReport" ADD CONSTRAINT "AuditReport_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AuditReportVersion" ADD CONSTRAINT "AuditReportVersion_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "AuditReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;
