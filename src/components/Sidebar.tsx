import React from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  Activity,
  Archive,
  Bell,
  Calendar,
  ClipboardList,
  Clock,
  CreditCard,
  FileCheck,
  FileText,
  History,
  LayoutDashboard,
  LogOut,
  Package,
  ShieldCheck,
  Stethoscope,
  UserCog,
  Users,
} from "lucide-react";

export const Sidebar: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const menuItems = [
    { icon: LayoutDashboard, label: "Dashboard", path: "/", roles: ["ADMIN", "DOCTOR", "RECEPTIONIST"] },
    { icon: Users, label: "Pacientes", path: "/patients", roles: ["ADMIN", "DOCTOR", "RECEPTIONIST"] },
    { icon: Calendar, label: "Agenda", path: "/appointments", roles: ["ADMIN", "DOCTOR", "RECEPTIONIST"] },
    { icon: FileText, label: "Recetas", path: "/prescriptions", roles: ["ADMIN", "DOCTOR"] },
    { icon: Activity, label: "Procedimientos", path: "/procedures", roles: ["ADMIN", "DOCTOR"] },
    { icon: UserCog, label: "Empleados", path: "/employees", roles: ["ADMIN"] },
    { icon: Clock, label: "Turnos", path: "/shifts", roles: ["ADMIN", "RECEPTIONIST"] },
    { icon: History, label: "Historial Clinico", path: "/clinical-history", roles: ["ADMIN", "DOCTOR", "RECEPTIONIST"] },
    { icon: Archive, label: "Archivos Clinicos", path: "/clinical-files", roles: ["ADMIN", "DOCTOR", "RECEPTIONIST"] },
    { icon: FileText, label: "Facturacion", path: "/billing", roles: ["ADMIN", "RECEPTIONIST"] },
    { icon: FileText, label: "Notas Credito/Debito", path: "/credit-debit-notes", roles: ["ADMIN", "RECEPTIONIST"] },
    { icon: ShieldCheck, label: "CAI / Rangos SAR", path: "/billing/settings", roles: ["ADMIN"] },
    { icon: CreditCard, label: "Pagos", path: "/payments", roles: ["ADMIN", "RECEPTIONIST"] },
    { icon: Package, label: "Inventario", path: "/inventory", roles: ["ADMIN", "DOCTOR", "NURSE"] },
    { icon: FileCheck, label: "Consentimientos", path: "/consents", roles: ["ADMIN", "DOCTOR", "RECEPTIONIST"] },
    { icon: ShieldCheck, label: "Auditoria", path: "/audit", roles: ["ADMIN"] },
    { icon: ClipboardList, label: "Reportes", path: "/reports", roles: ["ADMIN"] },
    { icon: Bell, label: "Notificaciones", path: "/notifications", roles: ["ADMIN", "DOCTOR", "RECEPTIONIST", "NURSE"] },
    { icon: Stethoscope, label: "Especialidades", path: "/specialties", roles: ["ADMIN", "DOCTOR"] },
  ];

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <aside className="w-64 bg-white border-r border-zinc-200 flex flex-col h-screen sticky top-0">
      <div className="p-6 flex items-center gap-3">
        <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-200">
          <ShieldCheck className="text-white w-6 h-6" />
        </div>
        <span className="font-bold text-zinc-900 text-lg tracking-tight">DentalCare</span>
      </div>

      <nav className="flex-1 px-4 space-y-1 mt-4 overflow-y-auto pb-4">
        {menuItems.filter((item) => item.roles.includes(user?.role || "")).map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) => `
              flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all
              ${isActive
                ? "bg-emerald-50 text-emerald-700 shadow-sm"
                : "text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900"}
            `}
          >
            <item.icon className="w-5 h-5" />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-zinc-100">
        <div className="bg-zinc-50 rounded-2xl p-4 mb-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-xs">
              {user?.firstName[0]}{user?.lastName[0]}
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-bold text-zinc-900 truncate">{user?.firstName} {user?.lastName}</p>
              <p className="text-[10px] text-zinc-400 uppercase tracking-widest font-bold">{user?.role}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 py-2 text-xs font-bold text-zinc-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
          >
            <LogOut className="w-3 h-3" /> Cerrar Sesion
          </button>
        </div>
      </div>
    </aside>
  );
};
