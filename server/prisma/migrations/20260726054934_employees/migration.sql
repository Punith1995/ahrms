-- CreateTable
CREATE TABLE "employees" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "employeeCode" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "fatherSpouseName" TEXT,
    "dob" TIMESTAMP(3),
    "gender" TEXT,
    "maritalStatus" TEXT,
    "mobile" TEXT,
    "email" TEXT,
    "address" TEXT,
    "emergencyName" TEXT,
    "emergencyPhone" TEXT,
    "designation" TEXT,
    "department" TEXT,
    "doj" TIMESTAMP(3),
    "employmentType" TEXT DEFAULT 'Permanent',
    "workLocation" TEXT,
    "reportingTo" TEXT,
    "probationMonths" INTEGER NOT NULL DEFAULT 0,
    "shiftPattern" TEXT,
    "weeklyOff" TEXT,
    "aadhaar" TEXT,
    "pan" TEXT,
    "uan" TEXT,
    "esicIp" TEXT,
    "pfApplicable" BOOLEAN NOT NULL DEFAULT true,
    "esiApplicable" BOOLEAN NOT NULL DEFAULT true,
    "ptApplicable" BOOLEAN NOT NULL DEFAULT true,
    "previousPfMember" BOOLEAN NOT NULL DEFAULT false,
    "bankAccountName" TEXT,
    "bankName" TEXT,
    "bankAccountNo" TEXT,
    "bankIfsc" TEXT,
    "ctcMonthly" INTEGER NOT NULL DEFAULT 0,
    "salaryStructure" JSONB NOT NULL DEFAULT '{}',
    "joiningStage" TEXT NOT NULL DEFAULT 'personal',
    "joiningStatus" TEXT NOT NULL DEFAULT 'in_progress',
    "status" TEXT NOT NULL DEFAULT 'Onboarding',
    "startedOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "joinedOn" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_documents" (
    "id" SERIAL NOT NULL,
    "employeeId" INTEGER NOT NULL,
    "docKey" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "fileName" TEXT,
    "filePath" TEXT,
    "fileSize" INTEGER,
    "mimeType" TEXT,
    "receivedOn" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "employees_companyId_joiningStatus_idx" ON "employees"("companyId", "joiningStatus");

-- CreateIndex
CREATE UNIQUE INDEX "employees_companyId_employeeCode_key" ON "employees"("companyId", "employeeCode");

-- CreateIndex
CREATE UNIQUE INDEX "employee_documents_employeeId_docKey_key" ON "employee_documents"("employeeId", "docKey");

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_documents" ADD CONSTRAINT "employee_documents_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
