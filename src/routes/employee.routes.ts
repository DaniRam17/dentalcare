import { Router } from "express";
import prisma from "../lib/prisma";
import { authenticate, authorize } from "../middlewares/auth";
import { logAudit } from "../services/auditService";
import bcrypt from "bcryptjs";
import { z } from "zod";

const router = Router();

const employeeSchema = z.object({
  firstName: z.string().min(2),
  lastName: z.string().min(2),
  documentId: z.string(),
  email: z.string().email(),
  password: z.string().min(6).optional(),
  role: z.enum(["ADMIN", "DOCTOR", "RECEPTIONIST", "NURSE"]),
  phone: z.string().optional(),
  address: z.string().optional(),
  salary: z.number().optional(),
});

router.get("/", authenticate, authorize(["ADMIN"]), async (req, res, next) => {
  try {
    const { role, search, isActive } = req.query;
    const where: any = {};
    if (role) where.role = role;
    if (isActive !== undefined) where.isActive = isActive === 'true';
    if (search) {
      where.OR = [
        { firstName: { contains: String(search), mode: 'insensitive' } },
        { lastName: { contains: String(search), mode: 'insensitive' } },
        { email: { contains: String(search), mode: 'insensitive' } },
      ];
    }

    const employees = await prisma.employee.findMany({
      where,
      orderBy: { lastName: 'asc' }
    });
    res.json(employees.map(({ password, ...rest }) => rest));
  } catch (error) {
    next(error);
  }
});

router.post("/", authenticate, authorize(["ADMIN"]), async (req: any, res, next) => {
  try {
    const data = employeeSchema.parse(req.body);
    if (!data.password) return res.status(400).json({ error: "Password is required for new employees" });
    
    const hashedPassword = await bcrypt.hash(data.password, 10);
    const employee = await prisma.employee.create({
      data: { ...data, password: hashedPassword }
    });

    await logAudit("CREATE", "Employee", employee.id, req.user.id);
    const { password, ...rest } = employee;
    res.status(201).json(rest);
  } catch (error) {
    next(error);
  }
});

router.put("/:id", authenticate, authorize(["ADMIN"]), async (req: any, res, next) => {
  try {
    const { id } = req.params;
    const data = employeeSchema.partial().parse(req.body);
    
    if (data.password) {
      data.password = await bcrypt.hash(data.password, 10);
    }

    const employee = await prisma.employee.update({
      where: { id },
      data
    });

    await logAudit("UPDATE", "Employee", id, req.user.id);
    const { password, ...rest } = employee;
    res.json(rest);
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", authenticate, authorize(["ADMIN"]), async (req: any, res, next) => {
  try {
    const { id } = req.params;
    await prisma.employee.update({ where: { id }, data: { isActive: false } });
    await logAudit("SOFT_DELETE", "Employee", id, req.user.id);
    res.json({ message: "Empleado desactivado" });
  } catch (error) {
    next(error);
  }
});

export default router;
