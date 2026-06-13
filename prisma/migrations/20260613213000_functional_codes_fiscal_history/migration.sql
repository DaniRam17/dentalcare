-- Functional codes
ALTER TABLE "Patient" ADD COLUMN "patientCode" TEXT;
ALTER TABLE "Patient" ADD COLUMN "rtn" TEXT;
ALTER TABLE "Appointment" ADD COLUMN "appointmentCode" TEXT;
ALTER TABLE "Appointment" ADD COLUMN "procedureTypeId" TEXT;
ALTER TABLE "ProcedureType" ADD COLUMN "procedureCode" TEXT;
ALTER TABLE "ProcedureType" ADD COLUMN "category" TEXT;
ALTER TABLE "ProcedureType" ADD COLUMN "estimatedDuration" INTEGER;
ALTER TABLE "ProcedureType" ADD COLUMN "taxType" TEXT NOT NULL DEFAULT 'ISV_15';
ALTER TABLE "ClinicalHistory" ADD COLUMN "reason" TEXT;
ALTER TABLE "ClinicalHistory" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "ClinicalHistory" ADD COLUMN "employeeId" TEXT;
ALTER TABLE "ClinicalHistory" ADD COLUMN "shiftAssignmentId" TEXT;
ALTER TABLE "Shift" ADD COLUMN "shiftCode" TEXT;
ALTER TABLE "Shift" ADD COLUMN "daysOfWeek" TEXT;
ALTER TABLE "Shift" ADD COLUMN "notes" TEXT;
ALTER TABLE "ShiftAssignment" ADD COLUMN "endDate" TIMESTAMP(3);

