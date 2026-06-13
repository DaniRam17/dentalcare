import { Router } from "express";
import prisma from "../lib/prisma";
import { authenticate, authorize } from "../middlewares/auth";

const router = Router();

router.get("/productivity", authenticate, authorize(["ADMIN"]), async (req, res, next) => {
  try {
    const rows: any[] = await prisma.$queryRaw`
      SELECT e.id, e."lastName", COUNT(a.id)::int as total_citas
      FROM "Employee" e
      JOIN "Appointment" a ON e.id = a."doctorId"
      WHERE a.status = 'ATTENDED'
      GROUP BY e.id, e."lastName"
    `;
    res.json(rows.map((row) => ({ doctor: `Dr. ${row.lastName}`, count: row.total_citas })));
  } catch (error) {
    next(error);
  }
});

router.get("/dashboard", authenticate, authorize(["ADMIN"]), async (_req, res, next) => {
  try {
    const today = new Date();
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const fiscalLimit = new Date(today);
    fiscalLimit.setDate(fiscalLimit.getDate() + 15);
    const [patientsTotal, appointmentsToday, proceduresMonth, pendingBilling, fiscalAlerts, revenueMonth, productivity, audit] = await Promise.all([
      prisma.patient.count({ where: { isActive: true } }),
      prisma.appointment.count({ where: { date: { gte: startOfToday, lte: endOfToday }, status: { notIn: ["CANCELLED", "NO_SHOW"] } } }),
      prisma.procedureLog.count({ where: { date: { gte: startOfMonth }, status: { not: "CANCELLED" } } }),
      prisma.clinicalHistoryProcedure.count({ where: { billingStatus: "PENDING" } }),
      prisma.fiscalDocumentRange.count({ where: { status: "ACTIVE", emissionDeadline: { lte: fiscalLimit } } }),
      prisma.invoice.aggregate({ where: { issueDate: { gte: startOfMonth } }, _sum: { total: true } }),
      prisma.procedureLog.groupBy({ by: ["doctorId"], where: { date: { gte: startOfMonth } }, _count: true }),
      prisma.auditLog.findMany({ include: { user: true }, orderBy: { timestamp: "desc" }, take: 5 }),
    ]);
    const doctors = await prisma.employee.findMany({ where: { id: { in: productivity.map((item) => item.doctorId) } } });
    res.json({
      cards: {
        patientsTotal,
        appointmentsToday,
        proceduresMonth,
        pendingBilling,
        fiscalAlerts,
        revenueMonth: revenueMonth._sum.total || 0,
      },
      productivity: productivity.map((item) => {
        const doctor = doctors.find((entry) => entry.id === item.doctorId);
        return { doctor: doctor ? `Dr. ${doctor.lastName}` : "Sin asignar", count: item._count };
      }),
      audit,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
