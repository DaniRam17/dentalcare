import { Router } from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import prisma from "../lib/prisma";
import { authenticate } from "../middlewares/auth";

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || "super-secret-key";

router.post("/login", async (req, res, next) => {
  try {
    const { email, password } = req.body;
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
      JWT_SECRET, 
      { expiresIn: "8h" }
    );

    res.json({ 
      token, 
      user: { 
        id: employee.id, 
        firstName: employee.firstName, 
        lastName: employee.lastName, 
        role: employee.role 
      } 
    });
  } catch (error) {
    next(error);
  }
});

router.get("/me", authenticate, (req: any, res) => {
  res.json(req.user);
});

export default router;
