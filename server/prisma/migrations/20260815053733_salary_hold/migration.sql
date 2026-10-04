-- AlterTable
ALTER TABLE "employees" ADD COLUMN     "salaryHold" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "salaryHoldReason" TEXT;
