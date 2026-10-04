-- AlterTable
ALTER TABLE "companies" ADD COLUMN     "leavePolicy" JSONB NOT NULL DEFAULT '{}';

-- CreateTable
CREATE TABLE "leave_records" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "employeeId" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "leaveType" TEXT NOT NULL,
    "paid" BOOLEAN NOT NULL DEFAULT true,
    "reason" TEXT,
    "year" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leave_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "leave_records_companyId_year_idx" ON "leave_records"("companyId", "year");

-- CreateIndex
CREATE UNIQUE INDEX "leave_records_employeeId_date_key" ON "leave_records"("employeeId", "date");

-- AddForeignKey
ALTER TABLE "leave_records" ADD CONSTRAINT "leave_records_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_records" ADD CONSTRAINT "leave_records_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
