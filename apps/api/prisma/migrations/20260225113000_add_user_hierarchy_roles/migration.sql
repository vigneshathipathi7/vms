-- Add new hierarchy roles
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'SUB_ADMIN';
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'VOLUNTEER';

-- Add parent-child user hierarchy
ALTER TABLE "User"
ADD COLUMN IF NOT EXISTS "parentUserId" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'User_parentUserId_fkey'
  ) THEN
    ALTER TABLE "User"
    ADD CONSTRAINT "User_parentUserId_fkey"
    FOREIGN KEY ("parentUserId") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "User_parentUserId_idx" ON "User"("parentUserId");
