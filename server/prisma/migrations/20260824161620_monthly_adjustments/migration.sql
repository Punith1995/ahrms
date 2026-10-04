-- AlterTable
ALTER TABLE "leave_encashments" ADD COLUMN     "month" INTEGER;

-- CreateTable
CREATE TABLE "monthly_deductions" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "employeeId" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "food" INTEGER NOT NULL DEFAULT 0,
    "transport" INTEGER NOT NULL DEFAULT 0,
    "uniform" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "monthly_deductions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "monthly_deductions_companyId_year_month_idx" ON "monthly_deductions"("companyId", "year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "monthly_deductions_employeeId_year_month_key" ON "monthly_deductions"("employeeId", "year", "month");

-- AddForeignKey
ALTER TABLE "monthly_deductions" ADD CONSTRAINT "monthly_deductions_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monthly_deductions" ADD CONSTRAINT "monthly_deductions_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
