-- AlterTable
ALTER TABLE "monthly_deductions" ADD COLUMN     "advance" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "loan" INTEGER NOT NULL DEFAULT 0;
