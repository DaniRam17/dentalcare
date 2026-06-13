import { Router } from "express";
import fs from "fs";
import multer from "multer";
import path from "path";
import prisma from "../lib/prisma";
import { authenticate, authorize } from "../middlewares/auth";
import { logAudit } from "../services/auditService";
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
const optionalDate = z.string().optional().transform((value) => value ? new Date(value) : undefined);

const audit = (req: any, action: string, entity: string, id: string, beforeData?: unknown, afterData?: unknown) =>
  logAudit(action, entity, id, req.user?.id, undefined, beforeData, afterData, req.ip);

router.get("/lookups", authenticate, async (_req, res, next) => {
  try {
    const [patients, doctors, procedureTypes, inventoryItems, invoices] = await Promise.all([
      prisma.patient.findMany({ where: { isActive: true }, orderBy: { lastName: "asc" }, select: { id: true, firstName: true, lastName: true, documentNumber: true } }),
      prisma.employee.findMany({ where: { isActive: true, role: "DOCTOR" }, orderBy: { lastName: "asc" }, select: { id: true, firstName: true, lastName: true } }),
      prisma.procedureType.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true, price: true } }),
      prisma.inventoryItem.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, quantityAvailable: true, minimumStock: true, unitOfMeasure: true } }),
      prisma.invoice.findMany({ orderBy: { issueDate: "desc" }, select: { id: true, invoiceNumber: true, total: true, status: true, patient: { select: { firstName: true, lastName: true } } } }),
    ]);
    res.json({ patients, doctors, procedureTypes, inventoryItems, invoices });
  } catch (error) {
    next(error);
  }
});

router.get("/clinical-history", authenticate, async (req, res, next) => {
  try {
    const { search, patientId, doctorId } = req.query;
    const where: any = {};
    if (patientId) where.patientId = String(patientId);
    if (doctorId) where.odontologistId = String(doctorId);
    if (search) {
      where.OR = [
        { diagnosis: { contains: String(search), mode: "insensitive" } },
        { treatmentPerformed: { contains: String(search), mode: "insensitive" } },
        { observations: { contains: String(search), mode: "insensitive" } },
        { patient: { firstName: { contains: String(search), mode: "insensitive" } } },
        { patient: { lastName: { contains: String(search), mode: "insensitive" } } },
      ];
    }
    const data = await prisma.clinicalHistory.findMany({
      where,
      include: { patient: true, odontologist: true, appointment: true, procedureLog: { include: { procedureType: true } } },
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
      diagnosis: z.string().min(3),
      treatmentPerformed: z.string().optional().nullable(),
      observations: z.string().optional().nullable(),
      patientId: uuid,
      odontologistId: uuid.optional().nullable(),
      appointmentId: uuid.optional().nullable(),
      procedureLogId: uuid.optional().nullable(),
    }).parse(req.body);
    const record = await prisma.clinicalHistory.create({ data: body as any });
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
      include: { patient: true, payments: true, procedureLogs: { include: { procedureType: true } } },
      orderBy: { issueDate: "desc" },
    });
    res.json(invoices);
  } catch (error) {
    next(error);
  }
});

router.post("/billing", authenticate, authorize(["ADMIN", "RECEPTIONIST"]), async (req: any, res, next) => {
  try {
    const body = z.object({
      patientId: uuid,
      procedureLogIds: z.array(uuid).default([]),
      taxRate: z.number().min(0).max(1).default(0.15),
    }).parse(req.body);
    const procedureLogs = await prisma.procedureLog.findMany({
      where: { id: { in: body.procedureLogIds }, patientId: body.patientId },
      include: { procedureType: true },
    });
    const subtotal = procedureLogs.reduce((sum, item) => sum + item.procedureType.price, 0);
    const tax = Number((subtotal * body.taxRate).toFixed(2));
    const total = Number((subtotal + tax).toFixed(2));
    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber: `FAC-${Date.now()}`,
        patientId: body.patientId,
        subtotal,
        tax,
        total,
        status: total > 0 ? "PENDING" : "PAID",
        procedureLogs: { connect: body.procedureLogIds.map((id) => ({ id })) },
      },
      include: { patient: true, payments: true, procedureLogs: { include: { procedureType: true } } },
    });
    await audit(req, "CREATE", "Invoice", invoice.id, undefined, invoice);
    res.status(201).json(invoice);
  } catch (error) {
    next(error);
  }
});

