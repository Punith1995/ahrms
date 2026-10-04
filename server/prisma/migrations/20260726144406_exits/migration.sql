-- CreateTable
CREATE TABLE "exits" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "employeeId" INTEGER NOT NULL,
    "stage" TEXT NOT NULL DEFAULT 'initiated',
    "status" TEXT NOT NULL DEFAULT 'in_progress',
    "exitType" TEXT NOT NULL DEFAULT 'Resignation',
    "reason" TEXT,
    "resignedOn" TIMESTAMP(3),
    "lastWorkingDay" TIMESTAMP(3),
    "noticeServedDays" INTEGER NOT NULL DEFAULT 0,
    "noticeRequiredDays" INTEGER NOT NULL DEFAULT 0,
    "clearance" JSONB NOT NULL DEFAULT '{}',
    "pendingSalary" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "leaveEncashment" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "gratuity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "bonus" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "otherEarnings" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "noticeRecovery" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "loanRecovery" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "otherDeductions" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "netSettlement" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "settlementSnapshot" JSONB NOT NULL DEFAULT '{}',
    "completedOn" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "exits_employeeId_key" ON "exits"("employeeId");

-- CreateIndex
CREATE INDEX "exits_companyId_status_idx" ON "exits"("companyId", "status");

-- AddForeignKey
ALTER TABLE "exits" ADD CONSTRAINT "exits_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exits" ADD CONSTRAINT "exits_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
