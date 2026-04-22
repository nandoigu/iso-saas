-- AlterTable
ALTER TABLE "User" ADD COLUMN     "lastAlertEmailAt" TIMESTAMP(3),
ADD COLUMN     "lastReportEmailAt" TIMESTAMP(3),
ADD COLUMN     "notifyAlerts" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "notifyReports" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "reportFrequency" TEXT NOT NULL DEFAULT 'weekly';
