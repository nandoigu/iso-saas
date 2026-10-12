-- CreateTable
CREATE TABLE "AnalysisDocument" (
    "id" TEXT NOT NULL,
    "evidenceItemId" TEXT NOT NULL,
    "mediaType" TEXT NOT NULL,
    "pageCount" INTEGER,
    "sizeBytes" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "unsupportedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT NOT NULL,

    CONSTRAINT "AnalysisDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AnalysisDocument_evidenceItemId_key" ON "AnalysisDocument"("evidenceItemId");

-- CreateIndex
CREATE INDEX "AnalysisDocument_status_idx" ON "AnalysisDocument"("status");

-- CreateIndex
CREATE INDEX "AnalysisDocument_createdBy_idx" ON "AnalysisDocument"("createdBy");

-- AddForeignKey
ALTER TABLE "AnalysisDocument" ADD CONSTRAINT "AnalysisDocument_evidenceItemId_fkey" FOREIGN KEY ("evidenceItemId") REFERENCES "EvidenceItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalysisDocument" ADD CONSTRAINT "AnalysisDocument_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
