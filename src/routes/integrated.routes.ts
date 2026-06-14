import { Router } from "express";
import fs from "fs";
import multer from "multer";
import path from "path";
import prisma from "../lib/prisma";
import { authenticate, authorize } from "../middlewares/auth";
import { logAudit } from "../services/auditService";
import { createConsentPdf, createInvoicePdf } from "../services/pdfService";
import { z } from "zod";

const router = Router();
const uploadDir = path.resolve(process.cwd(), "uploads", "clinical");

fs.mkdirSync(uploadDir, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadDir),
    filename: (_req, file, cb) => cb(null, `${Date.now()}-${cryptoSafeName(file.originalname)}${path.extname(file.originalname).toLowerCase()}`),
  }),
  fileFilter: (_req, file, cb) => {
    if (["application/pdf", "image/jpeg", "image/png"].includes(file.mimetype)) return cb(null, true);
    cb(new Error("Solo se permiten PDF, JPG y PNG"));
  },
  limits: { fileSize: 15 * 1024 * 1024 },
});

const uuid = z.string().uuid();
const optionalDate = z.string().optional().transform((value) => value ? parseLocalDate(value) : undefined);

function parseLocalDate(value: string) {
  const [datePart, timePart] = value.split("T");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hour = 12, minute = 0] = (timePart || "").split(":").map(Number);
  return new Date(year, month - 1, day, hour, minute, 0, 0);
}

const audit = (req: any, action: string, entity: string, id: string, beforeData?: unknown, afterData?: unknown) =>
  logAudit(action, entity, id, req.user?.id, undefined, beforeData, afterData, req.ip);

router.get("/lookups", authenticate, async (_req, res, next) => {
  try {
    const [patients, doctors, procedureTypes, procedureLogs, clinicalProcedures, inventoryItems, invoices, fiscalRanges] = await Promise.all([
      prisma.patient.findMany({ where: { isActive: true }, orderBy: { lastName: "asc" }, select: { id: true, patientCode: true, firstName: true, lastName: true, documentNumber: true, rtn: true, phone: true } }),
      prisma.employee.findMany({ where: { isActive: true, role: "DOCTOR" }, orderBy: { lastName: "asc" }, select: { id: true, firstName: true, lastName: true } }),
      prisma.procedureType.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, procedureCode: true, name: true, price: true, description: true, taxType: true } }),
      prisma.procedureLog.findMany({
        where: { invoiceId: null, status: { not: "CANCELLED" } },
        orderBy: { date: "desc" },
        select: { id: true, date: true, patientId: true, procedureType: { select: { name: true, price: true } }, patient: { select: { firstName: true, lastName: true, documentNumber: true } } },
      }),
      prisma.clinicalHistoryProcedure.findMany({
        where: { billingStatus: "PENDING" },
        orderBy: { performedAt: "desc" },
        include: { patient: { select: { firstName: true, lastName: true, patientCode: true, documentNumber: true } }, procedureType: true },
      }),
      prisma.inventoryItem.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, inventoryCode: true, name: true, quantityAvailable: true, minimumStock: true, unitOfMeasure: true, unitPrice: true, taxable: true } }),
      prisma.invoice.findMany({ where: { status: { in: ["PENDING", "PARTIAL"] } }, orderBy: { issueDate: "desc" }, select: { id: true, invoiceNumber: true, fiscalNumber: true, total: true, status: true, payments: true, patient: { select: { firstName: true, lastName: true } } } }),
      prisma.fiscalDocumentRange.findMany({ where: { status: "ACTIVE" }, orderBy: { emissionDeadline: "asc" } }),
    ]);
    res.json({ patients, doctors, procedureTypes, procedureLogs, clinicalProcedures, inventoryItems, invoices, fiscalRanges });
  } catch (error) {
    next(error);
  }
});

