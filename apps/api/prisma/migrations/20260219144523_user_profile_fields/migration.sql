/*
  Warnings:

  - A unique constraint covering the columns `[email]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "User" ADD COLUMN     "bio" TEXT,
ADD COLUMN     "constituencyName" TEXT,
ADD COLUMN     "electionLevel" TEXT,
ADD COLUMN     "email" TEXT,
ADD COLUMN     "fullName" TEXT,
ADD COLUMN     "managedWard" TEXT,
ADD COLUMN     "officeAddress" TEXT,
ADD COLUMN     "partyName" TEXT,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "positionContesting" TEXT,
ADD COLUMN     "profilePhoto" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
