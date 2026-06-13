import prisma from "../lib/prisma";

export const logAudit = async (
  action: string,
  entity: string,
  entityId: string,
  userId?: string,
  details?: string,
  beforeData?: unknown,
  afterData?: unknown,
  ipAddress?: string
) => {
  try {
    await prisma.auditLog.create({
      data: {
        action,
        entity,
        entityId,
        userId,
        details,
        beforeData: beforeData ? JSON.stringify(beforeData) : undefined,
        afterData: afterData ? JSON.stringify(afterData) : undefined,
        ipAddress,
      },
    });
  } catch (error) {
    console.error("Audit Log Error:", error);
  }
};
