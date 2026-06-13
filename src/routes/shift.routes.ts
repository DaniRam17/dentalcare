import { Router } from "express";
import prisma from "../lib/prisma";
import { authenticate, authorize } from "../middlewares/auth";
import { logAudit } from "../services/auditService";
import { z } from "zod";

const router = Router();

const shiftSchema = z.object({
  name: z.string(),
  startTime: z.string(),
  endTime: z.string(),
  daysOfWeek: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
});

const assignmentSchema = z.object({
  date: z.string().transform(val => new Date(val)),
  employeeId: z.string().uuid(),
  shiftId: z.string().uuid(),
  endDate: z.string().optional().nullable().transform(val => val ? new Date(val) : undefined),
});

router.get("/", authenticate, async (req, res, next) => {
  try {
    const shifts = await prisma.shift.findMany({ where: { isActive: true } });
    res.json(shifts);
  } catch (error) {
    next(error);
  }
});

router.post("/", authenticate, authorize(["ADMIN", "RECEPTIONIST"]), async (req: any, res, next) => {
  try {
    const data = shiftSchema.parse(req.body);
    const shiftCode = await nextShiftCode();
    const shift = await prisma.shift.create({ data: { ...data, shiftCode, isActive: data.isActive ?? true } });
    await logAudit("CREATE", "Shift", shift.id, req.user.id);
    res.status(201).json(shift);
  } catch (error) {
    next(error);
  }
});

router.put("/:id", authenticate, authorize(["ADMIN", "RECEPTIONIST"]), async (req: any, res, next) => {
  try {
    const data = shiftSchema.partial().parse(req.body);
    const shift = await prisma.shift.update({ where: { id: req.params.id }, data });
    await logAudit("UPDATE", "Shift", shift.id, req.user.id);
    res.json(shift);
  } catch (error) {
    next(error);
  }
});

router.get("/assignments", authenticate, async (req, res, next) => {
  try {
    const { employeeId, date } = req.query;
    const where: any = {};
    if (employeeId) where.employeeId = String(employeeId);
    if (date) {
      const start = new Date(String(date));
      start.setHours(0,0,0,0);
      const end = new Date(String(date));
      end.setHours(23,59,59,999);
      where.date = { gte: start, lte: end };
    }

    const assignments = await prisma.shiftAssignment.findMany({
      where,
      include: { employee: true, shift: true },
      orderBy: { date: 'asc' }
    });
    res.json(assignments);
  } catch (error) {
    next(error);
  }
});

router.post("/assignments", authenticate, authorize(["ADMIN", "RECEPTIONIST"]), async (req: any, res, next) => {
  try {
    const data = assignmentSchema.parse(req.body);
    const assignment = await prisma.shiftAssignment.create({ 
      data: { 
        date: data.date,
        endDate: data.endDate,
        employee: { connect: { id: data.employeeId } },
        shift: { connect: { id: data.shiftId } }
      } 
    });
    await logAudit("CREATE", "ShiftAssignment", assignment.id, req.user.id);
    res.status(201).json(assignment);
  } catch (error) {
    next(error);
  }
});

export default router;

async function nextShiftCode() {
  const last = await prisma.shift.findFirst({
    where: { shiftCode: { not: null } },
    orderBy: { shiftCode: "desc" },
    select: { shiftCode: true },
  });
  const next = Number(last?.shiftCode?.replace("TUR-", "") || "0") + 1;
  return `TUR-${String(next).padStart(6, "0")}`;
}
