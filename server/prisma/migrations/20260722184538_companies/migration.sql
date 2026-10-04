-- CreateTable
CREATE TABLE "companies" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "legalName" TEXT NOT NULL,
    "logoUrl" TEXT,
    "entityType" TEXT NOT NULL DEFAULT 'Private Limited',
    "industry" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Onboarding',
    "onboardedOn" TIMESTAMP(3),
    "headcount" INTEGER NOT NULL DEFAULT 0,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "pin" TEXT,
    "contactPerson" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "registrations" JSONB NOT NULL DEFAULT '{}',
    "bank" JSONB NOT NULL DEFAULT '{}',
    "payroll" JSONB NOT NULL DEFAULT '{}',
    "compliance" JSONB NOT NULL DEFAULT '{}',
    "authorization" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_documents" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "docKey" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "fileName" TEXT,
    "filePath" TEXT,
    "fileSize" INTEGER,
    "mimeType" TEXT,
    "receivedOn" TIMESTAMP(3),
    "expiresOn" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "companies_code_key" ON "companies"("code");

-- CreateIndex
CREATE INDEX "company_documents_expiresOn_idx" ON "company_documents"("expiresOn");

-- CreateIndex
CREATE UNIQUE INDEX "company_documents_companyId_docKey_key" ON "company_documents"("companyId", "docKey");

-- AddForeignKey
ALTER TABLE "company_documents" ADD CONSTRAINT "company_documents_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