router.get("/payments", authenticate, async (_req, res, next) => {
  try {
    const payments = await prisma.payment.findMany({ include: { invoice: { include: { patient: true } } }, orderBy: { paymentDate: "desc" } });
    res.json(payments);
  } catch (error) {
    next(error);
  }
});

router.post("/payments", authenticate, authorize(["ADMIN", "RECEPTIONIST"]), async (req: any, res, next) => {
  try {
    const body = z.object({ invoiceId: uuid, amount: z.number().positive(), paymentMethod: z.string().min(2) }).parse(req.body);
    const payment = await prisma.$transaction(async (tx) => {
      const created = await tx.payment.create({ data: { ...body, status: "PAID" } });
      const invoice = await tx.invoice.findUniqueOrThrow({ where: { id: body.invoiceId }, include: { payments: true } });
      const paid = invoice.payments.reduce((sum, item) => sum + item.amount, 0);
      await tx.invoice.update({ where: { id: body.invoiceId }, data: { status: paid >= invoice.total ? "PAID" : paid > 0 ? "PARTIAL" : "PENDING" } });
      return created;
    });
    await audit(req, "CREATE", "Payment", payment.id, undefined, payment);
    res.status(201).json(payment);
  } catch (error) {
    next(error);
  }
});

router.get("/inventory", authenticate, async (_req, res, next) => {
  try {
    const items = await prisma.inventoryItem.findMany({ include: { movements: { orderBy: { movementDate: "desc" }, take: 5 }, procedures: { include: { procedureType: true } } }, orderBy: { name: "asc" } });
    res.json(items);
  } catch (error) {
    next(error);
  }
});

router.post("/inventory", authenticate, authorize(["ADMIN"]), async (req: any, res, next) => {
  try {
    const body = z.object({ name: z.string().min(2), description: z.string().optional().nullable(), quantityAvailable: z.number().int().default(0), minimumStock: z.number().int().default(0), unitOfMeasure: z.string().min(1) }).parse(req.body);
    const item = await prisma.inventoryItem.create({ data: body });
    await audit(req, "CREATE", "InventoryItem", item.id, undefined, item);
    res.status(201).json(item);
  } catch (error) {
    next(error);
  }
});

router.post("/inventory/:id/movements", authenticate, authorize(["ADMIN", "DOCTOR"]), async (req: any, res, next) => {
  try {
    const body = z.object({ movementType: z.enum(["IN", "OUT", "ADJUST"]), quantity: z.number().int().positive(), reason: z.string().optional().nullable() }).parse(req.body);
    const result = await prisma.$transaction(async (tx) => {
      const item = await tx.inventoryItem.findUniqueOrThrow({ where: { id: req.params.id } });
      const nextQuantity = body.movementType === "IN" ? item.quantityAvailable + body.quantity : body.movementType === "OUT" ? item.quantityAvailable - body.quantity : body.quantity;
      if (nextQuantity < 0) throw new Error("Stock insuficiente");
      const movement = await tx.inventoryMovement.create({ data: { inventoryItemId: item.id, ...body } });
      const updated = await tx.inventoryItem.update({ where: { id: item.id }, data: { quantityAvailable: nextQuantity } });
      if (updated.quantityAvailable <= updated.minimumStock) {
        await tx.notification.create({ data: { type: "INVENTORY_ALERT", message: `Stock bajo: ${updated.name}`, status: "PENDING" } });
      }
      return { movement, updated };
    });
    await audit(req, "CREATE", "InventoryMovement", result.movement.id, undefined, result);
    res.status(201).json(result);
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

router.post("/consents", authenticate, authorize(["ADMIN", "DOCTOR"]), async (req: any, res, next) => {
  try {
    const body = z.object({ patientId: uuid, procedureLogId: uuid.optional().nullable(), description: z.string().min(3), documentUrl: z.string().optional().nullable(), status: z.string().default("SIGNED") }).parse(req.body);
    const consent = await prisma.consent.create({ data: body as any });
    await audit(req, "CREATE", "Consent", consent.id, undefined, consent);
    res.status(201).json(consent);
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

export default router;
