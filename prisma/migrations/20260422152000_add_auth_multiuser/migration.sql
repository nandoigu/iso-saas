-- Add authentication fields to users.
ALTER TABLE "User" ADD COLUMN "password" TEXT;
ALTER TABLE "User" ADD COLUMN "role" TEXT NOT NULL DEFAULT 'user';

-- Keep company optional for the next SaaS phase while preserving existing data.
ALTER TABLE "User" ALTER COLUMN "companyId" DROP NOT NULL;
ALTER TABLE "Project" ALTER COLUMN "companyId" DROP NOT NULL;

-- Add project ownership in two steps so existing projects can be backfilled.
ALTER TABLE "Project" ADD COLUMN "userId" TEXT;

-- Fallback owner for existing rows. Password is a valid scrypt hash for ChangeMe123!
-- This is only for legacy ownership assignment; create real users through /register.
INSERT INTO "Company" ("id", "name", "createdAt")
SELECT 'legacy_company', 'Legacy Company', CURRENT_TIMESTAMP
WHERE NOT EXISTS (
  SELECT 1 FROM "Company" WHERE "id" = 'legacy_company'
);

INSERT INTO "User" ("id", "email", "name", "password", "role", "createdAt", "companyId")
SELECT
  'legacy_owner',
  'owner@example.com',
  'Legacy Owner',
  '1db09583f59b7f2580e8ec6df7433645:9df6e9dab06169b6dc3fe098138c680f5c77500fc322dcd01fb727f01158962d4778e7f9e9009c0008b5e37d18e6c41b612ff360f8ce3064c80751889f08f596',
  'user',
  CURRENT_TIMESTAMP,
  'legacy_company'
WHERE NOT EXISTS (
  SELECT 1 FROM "User" WHERE "email" = 'owner@example.com'
);

UPDATE "User"
SET "password" = '1db09583f59b7f2580e8ec6df7433645:9df6e9dab06169b6dc3fe098138c680f5c77500fc322dcd01fb727f01158962d4778e7f9e9009c0008b5e37d18e6c41b612ff360f8ce3064c80751889f08f596'
WHERE "password" IS NULL;

UPDATE "Project"
SET "userId" = (
  SELECT "id" FROM "User" ORDER BY "createdAt" ASC LIMIT 1
)
WHERE "userId" IS NULL;

ALTER TABLE "User" ALTER COLUMN "password" SET NOT NULL;
ALTER TABLE "Project" ALTER COLUMN "userId" SET NOT NULL;

ALTER TABLE "Project"
ADD CONSTRAINT "Project_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
