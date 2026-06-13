import { Router } from "express";
import prisma from "../lib/prisma";
import { authenticate, authorize } from "../middlewares/auth";
import { logAudit } from "../services/auditService";
import { z } from "zod";

const router = Router();

// Responsable
const responsibleSchema = z.object({
  firstName: z.string().min(2),
  lastName: z.string().min(2),
  relationship: z.string().min(2),
  phone: z.string().min(6),
  email: z.string().email().optional().nullable(),
  documentNumber: z.string().optional().nullable(),
});

router.get("/responsibles", authenticate, async (_req, res, next) => {
  try { res.json(await prisma.responsible.findMany({ include: { patients: true } })); } catch (e) { next(e); }
});

router.post("/responsibles", authenticate, authorize(["ADMIN", "RECEPTIONIST"]), async (req: any, res, next) => {
  try {
    const item = await prisma.responsible.create({ data: responsibleSchema.parse(req.body) });
    await logAudit("CREATE", "Responsible", item.id, req.user.id, undefined, undefined, item, req.ip);
    res.status(201).json(item);
  } catch (e) { next(e); }
});

// Historial clínico
const clinicalHistorySchema = z.object({
  patientId: z.string().uuid(),
  odontologistId: z.string().uuid().optional().nullable(),
  appointmentId: z.string().uuid().optional().nullable(),
  procedureLogId: z.string().uuid().optional().nullable(),
  diagnosis: z.string().min(2),
  treatmentPerformed: z.string().optional().nullable(),
  observations: z.string().optional().nullable(),
  date: z.string().optional().transform(v => v ? new Date(v) : new Date()),
});

router.get("/clinical-history", authenticate, async (req, res, next) => {
  try {
    const { patientId, odontologistId } = req.query;
    const where: any = {};
    if (patientId) where.patientId = String(patientId);
    if (odontologistId) where.odontologistId = String(odontologistId);
    res.json(await prisma.clinicalHistory.findMany({
      where,
      include: { patient: true, odontologist: true, appointment: true, procedureLog: true },
      orderBy: { date: "desc" },
    }));
  } catch (e) { next(e); }
});

router.post("/clinical-history", authenticate, authorize(["ADMIN", "DOCTOR"]), async (req: any, res, next) => {
  try {
    const data = clinicalHistorySchema.parse(req.body);
    const item = await prisma.clinicalHistory.create({ data: data as any });
    await logAudit("CREATE", "ClinicalHistory", item.id, req.user.id, "Nota clínica agregada", undefined, item, req.ip);
    res.status(201).json(item);
  } catch (e) { next(e); }
});

// Archivos clínicos: metadata. Para carga real se puede conectar storage local/cloud.
const patientFileSchema = z.object({
  patientId: z.string().uuid(),
  fileName: z.string().min(2),
  fileType: z.string().min(2),
  fileUrl: z.string().min(2),
});

router.get("/patient-files", authenticate, async (req, res, next) => {
  try {
    const where: any = {};
    if (req.query.patientId) where.patientId = String(req.query.patientId);
    res.json(await prisma.patientFile.findMany({ where, include: { patient: true }, orderBy: { uploadedAt: "desc" } }));
  } catch (e) { next(e); }
});

router.post("/patient-files", authenticate, async (req: any, res, next) => {
  try {
    const item = await prisma.patientFile.create({ data: patientFileSchema.parse(req.body) });
    await logAudit("CREATE", "PatientFile", item.id, req.user.id, undefined, undefined, item, req.ip);
    res.status(201).json(item);
  } catch (e) { next(e); }
});

// Consentimientos informados
const consentSchema = z.object({
  patientId: z.string().uuid(),
  procedureLogId: z.string().uuid().optional().nullable(),
  description: z.string().min(3),
  documentUrl: z.string().optional().nullable(),
  status: z.string().default("SIGNED"),
});

router.get("/consents", authenticate, async (req, res, next) => {
  try {
    const where: any = {};
    if (req.query.patientId) where.patientId = String(req.query.patientId);
    res.json(await prisma.consent.findMany({ where, include: { patient: true, procedureLog: true }, orderBy: { signedAt: "desc" } }));
  } catch (e) { next(e); }
});

router.post("/consents", authenticate, authorize(["ADMIN", "DOCTOR", "RECEPTIONIST"]), async (req: any, res, next) => {
  try {
    const item = await prisma.consent.create({ data: consentSchema.parse(req.body) });
    await logAudit("CREATE", "Consent", item.id, req.user.id, undefined, undefined, item, req.ip);
    res.status(201).json(item);
  } catch (e) { next(e); }
});

// Inventario
const inventoryItemSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional().nullable(),
  quantityAvailable: z.number().int().default(0),
  minimumStock: z.number().int().default(0),
  unitOfMeasure: z.string().min(1),
});

router.get("/inventory/items", authenticate, async (_req, res, next) => {
  try { res.json(await prisma.inventoryItem.findMany({ orderBy: { name: "asc" } })); } catch (e) { next(e); }
});

router.post("/inventory/items", authenticate, authorize(["ADMIN", "NURSE"]), async (req: any, res, next) => {
  try {
    const item = await prisma.inventoryItem.create({ data: inventoryItemSchema.parse(req.body) });
    await logAudit("CREATE", "InventoryItem", item.id, req.user.id, undefined, undefined, item, req.ip);
    res.status(201).json(item);
  } catch (e) { next(e); }
});

