import { Router } from "express";
import prisma from "../lib/prisma";
import { authenticate, authorize } from "../middlewares/auth";
import { logAudit } from "../services/auditService";
import { z } from "zod";

const router = Router();

const patientSchema = z.object({
  firstName: z.string().min(2),
  lastName: z.string().min(2),
  birthDate: z.string().transform(val => new Date(val)),
  gender: z.string(),
  documentType: z.string(),
  documentNumber: z.string(),
  phone: z.string(),
  email: z.string().email().optional().nullable(),
  address: z.string().optional().nullable(),
  doctorId: z.string().optional().nullable(),
  allergies: z.string().optional().nullable(),
  chronicDiseases: z.string().optional().nullable(),
  medications: z.string().optional().nullable(),
  familyHistory: z.string().optional().nullable(),
});

router.get("/", authenticate, async (req, res, next) => {
  try {
    const { search, doctorId, page = "1", limit = "10" } = req.query;
    const p = parseInt(page as string);
    const l = parseInt(limit as string);
    
    const where: any = { isActive: true };
    if (search) {
      where.OR = [
        { firstName: { contains: String(search), mode: 'insensitive' } },
        { lastName: { contains: String(search), mode: 'insensitive' } },
        { documentNumber: { contains: String(search) } },
      ];
    }
    if (doctorId) where.doctorId = String(doctorId);

    const [patients, total] = await Promise.all([
      prisma.patient.findMany({
        where,
        include: { doctor: true },
        skip: (p - 1) * l,
        take: l,
        orderBy: { lastName: 'asc' }
      }),
      prisma.patient.count({ where })
    ]);

    res.json({
      data: patients,
      meta: {
        total,
        page: p,
        lastPage: Math.ceil(total / l)
      }
    });
  } catch (error) {
    next(error);
  }
});

router.post("/", authenticate, authorize(["ADMIN", "RECEPTIONIST"]), async (req: any, res, next) => {
  try {
    const data = patientSchema.parse(req.body);
    const patient = await prisma.patient.create({ 
      data: { 
        firstName: data.firstName,
        lastName: data.lastName,
        birthDate: data.birthDate,
        gender: data.gender,
        documentType: data.documentType,
        documentNumber: data.documentNumber,
        phone: data.phone,
        email: data.email,
        address: data.address,
        allergies: data.allergies,
        chronicDiseases: data.chronicDiseases,
        medications: data.medications,
        familyHistory: data.familyHistory,
        doctor: data.doctorId ? { connect: { id: data.doctorId } } : undefined
      } 
    });
    await logAudit("CREATE", "Patient", patient.id, req.user.id);
    res.status(201).json(patient);
  } catch (error) {
    next(error);
  }
});

router.put("/:id", authenticate, authorize(["ADMIN", "RECEPTIONIST"]), async (req: any, res, next) => {
  try {
    const { id } = req.params;
    const data = patientSchema.partial().parse(req.body);
    const patient = await prisma.patient.update({ where: { id }, data });
    await logAudit("UPDATE", "Patient", id, req.user.id);
    res.json(patient);
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", authenticate, authorize(["ADMIN"]), async (req: any, res, next) => {
  try {
    const { id } = req.params;
    const history = await prisma.appointment.count({ where: { patientId: id } });
    
    if (history > 0) {
      await prisma.patient.update({ where: { id }, data: { isActive: false } });
      await logAudit("SOFT_DELETE", "Patient", id, req.user.id, "History exists");
      return res.json({ message: "Paciente desactivado (tiene historial)" });
    }

    await prisma.patient.delete({ where: { id } });
    await logAudit("DELETE", "Patient", id, req.user.id);
    res.json({ message: "Paciente eliminado" });
  } catch (error) {
    next(error);
  }
});

export default router;
