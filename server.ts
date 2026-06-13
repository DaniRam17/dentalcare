import express from "express";
import cors from "cors";
import morgan from "morgan";
import { createServer as createViteServer } from "vite";
import path from "path";
import { errorHandler } from "./src/middlewares/errorHandler";

// Routes
import authRoutes from "./src/routes/auth.routes";
import patientRoutes from "./src/routes/patient.routes";
import appointmentRoutes from "./src/routes/appointment.routes";
import employeeRoutes from "./src/routes/employee.routes";
import procedureRoutes from "./src/routes/procedure.routes";
import prescriptionRoutes from "./src/routes/prescription.routes";
import shiftRoutes from "./src/routes/shift.routes";
import reportRoutes from "./src/routes/report.routes";
import designRoutes from "./src/routes/design.routes";
import integratedRoutes from "./src/routes/integrated.routes";

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT || 3000);

  app.use(cors());
  app.use(morgan("dev"));
  app.use(express.json());

  // API Routes
  app.use("/api/auth", authRoutes);
  app.use("/api/patients", patientRoutes);
  app.use("/api/appointments", appointmentRoutes);
  app.use("/api/employees", employeeRoutes);
  app.use("/api/procedures", procedureRoutes);
  app.use("/api/prescriptions", prescriptionRoutes);
  app.use("/api/shifts", shiftRoutes);
  app.use("/api/reports", reportRoutes);
  app.use("/api", integratedRoutes);
  app.use("/api/design", designRoutes);
  app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date() });
  });

  // Global Error Handler
  app.use(errorHandler);

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.VITE_HMR_PORT ? { port: Number(process.env.VITE_HMR_PORT) } : undefined,
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