const movementSchema = z.object({
  inventoryItemId: z.string().uuid(),
  movementType: z.enum(["ENTRADA", "SALIDA", "AJUSTE"]),
  quantity: z.number().int().positive(),
  reason: z.string().optional().nullable(),
});

router.post("/inventory/movements", authenticate, authorize(["ADMIN", "NURSE"]), async (req: any, res, next) => {
  try {
    const data = movementSchema.parse(req.body);
    const item = await prisma.inventoryItem.findUniqueOrThrow({ where: { id: data.inventoryItemId } });
    const newQty = data.movementType === "SALIDA" ? item.quantityAvailable - data.quantity : item.quantityAvailable + data.quantity;
    if (newQty < 0) return res.status(400).json({ error: "No hay stock suficiente" });

    const result = await prisma.$transaction(async (tx) => {
      const movement = await tx.inventoryMovement.create({ data });
      const updated = await tx.inventoryItem.update({ where: { id: item.id }, data: { quantityAvailable: newQty } });
      if (updated.quantityAvailable <= updated.minimumStock) {
        await tx.notification.create({ data: { type: "STOCK_LOW", message: `Stock bajo: ${updated.name}`, status: "PENDING" } });
      }
      return { movement, updated };
    });
    await logAudit("CREATE", "InventoryMovement", result.movement.id, req.user.id, data.movementType, item, result.updated, req.ip);
    res.status(201).json(result);
  } catch (e) { next(e); }
});

// Especialidades
const specialtySchema = z.object({ name: z.string().min(2), description: z.string().optional().nullable() });
router.get("/specialties", authenticate, async (_req, res, next) => {
  try { res.json(await prisma.specialty.findMany({ include: { doctors: true }, orderBy: { name: "asc" } })); } catch (e) { next(e); }
});
router.post("/specialties", authenticate, authorize(["ADMIN"]), async (req: any, res, next) => {
  try {
    const item = await prisma.specialty.create({ data: specialtySchema.parse(req.body) });
    await logAudit("CREATE", "Specialty", item.id, req.user.id, undefined, undefined, item, req.ip);
    res.status(201).json(item);
  } catch (e) { next(e); }
});

// Facturación y pagos
const invoiceSchema = z.object({
  patientId: z.string().uuid(),
  procedureLogIds: z.array(z.string().uuid()).optional().default([]),
  subtotal: z.number().nonnegative(),
  tax: z.number().nonnegative().default(0),
});

router.get("/invoices", authenticate, async (req, res, next) => {
  try {
    const where: any = {};
    if (req.query.patientId) where.patientId = String(req.query.patientId);
    res.json(await prisma.invoice.findMany({ where, include: { patient: true, procedureLogs: true, payments: true }, orderBy: { issueDate: "desc" } }));
  } catch (e) { next(e); }
});

router.post("/invoices", authenticate, authorize(["ADMIN", "RECEPTIONIST"]), async (req: any, res, next) => {
  try {
    const data = invoiceSchema.parse(req.body);
    const total = data.subtotal + data.tax;
    const last = await prisma.invoice.count();
    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber: `FAC-${String(last + 1).padStart(8, "0")}`,
        patientId: data.patientId,
        subtotal: data.subtotal,
        tax: data.tax,
        total,
        procedureLogs: data.procedureLogIds.length ? { connect: data.procedureLogIds.map(id => ({ id })) } : undefined,
      },
    });
    await logAudit("CREATE", "Invoice", invoice.id, req.user.id, undefined, undefined, invoice, req.ip);
    res.status(201).json(invoice);
  } catch (e) { next(e); }
});

const paymentSchema = z.object({ invoiceId: z.string().uuid(), amount: z.number().positive(), paymentMethod: z.string().min(2) });
router.post("/payments", authenticate, authorize(["ADMIN", "RECEPTIONIST"]), async (req: any, res, next) => {
  try {
    const data = paymentSchema.parse(req.body);
    const invoice = await prisma.invoice.findUniqueOrThrow({ where: { id: data.invoiceId }, include: { payments: true } });
    const paidBefore = invoice.payments.reduce((sum, p) => sum + p.amount, 0);
    const paidAfter = paidBefore + data.amount;
    const status = paidAfter >= invoice.total ? "PAID" : "PARTIAL";
    const result = await prisma.$transaction(async (tx) => {
      const payment = await tx.payment.create({ data });
      const updatedInvoice = await tx.invoice.update({ where: { id: invoice.id }, data: { status } });
      return { payment, updatedInvoice };
    });
    await logAudit("CREATE", "Payment", result.payment.id, req.user.id, status, invoice, result.updatedInvoice, req.ip);
    res.status(201).json(result);
  } catch (e) { next(e); }
});

// Notificaciones y auditoría
router.get("/notifications", authenticate, async (_req, res, next) => {
  try { res.json(await prisma.notification.findMany({ orderBy: { createdAt: "desc" } })); } catch (e) { next(e); }
});
router.get("/audit", authenticate, authorize(["ADMIN"]), async (_req, res, next) => {
  try { res.json(await prisma.auditLog.findMany({ orderBy: { timestamp: "desc" }, take: 200 })); } catch (e) { next(e); }
});

export default router;
