-- CreateTable
CREATE TABLE "CreditDebitNote" (
    "id" TEXT NOT NULL,
    "noteCode" TEXT,
    "documentType" TEXT NOT NULL,
    "fiscalNumber" TEXT NOT NULL,
    "cai" TEXT,
    "rangeStart" INTEGER,
    "rangeEnd" INTEGER,
    "emissionDeadline" TIMESTAMP(3),
    "reason" TEXT NOT NULL,
    "subtotal" DOUBLE PRECISION NOT NULL,
    "tax" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ISSUED',
    "issueDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,
    "invoiceId" TEXT NOT NULL,
    "fiscalRangeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreditDebitNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CreditDebitNote_noteCode_key" ON "CreditDebitNote"("noteCode");

-- CreateIndex
CREATE UNIQUE INDEX "CreditDebitNote_fiscalNumber_key" ON "CreditDebitNote"("fiscalNumber");

-- AddForeignKey
ALTER TABLE "CreditDebitNote" ADD CONSTRAINT "CreditDebitNote_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditDebitNote" ADD CONSTRAINT "CreditDebitNote_fiscalRangeId_fkey" FOREIGN KEY ("fiscalRangeId") REFERENCES "FiscalDocumentRange"("id") ON DELETE SET NULL ON UPDATE CASCADE;
