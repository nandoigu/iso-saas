-- CreateTable
CREATE TABLE "EvidenceItem" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "type" TEXT NOT NULL,
    "sourceRef" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "EvidenceItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvidenceRequirementLink" (
    "id" TEXT NOT NULL,
    "evidenceItemId" TEXT NOT NULL,
    "requirementId" TEXT NOT NULL,
    "linkType" TEXT NOT NULL DEFAULT 'supporting',
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "addedBy" TEXT NOT NULL,

    CONSTRAINT "EvidenceRequirementLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvidenceReportLink" (
    "id" TEXT NOT NULL,
    "evidenceItemId" TEXT NOT NULL,
    "auditReportId" TEXT NOT NULL,
    "usedAs" TEXT NOT NULL DEFAULT 'supporting',
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "addedBy" TEXT NOT NULL,

    CONSTRAINT "EvidenceReportLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvidenceValidation" (
    "id" TEXT NOT NULL,
    "evidenceItemId" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "notes" TEXT NOT NULL DEFAULT '',
    "validatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validatedBy" TEXT NOT NULL,

    CONSTRAINT "EvidenceValidation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvidenceItemVersion" (
    "id" TEXT NOT NULL,
    "evidenceItemId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "changeReason" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL,

    CONSTRAINT "EvidenceItemVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EvidenceItem_projectId_idx" ON "EvidenceItem"("projectId");

-- CreateIndex
CREATE INDEX "EvidenceItem_createdBy_idx" ON "EvidenceItem"("createdBy");

-- CreateIndex
CREATE INDEX "EvidenceItem_status_idx" ON "EvidenceItem"("status");

-- CreateIndex
CREATE INDEX "EvidenceRequirementLink_evidenceItemId_idx" ON "EvidenceRequirementLink"("evidenceItemId");

-- CreateIndex
CREATE INDEX "EvidenceRequirementLink_requirementId_idx" ON "EvidenceRequirementLink"("requirementId");

-- CreateIndex
CREATE UNIQUE INDEX "EvidenceRequirementLink_evidenceItemId_requirementId_key" ON "EvidenceRequirementLink"("evidenceItemId", "requirementId");

-- CreateIndex
CREATE INDEX "EvidenceReportLink_evidenceItemId_idx" ON "EvidenceReportLink"("evidenceItemId");

-- CreateIndex
CREATE INDEX "EvidenceReportLink_auditReportId_idx" ON "EvidenceReportLink"("auditReportId");

-- CreateIndex
CREATE UNIQUE INDEX "EvidenceReportLink_evidenceItemId_auditReportId_key" ON "EvidenceReportLink"("evidenceItemId", "auditReportId");

-- CreateIndex
CREATE INDEX "EvidenceValidation_evidenceItemId_idx" ON "EvidenceValidation"("evidenceItemId");

-- CreateIndex
CREATE INDEX "EvidenceValidation_validatedBy_idx" ON "EvidenceValidation"("validatedBy");

-- CreateIndex
CREATE INDEX "EvidenceItemVersion_evidenceItemId_idx" ON "EvidenceItemVersion"("evidenceItemId");

-- CreateIndex
CREATE UNIQUE INDEX "EvidenceItemVersion_evidenceItemId_version_key" ON "EvidenceItemVersion"("evidenceItemId", "version");

-- AddForeignKey
ALTER TABLE "EvidenceItem" ADD CONSTRAINT "EvidenceItem_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceItem" ADD CONSTRAINT "EvidenceItem_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceRequirementLink" ADD CONSTRAINT "EvidenceRequirementLink_evidenceItemId_fkey" FOREIGN KEY ("evidenceItemId") REFERENCES "EvidenceItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceRequirementLink" ADD CONSTRAINT "EvidenceRequirementLink_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "Requirement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceRequirementLink" ADD CONSTRAINT "EvidenceRequirementLink_addedBy_fkey" FOREIGN KEY ("addedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceReportLink" ADD CONSTRAINT "EvidenceReportLink_evidenceItemId_fkey" FOREIGN KEY ("evidenceItemId") REFERENCES "EvidenceItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceReportLink" ADD CONSTRAINT "EvidenceReportLink_auditReportId_fkey" FOREIGN KEY ("auditReportId") REFERENCES "AuditReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceReportLink" ADD CONSTRAINT "EvidenceReportLink_addedBy_fkey" FOREIGN KEY ("addedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceValidation" ADD CONSTRAINT "EvidenceValidation_evidenceItemId_fkey" FOREIGN KEY ("evidenceItemId") REFERENCES "EvidenceItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceValidation" ADD CONSTRAINT "EvidenceValidation_validatedBy_fkey" FOREIGN KEY ("validatedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceItemVersion" ADD CONSTRAINT "EvidenceItemVersion_evidenceItemId_fkey" FOREIGN KEY ("evidenceItemId") REFERENCES "EvidenceItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceItemVersion" ADD CONSTRAINT "EvidenceItemVersion_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
