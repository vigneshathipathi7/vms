-- Finalize secure password setup flow

-- 1) Add missing audit action
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'PASSWORD_SETUP_COMPLETED';

-- 2) Allow pending admin accounts with null password until setup
ALTER TABLE "User" ALTER COLUMN "passwordHash" DROP NOT NULL;

-- 3) Update PasswordSetupToken model shape
ALTER TABLE "PasswordSetupToken" ADD COLUMN IF NOT EXISTS "used" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "PasswordSetupToken" DROP COLUMN IF EXISTS "usedAt";

DROP INDEX IF EXISTS "PasswordSetupToken_tokenHash_key";
CREATE UNIQUE INDEX IF NOT EXISTS "PasswordSetupToken_userId_key" ON "PasswordSetupToken"("userId");
CREATE INDEX IF NOT EXISTS "PasswordSetupToken_tokenHash_idx" ON "PasswordSetupToken"("tokenHash");
