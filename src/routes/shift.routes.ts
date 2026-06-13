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
});

const assignmentSchema = z.object({
  date: z.string().transform(val => new Date(val)),
  employeeId: z.string().uuid(),
  shiftId: z.string().uuid(),
});

router.get("/", authenticate, async (req, res, next) => {
  try {
    const shifts = await prisma.shift.findMany({ where: { isActive: true } });
    res.json(shifts);
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