router.get("/clinical-history", authenticate, async (req, res, next) => {
  try {
    const { search, patientId, doctorId, date } = req.query;
    const where: any = {};
    if (patientId) where.patientId = String(patientId);
    if (doctorId) where.odontologistId = String(doctorId);
    if (search) {
      where.OR = [
        { diagnosis: { contains: String(search), mode: "insensitive" } },
        { treatmentPerformed: { contains: String(search), mode: "insensitive" } },
        { observations: { contains: String(search), mode: "insensitive" } },
        { reason: { contains: String(search), mode: "insensitive" } },
        { patient: { patientCode: { contains: String(search), mode: "insensitive" } } },
        { patient: { documentNumber: { contains: String(search) } } },
        { patient: { firstName: { contains: String(search), mode: "insensitive" } } },
        { patient: { lastName: { contains: String(search), mode: "insensitive" } } },
        { procedures: { some: { procedureName: { contains: String(search), mode: "insensitive" } } } },
        { procedures: { some: { procedureCode: { contains: String(search), mode: "insensitive" } } } },
      ];
    }
    if (date) {
      const start = parseLocalDate(String(date));
      start.setHours(0, 0, 0, 0);
      const end = parseLocalDate(String(date));
      end.setHours(23, 59, 59, 999);
      where.date = { gte: start, lte: end };
    }
    const data = await prisma.clinicalHistory.findMany({
      where,
      include: { patient: true, odontologist: true, appointment: true, procedureLog: { include: { procedureType: true } }, procedures: true },
      orderBy: { date: "desc" },
    });
    res.json(data);
  } catch (error) {
    next(error);
  }
});

router.post("/clinical-history", authenticate, authorize(["ADMIN", "DOCTOR"]), async (req: any, res, next) => {
  try {
    const body = z.object({
      date: optionalDate,
      reason: z.string().optional().nullable(),
      diagnosis: z.string().min(3),
      treatmentPerformed: z.string().optional().nullable(),
      observations: z.string().optional().nullable(),
      status: z.string().default("ACTIVE"),
      patientId: uuid,
      odontologistId: uuid.optional().nullable(),
      appointmentId: uuid.optional().nullable(),
      procedureLogId: uuid.optional().nullable(),
      procedureTypeIds: z.array(uuid).default([]),
    }).parse(req.body);
    const record = await prisma.$transaction(async (tx) => {
      const procedures = await tx.procedureType.findMany({ where: { id: { in: body.procedureTypeIds }, isActive: true } });
      return tx.clinicalHistory.create({
        data: {
          date: body.date,
          reason: body.reason,
          diagnosis: body.diagnosis,
          treatmentPerformed: body.treatmentPerformed,
          observations: body.observations,
          status: body.status,
          patientId: body.patientId,
          odontologistId: body.odontologistId,
          appointmentId: body.appointmentId,
          procedureLogId: body.procedureLogId,
          employeeId: req.user?.id,
          procedures: {
            create: procedures.map((procedure) => ({
              patientId: body.patientId,
              procedureTypeId: procedure.id,
              procedureCode: procedure.procedureCode || procedure.id,
              procedureName: procedure.name,
              price: procedure.price,
              taxType: procedure.taxType,
              billingStatus: "PENDING",
              performedById: body.odontologistId || req.user?.id,
            })),
          },
        },
        include: { patient: true, odontologist: true, procedures: true },
      });
    });
    await audit(req, "CREATE", "ClinicalHistory", record.id, undefined, record);
    res.status(201).json(record);
  } catch (error) {
    next(error);
  }
});

router.put("/clinical-history/:id", authenticate, authorize(["ADMIN", "DOCTOR"]), async (req: any, res, next) => {
  try {
    const before = await prisma.clinicalHistory.findUniqueOrThrow({ where: { id: req.params.id } });
    const body = z.object({
      date: optionalDate,
      diagnosis: z.string().min(3).optional(),
      treatmentPerformed: z.string().optional().nullable(),
      observations: z.string().optional().nullable(),
      patientId: uuid.optional(),
      odontologistId: uuid.optional().nullable(),
    }).parse(req.body);
    const record = await prisma.clinicalHistory.update({ where: { id: req.params.id }, data: body as any });
    await audit(req, "UPDATE", "ClinicalHistory", record.id, before, record);
    res.json(record);
  } catch (error) {
    next(error);
  }
});

router.delete("/clinical-history/:id", authenticate, authorize(["ADMIN"]), async (req: any, res, next) => {
  try {
    const before = await prisma.clinicalHistory.delete({ where: { id: req.params.id } });
    await audit(req, "DELETE", "ClinicalHistory", req.params.id, before);
    res.json({ message: "Historial eliminado" });
  } catch (error) {
    next(error);
  }
});

