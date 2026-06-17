import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";

export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  // Zod validation errors → 400 with field-level details
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: "Datos inválidos",
      fields: err.flatten().fieldErrors,
    });
  }

  // Prisma not-found errors → 404
  if (err.code === "P2025") {
    return res.status(404).json({ error: "Registro no encontrado" });
  }

  // Prisma unique constraint → 409
  if (err.code === "P2002") {
    const field = err.meta?.target?.[0] ?? "campo";
    return res.status(409).json({ error: `Ya existe un registro con ese ${field}` });
  }

  console.error(err.stack);

  const status = err.status || 500;
  const message = err.message || "Internal Server Error";

  res.status(status).json({
    error: message,
    stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
  });
};
