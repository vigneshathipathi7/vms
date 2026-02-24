-- SUPER_ADMIN control layer
-- Adds SUPER_ADMIN role support and security/audit primitives

-- 1) Extend enums
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'SUPER_ADMIN';

ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'SUPER_ADMIN_LOGIN';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'APPROVE_CANDIDATE';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'REJECT_CANDIDATE';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'DISABLE_USER';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'DISABLE_CANDIDATE';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'VIEW_GLOBAL_VOTERS';

-- 2) User model updates
ALTER TABLE "User" ALTER COLUMN "candidateId" DROP NOT NULL;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true;
CREATE INDEX IF NOT EXISTS "User_isActive_idx" ON "User"("isActive");

-- 3) Refresh tokens can be global for SUPER_ADMIN
ALTER TABLE "RefreshToken" ALTER COLUMN "candidateId" DROP NOT NULL;

-- 4) Audit IP tracking
ALTER TABLE "AuditLog" ADD COLUMN IF NOT EXISTS "ipAddress" TEXT;
CREATE INDEX IF NOT EXISTS "AuditLog_ipAddress_idx" ON "AuditLog"("ipAddress");

-- 5) Password setup token table for activation flow
CREATE TABLE IF NOT EXISTS "PasswordSetupToken" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PasswordSetupToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PasswordSetupToken_tokenHash_key" ON "PasswordSetupToken"("tokenHash");
CREATE INDEX IF NOT EXISTS "PasswordSetupToken_userId_idx" ON "PasswordSetupToken"("userId");
CREATE INDEX IF NOT EXISTS "PasswordSetupToken_expiresAt_idx" ON "PasswordSetupToken"("expiresAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'PasswordSetupToken_userId_fkey'
  ) THEN
    ALTER TABLE "PasswordSetupToken"
      ADD CONSTRAINT "PasswordSetupToken_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id")
      ON DELETE CASCADE
      ON UPDATE CASCADE;
  END IF;
END $$;