router.get("/clinical-files", authenticate, async (req, res, next) => {
  try {
    const where = req.query.patientId ? { patientId: String(req.query.patientId) } : {};
    const files = await prisma.patientFile.findMany({ where, include: { patient: true }, orderBy: { uploadedAt: "desc" } });
    res.json(files);
  } catch (error) {
    next(error);
  }
});

router.post(
  "/clinical-files",
  authenticate,
  authorize(["ADMIN", "DOCTOR", "RECEPTIONIST"]),
  upload.single("file"),
  async (req: any, res, next) => {
    try {
      const patientId = z.string().uuid().parse(req.body.patientId);
      if (!req.file) return res.status(400).json({ error: "Archivo requerido" });
      const file = await prisma.patientFile.create({
        data: { patientId, fileName: req.file.originalname, fileType: req.file.mimetype, fileUrl: `/api/clinical-files/${req.file.filename}/download` },
      });
      await audit(req, "CREATE", "PatientFile", file.id, undefined, file);
      res.status(201).json(file);
    } catch (error) {
      next(error);
    }
  }
);

router.get("/clinical-files/:storedName/download", authenticate, (req, res) => {
  const safeName = path.basename(req.params.storedName);
  res.download(path.join(uploadDir, safeName));
});

router.delete("/clinical-files/:id", authenticate, authorize(["ADMIN", "DOCTOR"]), async (req: any, res, next) => {
  try {
    const file = await prisma.patientFile.delete({ where: { id: req.params.id } });
    const storedName = path.basename(file.fileUrl.replace("/download", ""));
    await fs.promises.unlink(path.join(uploadDir, storedName)).catch(() => undefined);
    await audit(req, "DELETE", "PatientFile", file.id, file);
    res.json({ message: "Archivo eliminado" });
  } catch (error) {
    next(error);
  }
});

router.get("/billing", authenticate, async (req, res, next) => {
  try {
    const where = req.query.patientId ? { patientId: String(req.query.patientId) } : {};
    const invoices = await prisma.invoice.findMany({
      where,
      include: { patient: true, payments: true, items: { include: { inventoryItem: true } }, procedureLogs: { include: { procedureType: true } } },
      orderBy: { issueDate: "desc" },
    });
    res.json(invoices);
  } catch (error) {
    next(error);
  }
});

router.get("/billing/pending-procedures/:patientId", authenticate, async (req, res, next) => {
  try {
    const procedures = await prisma.clinicalHistoryProcedure.findMany({
      where: { patientId: req.params.patientId, billingStatus: "PENDING" },
      include: { patient: true, clinicalHistory: true, procedureType: true },
      orderBy: { performedAt: "desc" },
    });
    res.json(procedures);
  } catch (error) {
    next(error);
  }
});