CREATE UNIQUE INDEX "Patient_patientCode_key" ON "Patient"("patientCode");
CREATE UNIQUE INDEX "Appointment_appointmentCode_key" ON "Appointment"("appointmentCode");
CREATE UNIQUE INDEX "ProcedureType_procedureCode_key" ON "ProcedureType"("procedureCode");
CREATE UNIQUE INDEX "Shift_shiftCode_key" ON "Shift"("shiftCode");
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_procedureTypeId_fkey" FOREIGN KEY ("procedureTypeId") REFERENCES "ProcedureType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Fiscal ranges SAR
CREATE TABLE "FiscalDocumentRange" (
    "id" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "cai" TEXT NOT NULL,
    "establishmentCode" TEXT NOT NULL,
    "emissionPointCode" TEXT NOT NULL,
    "documentTypeCode" TEXT NOT NULL,
    "prefix" TEXT,
    "startNumber" INTEGER NOT NULL,
    "endNumber" INTEGER NOT NULL,
    "currentNumber" INTEGER NOT NULL DEFAULT 0,
    "nextNumber" INTEGER NOT NULL,
    "authorizationDate" TIMESTAMP(3) NOT NULL,
    "emissionDeadline" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FiscalDocumentRange_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "FiscalDocumentRange_documentType_status_idx" ON "FiscalDocumentRange"("documentType", "status");

-- Clinical procedures pending billing
CREATE TABLE "ClinicalHistoryProcedure" (
    "id" TEXT NOT NULL,
    "procedureCode" TEXT NOT NULL,
    "procedureName" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "taxType" TEXT NOT NULL DEFAULT 'ISV_15',
    "billingStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "performedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "clinicalHistoryId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "procedureTypeId" TEXT NOT NULL,
    "performedById" TEXT,
    "invoiceId" TEXT,

    CONSTRAINT "ClinicalHistoryProcedure_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ClinicalHistoryProcedure_patientId_billingStatus_idx" ON "ClinicalHistoryProcedure"("patientId", "billingStatus");
CREATE INDEX "ClinicalHistoryProcedure_clinicalHistoryId_idx" ON "ClinicalHistoryProcedure"("clinicalHistoryId");
ALTER TABLE "ClinicalHistoryProcedure" ADD CONSTRAINT "ClinicalHistoryProcedure_clinicalHistoryId_fkey" FOREIGN KEY ("clinicalHistoryId") REFERENCES "ClinicalHistory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ClinicalHistoryProcedure" ADD CONSTRAINT "ClinicalHistoryProcedure_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ClinicalHistoryProcedure" ADD CONSTRAINT "ClinicalHistoryProcedure_procedureTypeId_fkey" FOREIGN KEY ("procedureTypeId") REFERENCES "ProcedureType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ClinicalHistoryProcedure" ADD CONSTRAINT "ClinicalHistoryProcedure_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Fiscal invoice snapshot
ALTER TABLE "Invoice" ADD COLUMN "invoiceCode" TEXT;
ALTER TABLE "Invoice" ADD COLUMN "fiscalNumber" TEXT;
ALTER TABLE "Invoice" ADD COLUMN "cai" TEXT;
ALTER TABLE "Invoice" ADD COLUMN "rangeStart" INTEGER;
ALTER TABLE "Invoice" ADD COLUMN "rangeEnd" INTEGER;
ALTER TABLE "Invoice" ADD COLUMN "emissionDeadline" TIMESTAMP(3);
ALTER TABLE "Invoice" ADD COLUMN "customerName" TEXT;
ALTER TABLE "Invoice" ADD COLUMN "customerIdentity" TEXT;
ALTER TABLE "Invoice" ADD COLUMN "customerRtn" TEXT;
ALTER TABLE "Invoice" ADD COLUMN "customerAddress" TEXT;
ALTER TABLE "Invoice" ADD COLUMN "taxable15" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Invoice" ADD COLUMN "taxable18" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Invoice" ADD COLUMN "exemptAmount" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Invoice" ADD COLUMN "exoneratedAmount" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Invoice" ADD COLUMN "isv15" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Invoice" ADD COLUMN "isv18" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Invoice" ADD COLUMN "discountTotal" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Invoice" ADD COLUMN "totalInWords" TEXT;
ALTER TABLE "Invoice" ADD COLUMN "paymentMethod" TEXT;
ALTER TABLE "Invoice" ADD COLUMN "notes" TEXT;
ALTER TABLE "Invoice" ADD COLUMN "createdById" TEXT;
ALTER TABLE "Invoice" ADD COLUMN "cancelledById" TEXT;
ALTER TABLE "Invoice" ADD COLUMN "cancelledAt" TIMESTAMP(3);
ALTER TABLE "Invoice" ADD COLUMN "cancellationReason" TEXT;
ALTER TABLE "Invoice" ADD COLUMN "fiscalRangeId" TEXT;
CREATE UNIQUE INDEX "Invoice_invoiceCode_key" ON "Invoice"("invoiceCode");
CREATE UNIQUE INDEX "Invoice_fiscalNumber_key" ON "Invoice"("fiscalNumber");
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_fiscalRangeId_fkey" FOREIGN KEY ("fiscalRangeId") REFERENCES "FiscalDocumentRange"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "InvoiceItem" ADD COLUMN "itemCode" TEXT;
ALTER TABLE "InvoiceItem" ADD COLUMN "discount" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "InvoiceItem" ADD COLUMN "taxType" TEXT NOT NULL DEFAULT 'ISV_15';
ALTER TABLE "InvoiceItem" ADD COLUMN "taxRate" DOUBLE PRECISION NOT NULL DEFAULT 0.15;
ALTER TABLE "InvoiceItem" ADD COLUMN "taxAmount" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "InvoiceItem" ADD COLUMN "clinicalHistoryProcedureId" TEXT;
ALTER TABLE "InvoiceItem" ADD CONSTRAINT "InvoiceItem_clinicalHistoryProcedureId_fkey" FOREIGN KEY ("clinicalHistoryProcedureId") REFERENCES "ClinicalHistoryProcedure"("id") ON DELETE SET NULL ON UPDATE CASCADE;
