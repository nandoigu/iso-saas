-- AlterTable
ALTER TABLE "AuditReport" ADD COLUMN     "auditTeamId" TEXT;

-- CreateTable
CREATE TABLE "Auditor" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "certificationBody" TEXT,
    "certificationNumber" TEXT,
    "certificationLevel" TEXT,
    "qualifications" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isExternal" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'active',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT NOT NULL,

    CONSTRAINT "Auditor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditTeam" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "auditId" TEXT NOT NULL,
    "name" TEXT,
    "status" TEXT NOT NULL DEFAULT 'forming',
    "formedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT NOT NULL,

    CONSTRAINT "AuditTeam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditTeamMember" (
    "id" TEXT NOT NULL,
    "auditTeamId" TEXT NOT NULL,
    "auditorId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'invited',
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedAt" TIMESTAMP(3),
    "withdrawnAt" TIMESTAMP(3),
    "withdrawnReason" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT NOT NULL,

    CONSTRAINT "AuditTeamMember_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Auditor_userId_key" ON "Auditor"("userId");

-- CreateIndex
CREATE INDEX "Auditor_companyId_idx" ON "Auditor"("companyId");

-- CreateIndex
CREATE INDEX "Auditor_userId_idx" ON "Auditor"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Auditor_companyId_email_key" ON "Auditor"("companyId", "email");

-- CreateIndex
CREATE INDEX "AuditTeam_companyId_idx" ON "AuditTeam"("companyId");

-- CreateIndex
CREATE INDEX "AuditTeam_projectId_idx" ON "AuditTeam"("projectId");

-- CreateIndex
CREATE INDEX "AuditTeam_auditId_idx" ON "AuditTeam"("auditId");

-- CreateIndex
CREATE INDEX "AuditTeamMember_auditTeamId_idx" ON "AuditTeamMember"("auditTeamId");

-- CreateIndex
CREATE INDEX "AuditTeamMember_auditorId_idx" ON "AuditTeamMember"("auditorId");

-- CreateIndex
CREATE UNIQUE INDEX "AuditTeamMember_auditTeamId_auditorId_key" ON "AuditTeamMember"("auditTeamId", "auditorId");

-- AddForeignKey
ALTER TABLE "AuditReport" ADD CONSTRAINT "AuditReport_auditTeamId_fkey" FOREIGN KEY ("auditTeamId") REFERENCES "AuditTeam"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Auditor" ADD CONSTRAINT "Auditor_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Auditor" ADD CONSTRAINT "Auditor_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditTeam" ADD CONSTRAINT "AuditTeam_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditTeam" ADD CONSTRAINT "AuditTeam_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditTeamMember" ADD CONSTRAINT "AuditTeamMember_auditTeamId_fkey" FOREIGN KEY ("auditTeamId") REFERENCES "AuditTeam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditTeamMember" ADD CONSTRAINT "AuditTeamMember_auditorId_fkey" FOREIGN KEY ("auditorId") REFERENCES "Auditor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