router.post("/billing", authenticate, authorize(["ADMIN", "RECEPTIONIST"]), async (req: any, res, next) => {
  try {
    const body = z.object({
      patientId: uuid,
      procedureLogIds: z.array(uuid).default([]),
      clinicalProcedureIds: z.array(uuid).default([]),
      inventoryItems: z.array(z.object({
        inventoryItemId: uuid,
        quantity: z.number().int().positive(),
        unitPrice: z.number().nonnegative(),
        taxable: z.boolean().default(true),
      })).default([]),
      taxRate: z.number().min(0).max(1).default(0.15),
      paymentMethod: z.string().optional().nullable(),
      notes: z.string().optional().nullable(),
    }).parse(req.body);
    const invoice = await prisma.$transaction(async (tx) => {
      const patient = await tx.patient.findUniqueOrThrow({ where: { id: body.patientId } });
      const fiscalRange = await tx.fiscalDocumentRange.findFirst({
        where: { documentType: "FACTURA", status: "ACTIVE", emissionDeadline: { gte: new Date() } },
        orderBy: { emissionDeadline: "asc" },
      });
      if (!fiscalRange) throw new Error("No existe un rango SAR/CAI activo y vigente para emitir factura");
      if (fiscalRange.nextNumber > fiscalRange.endNumber) throw new Error("El rango SAR activo esta agotado");

      const clinicalProcedures = await tx.clinicalHistoryProcedure.findMany({
        where: { id: { in: body.clinicalProcedureIds }, patientId: body.patientId, billingStatus: "PENDING" },
      });
      if (clinicalProcedures.length !== body.clinicalProcedureIds.length) {
        throw new Error("Uno o mas procedimientos ya no estan pendientes de facturar");
      }
      const procedureLogs = await tx.procedureLog.findMany({
        where: { id: { in: body.procedureLogIds }, patientId: body.patientId },
        include: { procedureType: true },
      });
      const inventoryIds = body.inventoryItems.map((item) => item.inventoryItemId);
      const inventory = await tx.inventoryItem.findMany({ where: { id: { in: inventoryIds } } });
      const inventoryLines = body.inventoryItems.map((line) => {
        const item = inventory.find((inventoryItem) => inventoryItem.id === line.inventoryItemId);
        if (!item) throw new Error("Insumo de inventario no encontrado");
        if (item.quantityAvailable < line.quantity) throw new Error(`Stock insuficiente para ${item.name}`);
        const lineSubtotal = Number((line.quantity * line.unitPrice).toFixed(2));
        const lineTax = line.taxable ? Number((lineSubtotal * body.taxRate).toFixed(2)) : 0;
        return { line, item, subtotal: lineSubtotal, tax: lineTax, total: Number((lineSubtotal + lineTax).toFixed(2)) };
      });
      const procedureLines = procedureLogs.map((log) => {
        const subtotal = Number(log.procedureType.price.toFixed(2));
        const tax = Number((subtotal * body.taxRate).toFixed(2));
        return { log, subtotal, tax, total: Number((subtotal + tax).toFixed(2)) };
      });
      const clinicalLines = clinicalProcedures.map((procedure) => {
        const subtotal = Number(procedure.price.toFixed(2));
        const rate = taxRateFor(procedure.taxType, body.taxRate);
        const tax = Number((subtotal * rate).toFixed(2));
        return { procedure, subtotal, tax, total: Number((subtotal + tax).toFixed(2)), rate };
      });
      if (procedureLines.length + clinicalLines.length + inventoryLines.length === 0) throw new Error("La factura debe tener al menos una linea");
      const subtotal = Number((procedureLines.reduce((sum, item) => sum + item.subtotal, 0) + clinicalLines.reduce((sum, item) => sum + item.subtotal, 0) + inventoryLines.reduce((sum, item) => sum + item.subtotal, 0)).toFixed(2));
      const tax = Number((procedureLines.reduce((sum, item) => sum + item.tax, 0) + clinicalLines.reduce((sum, item) => sum + item.tax, 0) + inventoryLines.reduce((sum, item) => sum + item.tax, 0)).toFixed(2));
      const total = Number((subtotal + tax).toFixed(2));
      const invoiceCode = await nextInvoiceCode(tx);
      const fiscalNumber = formatFiscalNumber(fiscalRange, fiscalRange.nextNumber);
      const taxable15 = Number((clinicalLines.filter((item) => item.rate === 0.15).reduce((sum, item) => sum + item.subtotal, 0) + procedureLines.reduce((sum, item) => sum + item.subtotal, 0) + inventoryLines.filter((item) => item.line.taxable).reduce((sum, item) => sum + item.subtotal, 0)).toFixed(2));
      const exemptAmount = Number((clinicalLines.filter((item) => item.rate === 0).reduce((sum, item) => sum + item.subtotal, 0) + inventoryLines.filter((item) => !item.line.taxable).reduce((sum, item) => sum + item.subtotal, 0)).toFixed(2));
      const created = await tx.invoice.create({
        data: {
          invoiceCode,
          invoiceNumber: fiscalNumber,
          fiscalNumber,
          fiscalRangeId: fiscalRange.id,
          cai: fiscalRange.cai,
          rangeStart: fiscalRange.startNumber,
          rangeEnd: fiscalRange.endNumber,
          emissionDeadline: fiscalRange.emissionDeadline,
          patientId: body.patientId,
          customerName: `${patient.firstName} ${patient.lastName}`,
          customerIdentity: patient.documentNumber,
          customerRtn: patient.rtn,
          customerAddress: patient.address,
          subtotal,
          tax,
          total,
          taxable15,
          taxable18: 0,
          exemptAmount,
          isv15: tax,
          isv18: 0,
          totalInWords: totalToWords(total),
          paymentMethod: body.paymentMethod,
          notes: body.notes,
          createdById: req.user?.id,
          status: total > 0 ? "PENDING" : "PAID",
          procedureLogs: { connect: procedureLogs.map((log) => ({ id: log.id })) },
          items: {
            create: [
              ...clinicalLines.map((item) => ({
                description: item.procedure.procedureName,
                itemCode: item.procedure.procedureCode,
                itemType: "PROCEDURE",
                quantity: 1,
                unitPrice: item.subtotal,
                taxable: item.rate > 0,
                taxType: item.procedure.taxType,
                taxRate: item.rate,
                taxAmount: item.tax,
                tax: item.tax,
                total: item.total,
                clinicalHistoryProcedureId: item.procedure.id,
              })),
              ...procedureLines.map((item) => ({
                description: item.log.procedureType.name,
                itemCode: item.log.procedureType.procedureCode,
                itemType: "PROCEDURE",
                quantity: 1,
                unitPrice: item.subtotal,
                taxable: true,
                taxType: item.log.procedureType.taxType,
                taxRate: body.taxRate,
                taxAmount: item.tax,
                tax: item.tax,
                total: item.total,
                procedureLogId: item.log.id,
              })),
              ...inventoryLines.map((item) => ({
                description: item.item.name,
                itemType: "INVENTORY",
                quantity: item.line.quantity,
                unitPrice: item.line.unitPrice,
                taxable: item.line.taxable,
                taxType: item.line.taxable ? "ISV_15" : "EXEMPT",
                taxRate: item.line.taxable ? body.taxRate : 0,
                taxAmount: item.tax,
                tax: item.tax,
                total: item.total,
                inventoryItemId: item.item.id,
              })),
            ],
          },
        },
        include: { patient: true, payments: true, items: { include: { inventoryItem: true, clinicalHistoryProcedure: true } }, procedureLogs: { include: { procedureType: true } }, clinicalProcedures: true },
      });
      await tx.fiscalDocumentRange.update({
        where: { id: fiscalRange.id },
        data: {
          currentNumber: fiscalRange.nextNumber,
          nextNumber: fiscalRange.nextNumber + 1,
          status: fiscalRange.nextNumber + 1 > fiscalRange.endNumber ? "AGOTADO" : fiscalRange.status,
        },
      });
      await tx.clinicalHistoryProcedure.updateMany({
        where: { id: { in: clinicalProcedures.map((item) => item.id) } },
        data: { billingStatus: "BILLED", invoiceId: created.id },
      });
      for (const item of inventoryLines) {
        const stockAfter = item.item.quantityAvailable - item.line.quantity;
        await tx.inventoryItem.update({ where: { id: item.item.id }, data: { quantityAvailable: stockAfter } });
        await tx.inventoryMovement.create({
          data: {
            inventoryItemId: item.item.id,
            movementType: "OUT",
            quantity: item.line.quantity,
            stockBefore: item.item.quantityAvailable,
            stockAfter,
            reason: `Factura ${created.invoiceNumber}`,
            reference: created.fiscalNumber || created.invoiceNumber,
            userId: req.user?.id,
          },
        });
      }
      return created;
    });
    await audit(req, "CREATE", "Invoice", invoice.id, undefined, invoice);
    res.status(201).json(invoice);
  } catch (error) {
    next(error);
  }
});

