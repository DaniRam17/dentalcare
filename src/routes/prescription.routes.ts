import { Router } from "express";
import prisma from "../lib/prisma";
import { authenticate, authorize } from "../middlewares/auth";
import { logAudit } from "../services/auditService";
import { createPrescriptionPdf } from "../services/pdfService";
import { z } from "zod";

const router = Router();

const prescriptionSchema = z.object({
  patientId: z.string().uuid(),
  items: z.array(z.object({
    drugName: z.string(),
    presentation: z.string(),
    dosage: z.string(),
    frequency: z.string(),
    duration: z.string(),
  })).min(1),
});

router.get("/", authenticate, async (req, res, next) => {
  try {
    const { patientId } = req.query;
    const where: any = { isActive: true };
    if (patientId) where.patientId = String(patientId);

    const prescriptions = await prisma.prescription.findMany({
      where,
      include: { patient: true, doctor: true, items: true },
      orderBy: { date: 'desc' }
    });
    res.json(prescriptions);
  } catch (error) {
    next(error);
  }
});

router.post("/", authenticate, authorize(["ADMIN", "DOCTOR"]), async (req: any, res, next) => {
  try {
    const { patientId, items } = prescriptionSchema.parse(req.body);
    
    // Get last correlative
    const last = await prisma.prescription.findFirst({ orderBy: { correlative: 'desc' } });
    const nextCorrelative = (last?.correlative || 0) + 1;

    const prescription = await prisma.prescription.create({
      data: {
        patientId,
        doctorId: req.user.id,
        correlative: nextCorrelative,
        items: {
          create: items
        }
      },
      include: { patient: true, doctor: true, items: true }
    });

    await logAudit("CREATE", "Prescription", prescription.id, req.user.id);
    res.status(201).json(prescription);
  } catch (error) {
    next(error);
  }
});

router.get("/:id/pdf", authenticate, async (req, res, next) => {
  try {
    const prescription = await prisma.prescription.findUniqueOrThrow({
      where: { id: req.params.id },
      include: { patient: true, doctor: true, items: true },
    });
    const pdf = createPrescriptionPdf(prescription);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="receta-${prescription.correlative}.pdf"`);
    res.send(pdf);
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", authenticate, authorize(["ADMIN", "DOCTOR"]), async (req: any, res, next) => {
  try {
    const { id } = req.params;
    const prescription = await prisma.prescription.findUnique({ where: { id } });
    
    if (!prescription) return res.status(404).json({ error: "Receta no encontrada" });

    // Regla: no eliminar después de 24h
    const hours = (new Date().getTime() - new Date(prescription.createdAt).getTime()) / (1000 * 60 * 60);
    if (hours > 24 && req.user.role !== "ADMIN") {
      return res.status(400).json({ error: "No se puede eliminar una receta después de 24 horas" });
    }

    await prisma.prescription.update({ where: { id }, data: { isActive: false } });
    await logAudit("CANCEL", "Prescription", id, req.user.id);
    res.json({ message: "Receta cancelada" });
  } catch (error) {
    next(error);
  }
});

export default router;
