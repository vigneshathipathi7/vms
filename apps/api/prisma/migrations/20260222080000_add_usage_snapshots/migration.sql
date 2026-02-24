-- CreateTable
CREATE TABLE "UsageSnapshot" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "totalVoters" INTEGER NOT NULL,
    "totalExports" INTEGER NOT NULL,
    "totalUsers" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UsageSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UsageSnapshot_candidateId_idx" ON "UsageSnapshot"("candidateId");

-- CreateIndex
CREATE INDEX "UsageSnapshot_month_idx" ON "UsageSnapshot"("month");

-- CreateIndex
CREATE UNIQUE INDEX "UsageSnapshot_candidateId_month_key" ON "UsageSnapshot"("candidateId", "month");