router.get("/billing/:id/pdf", authenticate, async (req, res, next) => {
  try {
    const invoice = await prisma.invoice.findUniqueOrThrow({
      where: { id: req.params.id },
      include: { patient: true, payments: true, items: true },
    });
    const pdf = createInvoicePdf(invoice);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${invoice.invoiceNumber}.pdf"`);
    res.send(pdf);
  } catch (error) {
    next(error);
  }
});

router.get("/payments", authenticate, async (_req, res, next) => {
  try {
    const payments = await prisma.payment.findMany({ include: { invoice: { include: { patient: true, payments: true } } }, orderBy: { paymentDate: "desc" } });
    res.json(payments);
  } catch (error) {
    next(error);
  }
});

router.post("/payments", authenticate, authorize(["ADMIN", "RECEPTIONIST"]), async (req: any, res, next) => {
  try {
    const body = z.object({
      invoiceId: uuid,
      amount: z.number().positive(),
      paymentMethod: z.enum(["Efectivo", "Tarjeta", "Transferencia", "POS", "Billetera digital", "Otro", "Tarjeta de credito", "Tarjeta de debito", "App de pagos"]),
      reference: z.string().optional().nullable(),
      processor: z.string().optional().nullable(),
    }).parse(req.body);
    const payment = await prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.findUniqueOrThrow({ where: { id: body.invoiceId }, include: { payments: true } });
      const paidBefore = invoice.payments.filter((item) => item.status !== "CANCELLED").reduce((sum, item) => sum + item.amount, 0);
      const balance = Number((invoice.total - paidBefore).toFixed(2));
      if (body.amount > balance) throw new Error(`El pago excede el saldo pendiente (${formatMoney(balance)})`);
      const reference = body.reference || await nextPaymentReference(tx);
      const created = await tx.payment.create({ data: { ...body, reference, status: "PAID" } });
      const paid = paidBefore + created.amount;
      await tx.invoice.update({ where: { id: body.invoiceId }, data: { status: paid >= invoice.total ? "PAID" : paid > 0 ? "PARTIAL" : "PENDING" } });
      return created;
    });
    await audit(req, "CREATE", "Payment", payment.id, undefined, payment);
    res.status(201).json(payment);
  } catch (error) {
    next(error);
  }
});

