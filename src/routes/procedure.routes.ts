import { Router } from "express";
import prisma from "../lib/prisma";
import { authenticate, authorize } from "../middlewares/auth";
import { logAudit } from "../services/auditService";
import { z } from "zod";

const router = Router();

const procedureTypeSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
  price: z.number().positive(),
  risks: z.string().optional(),
});

const procedureLogSchema = z.object({
  date: z.string().transform(val => new Date(val)),
  anesthesiaType: z.string().optional(),
  notes: z.string().optional(),
  status: z.enum(["PENDING", "COMPLETED", "CANCELLED"]),
  procedureTypeId: z.string().uuid(),
  patientId: z.string().uuid(),
  doctorId: z.string().uuid(),
});

// --- Procedure Types (Catalog) ---
router.get("/types", authenticate, async (req, res, next) => {
  try {
    const types = await prisma.procedureType.findMany({ where: { isActive: true } });
    res.json(types);
  } catch (error) {
    next(error);
  }
});

router.post("/types", authenticate, authorize(["ADMIN"]), async (req: any, res, next) => {
  try {
    const data = procedureTypeSchema.parse(req.body);
    const type = await prisma.procedureType.create({ data });
    await logAudit("CREATE", "ProcedureType", type.id, req.user.id);
    res.status(201).json(type);
  } catch (error) {
    next(error);
  }
});

router.put("/types/:id", authenticate, authorize(["ADMIN"]), async (req: any, res, next) => {
  try {
    const { id } = req.params;
    const data = procedureTypeSchema.partial().parse(req.body);
    const type = await prisma.procedureType.update({ where: { id }, data });
    await logAudit("UPDATE", "ProcedureType", id, req.user.id);
    res.json(type);
  } catch (error) {
    next(error);
  }
});

router.delete("/types/:id", authenticate, authorize(["ADMIN"]), async (req: any, res, next) => {
  try {
    const { id } = req.params;
    await prisma.procedureType.update({ where: { id }, data: { isActive: false } });
    await logAudit("SOFT_DELETE", "ProcedureType", id, req.user.id);
    res.json({ message: "Tipo de procedimiento desactivado" });
  } catch (error) {
    next(error);
  }
});

// --- Procedure Logs (Patient Assignments) ---
router.get("/logs", authenticate, async (req, res, next) => {
  try {
    const { patientId, doctorId } = req.query;
    const where: any = {};
    if (patientId) where.patientId = String(patientId);
    if (doctorId) where.doctorId = String(doctorId);

    const logs = await prisma.procedureLog.findMany({
      where,
      include: { procedureType: true, patient: true, doctor: true },
      orderBy: { date: 'desc' }
    });
    res.json(logs);
  } catch (error) {
    next(error);
  }
});

router.post("/logs", authenticate, authorize(["ADMIN", "DOCTOR"]), async (req: any, res, next) => {
  try {
    const data = procedureLogSchema.parse(req.body);
    const log = await prisma.procedureLog.create({ 
      data: {
        date: data.date,
        anesthesiaType: data.anesthesiaType,
        notes: data.notes,
        status: data.status,
        procedureType: { connect: { id: data.procedureTypeId } },
        patient: { connect: { id: data.patientId } },
        doctor: { connect: { id: data.doctorId } }
      }
    });
    await logAudit("CREATE", "ProcedureLog", log.id, req.user.id);
    res.status(201).json(log);
  } catch (error) {
    next(error);
  }
});

export default router;
