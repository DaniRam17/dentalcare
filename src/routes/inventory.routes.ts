import { Router } from "express";
import prisma from "../lib/prisma";
import { authenticate, authorize } from "../middlewares/auth";
import { logAudit } from "../services/auditService";
import { z } from "zod";

const router = Router();

const audit = (req: any, action: string, entity: string, id: string, beforeData?: unknown, afterData?: unknown) =>
  logAudit(action, entity, id, req.user?.id, undefined, beforeData, afterData, req.ip);

router.get("/", authenticate, async (_req, res, next) => {
  try {
    const items = await prisma.inventoryItem.findMany({
      where: { isActive: true },
      include: {
        movements: { orderBy: { movementDate: "desc" }, take: 8 },
        procedures: { include: { procedureType: true } },
      },
      orderBy: { name: "asc" },
    });
    res.json(items);
  } catch (error) {
    next(error);
  }
});

router.post("/", authenticate, authorize(["ADMIN"]), async (req: any, res, next) => {
  try {
    const body = z.object({
      name: z.string().min(2),
      description: z.string().optional().nullable(),
      quantityAvailable: z.number().int().default(0),
      minimumStock: z.number().int().default(0),
      unitOfMeasure: z.string().min(1),
      unitPrice: z.number().nonnegative().default(0),
      taxable: z.boolean().default(true),
    }).parse(req.body);
    const inventoryCode = await nextInventoryCode();
    const item = await prisma.inventoryItem.create({ data: { ...body, inventoryCode } });
    await audit(req, "CREATE", "InventoryItem", item.id, undefined, item);
    res.status(201).json(item);
  } catch (error) {
    next(error);
  }
});

router.put("/:id", authenticate, authorize(["ADMIN"]), async (req: any, res, next) => {
  try {
    const before = await prisma.inventoryItem.findUniqueOrThrow({ where: { id: req.params.id } });
    const body = z.object({
      name: z.string().min(2).optional(),
      description: z.string().optional().nullable(),
      quantityAvailable: z.number().int().nonnegative().optional(),
      minimumStock: z.number().int().nonnegative().optional(),
      unitOfMeasure: z.string().min(1).optional(),
      unitPrice: z.number().nonnegative().optional(),
      taxable: z.boolean().optional(),
    }).parse(req.body);
    const item = await prisma.inventoryItem.update({ where: { id: req.params.id }, data: body });
    await audit(req, "UPDATE", "InventoryItem", item.id, before, item);
    res.json(item);
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", authenticate, authorize(["ADMIN"]), async (req: any, res, next) => {
  try {
    const before = await prisma.inventoryItem.findUniqueOrThrow({ where: { id: req.params.id } });
    const item = await prisma.inventoryItem.update({ where: { id: req.params.id }, data: { isActive: false } });
    await audit(req, "DELETE", "InventoryItem", item.id, before, item);
    res.json({ message: "Insumo inactivado", item });
  } catch (error) {
    next(error);
  }
});

router.post("/:id/movements", authenticate, authorize(["ADMIN", "DOCTOR"]), async (req: any, res, next) => {
  try {
    const body = z.object({
      movementType: z.enum(["IN", "OUT", "ADJUST"]),
      quantity: z.number().int().positive(),
      reason: z.string().optional().nullable(),
      reference: z.string().optional().nullable(),
      observations: z.string().optional().nullable(),
    }).parse(req.body);
    const result = await prisma.$transaction(async (tx) => {
      const item = await tx.inventoryItem.findUniqueOrThrow({ where: { id: req.params.id } });
      const nextQuantity = body.movementType === "IN" ? item.quantityAvailable + body.quantity : body.movementType === "OUT" ? item.quantityAvailable - body.quantity : body.quantity;
      if (nextQuantity < 0) throw new Error("Stock insuficiente");
      const movement = await tx.inventoryMovement.create({ data: { inventoryItemId: item.id, ...body, stockBefore: item.quantityAvailable, stockAfter: nextQuantity, userId: req.user?.id } });
      const updated = await tx.inventoryItem.update({ where: { id: item.id }, data: { quantityAvailable: nextQuantity } });
      if (updated.quantityAvailable <= updated.minimumStock) {
        await tx.notification.create({ data: { type: "INVENTORY_ALERT", message: `Stock bajo: ${updated.name}`, status: "PENDING" } });
      }
      return { movement, updated };
    });
    await audit(req, "CREATE", "InventoryMovement", result.movement.id, undefined, result);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

async function nextInventoryCode() {
  const last = await prisma.inventoryItem.findFirst({
    where: { inventoryCode: { not: null } },
    orderBy: { inventoryCode: "desc" },
    select: { inventoryCode: true },
  });
  const next = Number(last?.inventoryCode?.replace("INV-", "") || "0") + 1;
  return `INV-${String(next).padStart(6, "0")}`;
}

export default router;