router.patch("/payments/:id/cancel", authenticate, authorize(["ADMIN", "RECEPTIONIST"]), async (req: any, res, next) => {
  try {
    const body = z.object({ reason: z.string().min(3) }).parse(req.body);
    const result = await prisma.$transaction(async (tx) => {
      const payment = await tx.payment.update({ where: { id: req.params.id }, data: { status: "CANCELLED", cancellationReason: body.reason, cancelledAt: new Date() } });
      const invoice = await tx.invoice.findUniqueOrThrow({ where: { id: payment.invoiceId }, include: { payments: true } });
      const paid = invoice.payments.filter((item) => item.id !== payment.id && item.status !== "CANCELLED").reduce((sum, item) => sum + item.amount, 0);
      await tx.invoice.update({ where: { id: invoice.id }, data: { status: paid >= invoice.total ? "PAID" : paid > 0 ? "PARTIAL" : "PENDING" } });
      return payment;
    });
    await audit(req, "CANCEL", "Payment", result.id, undefined, result);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.get("/consents", authenticate, async (_req, res, next) => {
  try {
    const consents = await prisma.consent.findMany({ include: { patient: true, procedureLog: { include: { procedureType: true } } }, orderBy: { signedAt: "desc" } });
    res.json(consents);
  } catch (error) {
    next(error);
  }
});

router.post("/consents", authenticate, authorize(["ADMIN", "DOCTOR", "RECEPTIONIST"]), upload.single("file"), async (req: any, res, next) => {
  try {
    const body = z.object({
      patientId: uuid,
      procedureLogId: z.preprocess((value) => value || undefined, uuid.optional().nullable()),
      description: z.string().min(3),
      documentUrl: z.string().optional().nullable(),
      signerName: z.string().optional().nullable(),
      signatureDataUrl: z.string().optional().nullable(),
      status: z.string().default("SIGNED"),
    }).parse(req.body);
    const documentUrl = req.file ? `/api/clinical-files/${req.file.filename}/download` : body.documentUrl;
    const consent = await prisma.consent.create({ data: { ...body, documentUrl } as any });
    await audit(req, "CREATE", "Consent", consent.id, undefined, consent);
    res.status(201).json(consent);
  } catch (error) {
    next(error);
  }
});

router.get("/consents/:id/pdf", authenticate, async (req, res, next) => {
  try {
    const consent = await prisma.consent.findUniqueOrThrow({
      where: { id: req.params.id },
      include: { patient: true, procedureLog: { include: { procedureType: true } } },
    });
    const pdf = createConsentPdf(consent);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="consentimiento-${consent.id}.pdf"`);
    res.send(pdf);
  } catch (error) {
    next(error);
  }
});

router.get("/fiscal-ranges", authenticate, authorize(["ADMIN", "RECEPTIONIST"]), async (_req, res, next) => {
  try {
    const ranges = await prisma.fiscalDocumentRange.findMany({ orderBy: { createdAt: "desc" } });
    res.json(ranges);
  } catch (error) {
    next(error);
  }
});

router.post("/fiscal-ranges", authenticate, authorize(["ADMIN"]), async (req: any, res, next) => {
  try {
    const body = z.object({
      documentType: z.enum(["FACTURA", "NOTA_CREDITO", "NOTA_DEBITO"]).default("FACTURA"),
      cai: z.string().min(5),
      establishmentCode: z.string().min(3).max(3),
      emissionPointCode: z.string().min(3).max(3),
      documentTypeCode: z.string().min(2).max(2),
      prefix: z.string().optional().nullable(),
      startNumber: z.number().int().positive(),
      endNumber: z.number().int().positive(),
      currentNumber: z.number().int().nonnegative().default(0),
      nextNumber: z.number().int().positive().optional(),
      authorizationDate: z.string().transform(parseLocalDate),
      emissionDeadline: z.string().transform(parseLocalDate),
      status: z.enum(["ACTIVE", "INACTIVE", "VENCIDO", "AGOTADO"]).default("ACTIVE"),
      notes: z.string().optional().nullable(),
    }).parse(req.body);
    if (body.endNumber < body.startNumber) return res.status(400).json({ error: "El numero final debe ser mayor o igual al inicial" });
    const range = await prisma.fiscalDocumentRange.create({
      data: {
        documentType: body.documentType,
        cai: body.cai,
        establishmentCode: body.establishmentCode,
        emissionPointCode: body.emissionPointCode,
        documentTypeCode: body.documentTypeCode,
        prefix: body.prefix,
        startNumber: body.startNumber,
        endNumber: body.endNumber,
        currentNumber: body.currentNumber,
        nextNumber: body.nextNumber || body.startNumber,
        authorizationDate: body.authorizationDate,
        emissionDeadline: body.emissionDeadline,
        status: body.status,
        notes: body.notes,
        createdById: req.user?.id,
      },
    });
    await audit(req, "CREATE", "FiscalDocumentRange", range.id, undefined, range);
    res.status(201).json(range);
  } catch (error) {
    next(error);
  }
});

router.patch("/fiscal-ranges/:id/status", authenticate, authorize(["ADMIN"]), async (req: any, res, next) => {
  try {
    const body = z.object({ status: z.enum(["ACTIVE", "INACTIVE", "VENCIDO", "AGOTADO"]) }).parse(req.body);
    const range = await prisma.fiscalDocumentRange.update({ where: { id: req.params.id }, data: { status: body.status, updatedById: req.user?.id } });
    await audit(req, "UPDATE", "FiscalDocumentRange", range.id, undefined, range);
    res.json(range);
  } catch (error) {
    next(error);
  }
});

router.get("/notifications", authenticate, async (_req, res, next) => {
  try {
    const notifications = await prisma.notification.findMany({ include: { appointment: { include: { patient: true, doctor: true } } }, orderBy: { createdAt: "desc" } });
    res.json(notifications);
  } catch (error) {
    next(error);
  }
});

router.post("/notifications", authenticate, authorize(["ADMIN", "RECEPTIONIST"]), async (req: any, res, next) => {
  try {
    const body = z.object({ type: z.string().min(2), message: z.string().min(3), appointmentId: uuid.optional().nullable(), status: z.string().default("PENDING") }).parse(req.body);
    const notification = await prisma.notification.create({ data: body as any });
    await audit(req, "CREATE", "Notification", notification.id, undefined, notification);
    res.status(201).json(notification);
  } catch (error) {
    next(error);
  }
});

router.patch("/notifications/:id/read", authenticate, async (req: any, res, next) => {
  try {
    const notification = await prisma.notification.update({ where: { id: req.params.id }, data: { status: "SENT", sentAt: new Date() } });
    await audit(req, "UPDATE", "Notification", notification.id, undefined, notification);
    res.json(notification);
  } catch (error) {
    next(error);
  }
});

router.get("/audit", authenticate, authorize(["ADMIN"]), async (_req, res, next) => {
  try {
    const logs = await prisma.auditLog.findMany({ include: { user: true }, orderBy: { timestamp: "desc" }, take: 200 });
    res.json(logs);
  } catch (error) {
    next(error);
  }
});

router.get("/specialties", authenticate, async (_req, res, next) => {
  try {
    const specialties = await prisma.specialty.findMany({ include: { doctors: true }, orderBy: { name: "asc" } });
    res.json(specialties);
  } catch (error) {
    next(error);
  }
});

router.post("/specialties", authenticate, authorize(["ADMIN"]), async (req: any, res, next) => {
  try {
    const body = z.object({ name: z.string().min(2), description: z.string().optional().nullable(), doctorIds: z.array(uuid).default([]) }).parse(req.body);
    const specialty = await prisma.specialty.create({ data: { name: body.name, description: body.description, doctors: { connect: body.doctorIds.map((id) => ({ id })) } } });
    await audit(req, "CREATE", "Specialty", specialty.id, undefined, specialty);
    res.status(201).json(specialty);
  } catch (error) {
    next(error);
  }
});

router.put("/specialties/:id/doctors", authenticate, authorize(["ADMIN"]), async (req: any, res, next) => {
  try {
    const body = z.object({ doctorIds: z.array(uuid) }).parse(req.body);
    const specialty = await prisma.specialty.update({ where: { id: req.params.id }, data: { doctors: { set: body.doctorIds.map((id) => ({ id })) } }, include: { doctors: true } });
    await audit(req, "UPDATE", "Specialty", specialty.id, undefined, specialty);
    res.json(specialty);
  } catch (error) {
    next(error);
  }
});

router.get("/real-reports", authenticate, authorize(["ADMIN"]), async (_req, res, next) => {
  try {
    const [revenue, appointments, inventory, productivity] = await Promise.all([
      prisma.invoice.aggregate({ _sum: { total: true, subtotal: true, tax: true }, _count: true }),
      prisma.appointment.groupBy({ by: ["status"], _count: true }),
      prisma.inventoryItem.findMany(),
      prisma.procedureLog.groupBy({ by: ["doctorId"], _count: true }),
    ]);
    const doctors = await prisma.employee.findMany({ where: { id: { in: productivity.map((item) => item.doctorId) } } });
    res.json({
      revenue,
      appointments,
      inventory: inventory.filter((item) => item.quantityAvailable <= item.minimumStock),
      productivity: productivity.map((item) => ({ ...item, doctor: doctors.find((doctor) => doctor.id === item.doctorId) })),
    });
  } catch (error) {
    next(error);
  }
});

function cryptoSafeName(name: string) {
  return path.parse(name).name.replace(/[^a-z0-9-_]+/gi, "-").slice(0, 80) || "archivo";
}

function formatMoney(value: number) {
  return `$${Number(value || 0).toFixed(2)}`;
}

async function nextInvoiceCode(tx: any) {
  const last = await tx.invoice.findFirst({
    where: { invoiceCode: { not: null } },
    orderBy: { invoiceCode: "desc" },
    select: { invoiceCode: true },
  });
  const next = Number(last?.invoiceCode?.replace("FAC-", "") || "0") + 1;
  return `FAC-${String(next).padStart(6, "0")}`;
}

async function nextPaymentReference(tx: any) {
  const last = await tx.payment.findFirst({
    where: { reference: { startsWith: "PAY-" } },
    orderBy: { paymentDate: "desc" },
    select: { reference: true },
  });
  const today = new Date();
  const stamp = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}`;
  const lastNumber = last?.reference?.includes(stamp) ? Number(last.reference.split("-").pop() || "0") : 0;
  return `PAY-${stamp}-${String(lastNumber + 1).padStart(6, "0")}`;
}

function formatFiscalNumber(range: any, number: number) {
  return `${range.establishmentCode}-${range.emissionPointCode}-${range.documentTypeCode}-${String(number).padStart(8, "0")}`;
}

function taxRateFor(taxType: string | null | undefined, fallback: number) {
  if (taxType === "EXEMPT") return 0;
  if (taxType === "ISV_18") return 0.18;
  if (taxType === "ISV_15") return 0.15;
  return fallback;
}

function totalToWords(value: number) {
  return `${Number(value || 0).toFixed(2)} LEMPIRAS`;
}

export default router;
