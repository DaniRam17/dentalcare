import { Router } from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import rateLimit from "express-rate-limit";
import prisma from "../lib/prisma";
import { authenticate } from "../middlewares/auth";
import { z } from "zod";

const router = Router();

const JWT_SECRET = process.env.JWT_SECRET;
const SECRET = JWT_SECRET || "dev-only-secret-change-in-production";

const loginSchema = z.object({
  email: z.string().email({ message: "Correo inválido" }),
  password: z.string().min(1, { message: "Contraseña requerida" }),
});

const registerSchema = z.object({
  firstName: z.string().min(2, { message: "Nombre muy corto" }),
  lastName: z.string().min(2, { message: "Apellido muy corto" }),
  documentId: z.string().min(1, { message: "Documento requerido" }),
  email: z.string().email({ message: "Correo inválido" }),
  password: z.string().min(6, { message: "Mínimo 6 caracteres" }),
  role: z.enum(["ADMIN", "DOCTOR", "RECEPTIONIST", "NURSE"], { message: "Rol inválido" }),
  phone: z.string().optional(),
  address: z.string().optional(),
});

// Max 10 intentos por IP cada 15 minutos
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: "Demasiados intentos de inicio de sesión. Espera 15 minutos." },
  standardHeaders: true,
  legacyHeaders: false,
});

// Max 5 registros por IP cada hora (evita spam)
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { error: "Demasiados intentos de registro. Espera una hora." },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post("/login", loginLimiter, async (req, res, next) => {
  try {
    const { email, password } = loginSchema.parse(req.body);

    const employee = await prisma.employee.findUnique({ where: { email } });

    if (!employee || !employee.isActive) {
      return res.status(401).json({ error: "Credenciales inválidas" });
    }

    const valid = await bcrypt.compare(password, employee.password);
    if (!valid) {
      return res.status(401).json({ error: "Credenciales inválidas" });
    }

    const token = jwt.sign(
      { id: employee.id, role: employee.role },
      SECRET,
      { expiresIn: "8h" }
    );

    res.json({
      token,
      user: {
        id: employee.id,
        firstName: employee.firstName,
        lastName: employee.lastName,
        role: employee.role,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.post("/register", registerLimiter, async (req, res, next) => {
  try {
    const data = registerSchema.parse(req.body);

    // Verificar si el correo ya existe
    const existing = await prisma.employee.findUnique({ where: { email: data.email } });
    if (existing) {
      return res.status(409).json({ error: "Ya existe una cuenta con ese correo electrónico" });
    }

    const hashedPassword = await bcrypt.hash(data.password, 10);

    const employee = await prisma.employee.create({
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        documentId: data.documentId,
        email: data.email,
        password: hashedPassword,
        role: data.role,
        phone: data.phone,
        address: data.address,
      },
    });

    const token = jwt.sign(
      { id: employee.id, role: employee.role },
      SECRET,
      { expiresIn: "8h" }
    );

    const { password, ...userWithoutPassword } = employee;

    res.status(201).json({
      message: "Cuenta creada exitosamente",
      token,
      user: {
        id: employee.id,
        firstName: employee.firstName,
        lastName: employee.lastName,
        role: employee.role,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.get("/me", authenticate, (req: any, res) => {
  res.json(req.user);
});

export default router;
