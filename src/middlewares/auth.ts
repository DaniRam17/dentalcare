import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import prisma from "../lib/prisma";

const JWT_SECRET = process.env.JWT_SECRET || "super-secret-key";

export const authenticate = async (req: any, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: "No token provided" });

  const token = authHeader.split(" ")[1];
  try {
    const decoded: any = jwt.verify(token, JWT_SECRET);
    const user = await prisma.employee.findUnique({ where: { id: decoded.id } });
    
    if (!user || !user.isActive) {
      return res.status(401).json({ error: "User not found or inactive" });
    }

    req.user = {
      id: user.id,
      role: user.role,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName
    };
    next();
  } catch (err) {
    res.status(401).json({ error: "Invalid token" });
  }
};

export const authorize = (roles: string[]) => (req: any, res: Response, next: NextFunction) => {
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ error: "Forbidden: Insufficient permissions" });
  }
  next();
};
