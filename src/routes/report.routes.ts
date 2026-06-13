import { Router } from "express";
import prisma from "../lib/prisma";
import { authenticate, authorize } from "../middlewares/auth";

const router = Router();

router.get("/productivity", authenticate, authorize(["ADMIN"]), async (req, res, next) => {
  try {
    const productivity = await prisma.$queryRaw`
      SELECT e.id, e."lastName", COUNT(a.id)::int as total_citas
      FROM "Employee" e
      JOIN "Appointment" a ON e.id = a."doctorId"
      WHERE a.status = 'ATTENDED'
      GROUP BY e.id, e."lastName"
    `;
    res.json(productivity);
  } catch (error) {
    next(error);
  }
});

export default router;
