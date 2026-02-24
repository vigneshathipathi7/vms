-- CreateTable
CREATE TABLE "District" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "District_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LocalBody" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "districtId" TEXT NOT NULL,

    CONSTRAINT "LocalBody_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ward" (
    "id" TEXT NOT NULL,
    "wardNumber" TEXT NOT NULL,
    "localBodyId" TEXT NOT NULL,

    CONSTRAINT "Ward_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "District_name_key" ON "District"("name");

-- CreateIndex
CREATE UNIQUE INDEX "LocalBody_districtId_name_key" ON "LocalBody"("districtId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Ward_localBodyId_wardNumber_key" ON "Ward"("localBodyId", "wardNumber");

-- AddForeignKey
ALTER TABLE "LocalBody" ADD CONSTRAINT "LocalBody_districtId_fkey" FOREIGN KEY ("districtId") REFERENCES "District"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ward" ADD CONSTRAINT "Ward_localBodyId_fkey" FOREIGN KEY ("localBodyId") REFERENCES "LocalBody"("id") ON DELETE CASCADE ON UPDATE CASCADE;
