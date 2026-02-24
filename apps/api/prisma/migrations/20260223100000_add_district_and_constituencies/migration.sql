-- Migration: Add District table and Assembly/Parliamentary Constituencies
-- This migration adds proper location hierarchy for Tamil Nadu

-- Step 1: Create District table
CREATE TABLE IF NOT EXISTS "District" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "stateCode" TEXT NOT NULL DEFAULT 'TN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "District_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "District_name_key" ON "District"("name");
CREATE INDEX IF NOT EXISTS "District_stateCode_idx" ON "District"("stateCode");

-- Step 2: Create Parliamentary Constituency table
CREATE TABLE IF NOT EXISTS "ParliamentaryConstituency" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "stateCode" TEXT NOT NULL DEFAULT 'TN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ParliamentaryConstituency_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ParliamentaryConstituency_name_key" ON "ParliamentaryConstituency"("name");
CREATE INDEX IF NOT EXISTS "ParliamentaryConstituency_stateCode_idx" ON "ParliamentaryConstituency"("stateCode");

-- Step 3: Create Assembly Constituency table
CREATE TABLE IF NOT EXISTS "AssemblyConstituency" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "districtId" TEXT NOT NULL,
    "parliamentaryConstituencyId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssemblyConstituency_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "AssemblyConstituency_districtId_idx" ON "AssemblyConstituency"("districtId");
CREATE INDEX IF NOT EXISTS "AssemblyConstituency_parliamentaryConstituencyId_idx" ON "AssemblyConstituency"("parliamentaryConstituencyId");
CREATE UNIQUE INDEX IF NOT EXISTS "AssemblyConstituency_districtId_name_key" ON "AssemblyConstituency"("districtId", "name");

-- Step 4: Create Polling Booth table
CREATE TABLE IF NOT EXISTS "PollingBooth" (
    "id" TEXT NOT NULL,
    "boothNumber" TEXT NOT NULL,
    "location" TEXT,
    "assemblyConstituencyId" TEXT,
    "parliamentaryConstituencyId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PollingBooth_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "PollingBooth_assemblyConstituencyId_idx" ON "PollingBooth"("assemblyConstituencyId");
CREATE INDEX IF NOT EXISTS "PollingBooth_parliamentaryConstituencyId_idx" ON "PollingBooth"("parliamentaryConstituencyId");

-- Step 5: Add foreign key constraints for Assembly Constituency
ALTER TABLE "AssemblyConstituency" ADD CONSTRAINT "AssemblyConstituency_districtId_fkey" 
    FOREIGN KEY ("districtId") REFERENCES "District"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AssemblyConstituency" ADD CONSTRAINT "AssemblyConstituency_parliamentaryConstituencyId_fkey" 
    FOREIGN KEY ("parliamentaryConstituencyId") REFERENCES "ParliamentaryConstituency"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Step 6: Add foreign key constraints for Polling Booth
ALTER TABLE "PollingBooth" ADD CONSTRAINT "PollingBooth_assemblyConstituencyId_fkey" 
    FOREIGN KEY ("assemblyConstituencyId") REFERENCES "AssemblyConstituency"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PollingBooth" ADD CONSTRAINT "PollingBooth_parliamentaryConstituencyId_fkey" 
    FOREIGN KEY ("parliamentaryConstituencyId") REFERENCES "ParliamentaryConstituency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Step 7: Migrate existing Taluk district data to District table
-- Insert unique districts from existing Taluk table
INSERT INTO "District" ("id", "name", "stateCode", "createdAt")
SELECT 
    'district_' || md5(district) as id,  
    district as name,
    'TN' as stateCode,
    CURRENT_TIMESTAMP as createdAt
FROM (SELECT DISTINCT district FROM "Taluk" WHERE district IS NOT NULL) AS districts
ON CONFLICT ("name") DO NOTHING;

-- Step 8: Add districtId column to Taluk table
ALTER TABLE "Taluk" ADD COLUMN IF NOT EXISTS "districtId" TEXT;

-- Step 9: Populate districtId from existing district text field
UPDATE "Taluk" t
SET "districtId" = d.id
FROM "District" d
WHERE t.district = d.name;

-- Step 10: Make districtId NOT NULL (after data migration)
-- Note: This requires all taluks to have a valid districtId
ALTER TABLE "Taluk" ALTER COLUMN "districtId" SET NOT NULL;

-- Step 11: Add foreign key constraint for Taluk -> District
ALTER TABLE "Taluk" ADD CONSTRAINT "Taluk_districtId_fkey" 
    FOREIGN KEY ("districtId") REFERENCES "District"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Step 12: Drop old district column from Taluk
ALTER TABLE "Taluk" DROP COLUMN IF EXISTS "district";

-- Step 13: Update unique constraint on Taluk
DROP INDEX IF EXISTS "Taluk_name_key";
CREATE UNIQUE INDEX IF NOT EXISTS "Taluk_districtId_name_key" ON "Taluk"("districtId", "name");
