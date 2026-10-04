-- CreateTable
CREATE TABLE "leave_encashments" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "employeeId" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "days" DOUBLE PRECISION NOT NULL,
    "amount" INTEGER NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "leave_encashments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "leave_encashments_employeeId_year_idx" ON "leave_encashments"("employeeId", "year");

-- AddForeignKey
ALTER TABLE "leave_encashments" ADD CONSTRAINT "leave_encashments_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_encashments" ADD CONSTRAINT "leave_encashments_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
