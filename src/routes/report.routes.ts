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

router.get("/dashboard", authenticate, authorize(["ADMIN"]), async (req, res, next) => {
  try {
    const today = new Date();
    const month = Number(req.query.month || today.getMonth() + 1);
    const year = Number(req.query.year || today.getFullYear());
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);
    const startOfMonth = new Date(year, month - 1, 1);
    const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999);
    const fiscalLimit = new Date(today);
    fiscalLimit.setDate(fiscalLimit.getDate() + 15);
    const [patientsTotal, patientsMonth, appointmentsMonth, proceduresMonth, pendingBilling, fiscalAlerts, revenueMonth, productivity, recentProcedures, audit] = await Promise.all([
      prisma.patient.count({ where: { isActive: true } }),
      prisma.patient.count({ where: { isActive: true, createdAt: { gte: startOfMonth, lte: endOfMonth } } }),
      prisma.appointment.count({ where: { date: { gte: startOfMonth, lte: endOfMonth }, status: { notIn: ["CANCELLED", "NO_SHOW"] } } }),
      prisma.clinicalHistoryProcedure.count({ where: { performedAt: { gte: startOfMonth, lte: endOfMonth }, billingStatus: { not: "CANCELLED" } } }),
      prisma.clinicalHistoryProcedure.count({ where: { billingStatus: "PENDING" } }),
      prisma.fiscalDocumentRange.count({ where: { status: "ACTIVE", emissionDeadline: { lte: fiscalLimit } } }),
      prisma.invoice.aggregate({ where: { issueDate: { gte: startOfMonth, lte: endOfMonth } }, _sum: { total: true } }),
      prisma.clinicalHistoryProcedure.groupBy({
        by: ["performedById"],
        where: { performedAt: { gte: startOfMonth, lte: endOfMonth }, billingStatus: { not: "CANCELLED" } },
        _count: true,
        _sum: { price: true },
      }),
      prisma.clinicalHistoryProcedure.findMany({
        where: { performedAt: { gte: startOfMonth, lte: endOfMonth } },
        include: { patient: true, procedureType: true },
        orderBy: { performedAt: "desc" },
        take: 8,
      }),
      prisma.auditLog.findMany({ include: { user: true }, orderBy: { timestamp: "desc" }, take: 5 }),
    ]);
    const doctors = await prisma.employee.findMany({ where: { id: { in: productivity.map((item) => item.performedById).filter(Boolean) as string[] } } });
    const totalProcedures = productivity.reduce((sum, item) => sum + item._count, 0);
    res.json({
      period: { month, year },
      cards: {
        patientsTotal,
        patientsMonth,
        appointmentsMonth,
        proceduresMonth,
        pendingBilling,
        fiscalAlerts,
        revenueMonth: revenueMonth._sum.total || 0,
      },
      productivity: productivity.map((item) => {
        const doctor = doctors.find((entry) => entry.id === item.performedById);
        return {
          doctor: doctor ? `Dr. ${doctor.firstName} ${doctor.lastName}` : "Sin asignar",
          count: item._count,
          amount: item._sum.price || 0,
          percent: totalProcedures ? Number(((item._count / totalProcedures) * 100).toFixed(1)) : 0,
        };
      }),
      recentProcedures: recentProcedures.map((item) => ({
        id: item.id,
        date: item.performedAt,
        patient: `${item.patient.firstName} ${item.patient.lastName}`,
        doctor: doctors.find((entry) => entry.id === item.performedById) ? `Dr. ${doctors.find((entry) => entry.id === item.performedById)?.lastName}` : "Sin asignar",
        procedureCode: item.procedureCode,
        procedureName: item.procedureName,
        billingStatus: item.billingStatus,
        price: item.price,
      })),
      audit,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
