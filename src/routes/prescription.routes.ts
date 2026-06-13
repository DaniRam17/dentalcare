import { Router } from "express";
import prisma from "../lib/prisma";
import { authenticate, authorize } from "../middlewares/auth";
import { logAudit } from "../services/auditService";
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
    const lines = [
      "DentalCare Pro",
      `Receta #${String(prescription.correlative).padStart(4, "0")}`,
      `Fecha: ${prescription.date.toLocaleDateString()}`,
      `Paciente: ${prescription.patient.firstName} ${prescription.patient.lastName}`,
      `Codigo paciente: ${prescription.patient.patientCode || "-"}`,
      `Documento: ${prescription.patient.documentNumber}`,
      `Doctor: Dr. ${prescription.doctor.firstName} ${prescription.doctor.lastName}`,
      "",
      "Medicamentos:",
      ...prescription.items.flatMap((item, index) => [
        `${index + 1}. ${item.drugName} (${item.presentation})`,
        `   Dosis: ${item.dosage} | Frecuencia: ${item.frequency} | Duracion: ${item.duration}`,
      ]),
      "",
      "Indicaciones emitidas electronicamente desde DentalCare Pro.",
    ];
    const pdf = createSimplePdf(lines);
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

function createSimplePdf(lines: string[]) {
  const escaped = lines.map((line) => line.replace(/[\\()]/g, "\\$&"));
  const content = [
    "BT",
    "/F1 12 Tf",
    "50 780 Td",
    "16 TL",
    ...escaped.flatMap((line, index) => [index === 0 ? "" : "T*", `(${line}) Tj`]).filter(Boolean),
    "ET",
  ].join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`,
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf);
}
