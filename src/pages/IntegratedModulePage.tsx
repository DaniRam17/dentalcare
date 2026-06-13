import React, { useEffect, useMemo, useState } from "react";
import { apiClient } from "../lib/apiClient";
import {
  Archive,
  Bell,
  ClipboardList,
  CreditCard,
  FileCheck,
  FileText,
  History,
  Package,
  Plus,
  Search,
  ShieldCheck,
  Stethoscope,
  Trash2,
  Upload,
  X,
} from "lucide-react";

type ModuleKey =
  | "clinical-history"
  | "clinical-files"
  | "billing"
  | "payments"
  | "inventory"
  | "consents"
  | "audit"
  | "reports"
  | "notifications"
  | "specialties";

const moduleMeta: Record<ModuleKey, { title: string; description: string; icon: any; endpoint: string; canCreate?: boolean }> = {
  "clinical-history": { title: "Historial Clinico", description: "Diagnosticos, tratamientos y observaciones cronologicas", icon: History, endpoint: "/clinical-history", canCreate: true },
  "clinical-files": { title: "Archivos Clinicos", description: "Documentos PDF, imagenes y radiografias por paciente", icon: Archive, endpoint: "/clinical-files", canCreate: true },
  billing: { title: "Facturacion", description: "Facturas reales con subtotal, impuesto, total y estado", icon: FileText, endpoint: "/billing", canCreate: true },
  payments: { title: "Pagos", description: "Pagos parciales y aplicacion a facturas", icon: CreditCard, endpoint: "/payments", canCreate: true },
  inventory: { title: "Inventario", description: "Insumos, movimientos, stock minimo y alertas", icon: Package, endpoint: "/inventory", canCreate: true },
  consents: { title: "Consentimientos", description: "Consentimientos informados vinculados a pacientes y procedimientos", icon: FileCheck, endpoint: "/consents", canCreate: true },
  audit: { title: "Auditoria", description: "Bitacora de acciones del sistema", icon: ShieldCheck, endpoint: "/audit" },
  reports: { title: "Reportes", description: "Indicadores financieros, citas, inventario y productividad", icon: ClipboardList, endpoint: "/real-reports" },
  notifications: { title: "Notificaciones", description: "Recordatorios de citas, alertas de inventario y eventos importantes", icon: Bell, endpoint: "/notifications", canCreate: true },
  specialties: { title: "Especialidades", description: "Catalogo y asignacion de odontologos", icon: Stethoscope, endpoint: "/specialties", canCreate: true },
};

const emptyForms: Record<ModuleKey, any> = {
  "clinical-history": { patientId: "", odontologistId: "", diagnosis: "", treatmentPerformed: "", observations: "", date: new Date().toISOString().slice(0, 10) },
  "clinical-files": { patientId: "", file: null },
  billing: { patientId: "", procedureLogIds: "", taxRate: 0.15 },
  payments: { invoiceId: "", amount: 0, paymentMethod: "Efectivo" },
  inventory: { name: "", description: "", quantityAvailable: 0, minimumStock: 0, unitOfMeasure: "unidad" },
  consents: { patientId: "", procedureLogId: "", description: "", documentUrl: "", status: "SIGNED" },
  audit: {},
  reports: {},
  notifications: { type: "REMINDER", message: "", appointmentId: "", status: "PENDING" },
  specialties: { name: "", description: "", doctorIds: "" },
};

export const IntegratedModulePage: React.FC<{ moduleKey: ModuleKey }> = ({ moduleKey }) => {
  const meta = moduleMeta[moduleKey];
  const Icon = meta.icon;
  const [items, setItems] = useState<any[]>([]);
  const [report, setReport] = useState<any>(null);
  const [lookups, setLookups] = useState<any>({ patients: [], doctors: [], procedureTypes: [], inventoryItems: [], invoices: [] });
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<any>(emptyForms[moduleKey]);
  const [error, setError] = useState("");

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const [data, lookupData] = await Promise.all([
        apiClient.get(`${meta.endpoint}${moduleKey === "clinical-history" && search ? `?search=${encodeURIComponent(search)}` : ""}`),
        apiClient.get("/lookups"),
      ]);
      if (moduleKey === "reports") {
        setReport(data);
        setItems([]);
      } else {
        setItems(Array.isArray(data) ? data : []);
      }
      setLookups(lookupData);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(loadData, 250);
    return () => clearTimeout(timer);
  }, [moduleKey, search]);

  useEffect(() => {
    setForm(emptyForms[moduleKey]);
    setSearch("");
    setError("");
  }, [moduleKey]);

  const filteredItems = useMemo(() => {
    if (moduleKey === "clinical-history") return items;
    const term = search.toLowerCase();
    return items.filter((item) => JSON.stringify(item).toLowerCase().includes(term));
  }, [items, search, moduleKey]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    try {
      if (moduleKey === "clinical-files") {
        if (!form.file || !form.patientId) throw new Error("Selecciona paciente y archivo");
        const body = new FormData();
        body.append("patientId", form.patientId);
        body.append("file", form.file);
        await apiClient.post("/clinical-files", body);
      } else if (moduleKey === "billing") {
        await apiClient.post(meta.endpoint, { ...form, procedureLogIds: splitIds(form.procedureLogIds), taxRate: Number(form.taxRate) });
      } else if (moduleKey === "specialties") {
        await apiClient.post(meta.endpoint, { ...form, doctorIds: splitIds(form.doctorIds) });
      } else if (moduleKey === "payments") {
        await apiClient.post(meta.endpoint, { ...form, amount: Number(form.amount) });
      } else if (moduleKey === "inventory") {
        await apiClient.post(meta.endpoint, { ...form, quantityAvailable: Number(form.quantityAvailable), minimumStock: Number(form.minimumStock) });
      } else {
        await apiClient.post(meta.endpoint, normalizePayload(form));
      }
      setModalOpen(false);
      setForm(emptyForms[moduleKey]);
      loadData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const removeFile = async (id: string) => {
    if (!confirm("Eliminar archivo clinico?")) return;
    await apiClient.delete(`/clinical-files/${id}`);
    loadData();
  };

  const createMovement = async (id: string, movementType: "IN" | "OUT" | "ADJUST") => {
    const quantity = Number(prompt("Cantidad") || "0");
    if (!quantity) return;
    await apiClient.post(`/inventory/${id}/movements`, { movementType, quantity, reason: movementType === "IN" ? "Entrada manual" : movementType === "OUT" ? "Salida manual" : "Ajuste manual" });
    loadData();
  };

  return (
    <div className="p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 flex items-center gap-2">
            <Icon className="text-emerald-600" /> {meta.title}
          </h1>
          <p className="text-zinc-500">{meta.description}</p>
        </div>
        {meta.canCreate && (
          <button onClick={() => setModalOpen(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg flex items-center justify-center gap-2 transition-all shadow-sm">
            <Plus className="w-4 h-4" /> Nuevo
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-zinc-200 overflow-hidden">
        <div className="p-4 border-b border-zinc-100 bg-zinc-50/50 flex items-center gap-3">
          <div className="relative max-w-md w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input className="w-full pl-10 pr-4 py-2 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none" placeholder="Buscar..." value={search} onChange={(event) => setSearch(event.target.value)} />
          </div>
          {error && <span className="text-sm text-red-600">{error}</span>}
        </div>

        {moduleKey === "reports" ? (
          <ReportsView report={report} loading={loading} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-zinc-50 text-zinc-500 text-xs uppercase tracking-wider font-semibold">
                  {headersFor(moduleKey).map((header) => <th key={header} className="px-6 py-4">{header}</th>)}
                  <th className="px-6 py-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {loading ? (
                  <tr><td colSpan={6} className="px-6 py-8 text-center text-zinc-400">Cargando...</td></tr>
                ) : filteredItems.length === 0 ? (
                  <tr><td colSpan={6} className="px-6 py-8 text-center text-zinc-400">Sin registros</td></tr>
                ) : filteredItems.map((item) => (
                  <tr key={item.id} className="hover:bg-zinc-50">
                    {cellsFor(moduleKey, item).map((cell, index) => <td key={index} className="px-6 py-4 text-sm text-zinc-700">{cell}</td>)}
                    <td className="px-6 py-4 text-right">
                      {moduleKey === "clinical-files" && (
                        <div className="flex justify-end gap-2">
                          <a className="px-3 py-1 text-xs rounded-lg bg-zinc-100 text-zinc-700 hover:bg-zinc-200" href={item.fileUrl} target="_blank">Descargar</a>
                          <button onClick={() => removeFile(item.id)} className="p-2 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      )}
                      {moduleKey === "inventory" && (
                        <div className="flex justify-end gap-2">
                          <button onClick={() => createMovement(item.id, "IN")} className="px-2 py-1 text-xs bg-emerald-50 text-emerald-700 rounded">Entrada</button>
                          <button onClick={() => createMovement(item.id, "OUT")} className="px-2 py-1 text-xs bg-red-50 text-red-700 rounded">Salida</button>
                          <button onClick={() => createMovement(item.id, "ADJUST")} className="px-2 py-1 text-xs bg-zinc-100 text-zinc-700 rounded">Ajuste</button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-xl overflow-hidden">
            <div className="p-6 border-b border-zinc-100 flex justify-between items-center bg-zinc-50">
              <h2 className="text-xl font-bold text-zinc-900">Nuevo registro</h2>
              <button onClick={() => setModalOpen(false)} className="text-zinc-400 hover:text-zinc-600"><X className="w-6 h-6" /></button>
            </div>
            <form onSubmit={submit} className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              <ModuleForm moduleKey={moduleKey} form={form} setForm={setForm} lookups={lookups} />
              <div className="md:col-span-2 flex justify-end gap-3 mt-4">
                <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 text-zinc-600 hover:bg-zinc-100 rounded-lg">Cancelar</button>
                <button type="submit" className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-bold">Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

function ModuleForm({ moduleKey, form, setForm, lookups }: any) {
  const input = (name: string, label: string, type = "text") => (
    <Field label={label}>
      <input required={["name", "diagnosis", "amount", "message"].includes(name)} type={type} className="w-full p-2 border rounded-lg" value={form[name] ?? ""} onChange={(event) => setForm({ ...form, [name]: type === "number" ? Number(event.target.value) : event.target.value })} />
    </Field>
  );
  const textarea = (name: string, label: string) => (
    <Field label={label}><textarea className="w-full p-2 border rounded-lg min-h-24" value={form[name] ?? ""} onChange={(event) => setForm({ ...form, [name]: event.target.value })} /></Field>
  );
  const patientSelect = <SelectField label="Paciente" value={form.patientId} onChange={(value) => setForm({ ...form, patientId: value })} options={lookups.patients.map((p: any) => ({ value: p.id, label: `${p.firstName} ${p.lastName} - ${p.documentNumber}` }))} />;
  const doctorSelect = <SelectField label="Odontologo" value={form.odontologistId || ""} onChange={(value) => setForm({ ...form, odontologistId: value })} options={lookups.doctors.map((d: any) => ({ value: d.id, label: `Dr. ${d.firstName} ${d.lastName}` }))} required={false} />;
  const invoiceSelect = <SelectField label="Factura" value={form.invoiceId || ""} onChange={(value) => setForm({ ...form, invoiceId: value })} options={lookups.invoices.map((i: any) => ({ value: i.id, label: `${i.invoiceNumber} - ${i.patient.firstName} ${i.patient.lastName} - $${i.total}` }))} />;

  if (moduleKey === "clinical-history") return <>{patientSelect}{doctorSelect}{input("date", "Fecha", "date")}{textarea("diagnosis", "Diagnostico")}{textarea("treatmentPerformed", "Tratamiento")}{textarea("observations", "Observaciones")}</>;
  if (moduleKey === "clinical-files") return <>{patientSelect}<Field label="Archivo PDF/JPG/PNG"><input required type="file" accept=".pdf,.jpg,.jpeg,.png" className="w-full p-2 border rounded-lg" onChange={(event) => setForm({ ...form, file: event.target.files?.[0] })} /></Field><div className="md:col-span-2 text-sm text-zinc-500 flex gap-2"><Upload className="w-4 h-4" /> El archivo se guarda en almacenamiento local y la metadata en Prisma.</div></>;
  if (moduleKey === "billing") return <>{patientSelect}{input("taxRate", "Impuesto", "number")}<Field label="IDs de procedimientos realizados"><input className="w-full p-2 border rounded-lg" value={form.procedureLogIds} onChange={(event) => setForm({ ...form, procedureLogIds: event.target.value })} placeholder="Separados por coma" /></Field></>;
  if (moduleKey === "payments") return <>{invoiceSelect}{input("amount", "Monto", "number")}{input("paymentMethod", "Metodo de pago")}</>;
  if (moduleKey === "inventory") return <>{input("name", "Insumo")}{input("unitOfMeasure", "Unidad")}{input("quantityAvailable", "Stock inicial", "number")}{input("minimumStock", "Stock minimo", "number")}{textarea("description", "Descripcion")}</>;
  if (moduleKey === "consents") return <>{patientSelect}{textarea("description", "Descripcion")}{input("documentUrl", "URL del PDF firmado")}</>;
  if (moduleKey === "notifications") return <>{input("type", "Tipo")}{textarea("message", "Mensaje")}</>;
  if (moduleKey === "specialties") return <>{input("name", "Especialidad")}{textarea("description", "Descripcion")}<Field label="Odontologos"><input className="w-full p-2 border rounded-lg" value={form.doctorIds} onChange={(event) => setForm({ ...form, doctorIds: event.target.value })} placeholder="IDs separados por coma" /></Field></>;
  return null;
}

function Field({ label, children }: any) {
  return <div className="space-y-1"><label className="text-sm font-medium text-zinc-700">{label}</label>{children}</div>;
}

function SelectField({ label, value, onChange, options, required = true }: any) {
  return (
    <Field label={label}>
      <select required={required} className="w-full p-2 border rounded-lg" value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">Seleccionar...</option>
        {options.map((option: any) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </Field>
  );
}

function ReportsView({ report, loading }: any) {
  if (loading) return <div className="px-6 py-10 text-center text-zinc-400">Cargando reportes...</div>;
  if (!report) return <div className="px-6 py-10 text-center text-zinc-400">Sin datos</div>;
  const cards = [
    ["Facturas", report.revenue?._count || 0],
    ["Ingresos", `$${Number(report.revenue?._sum?.total || 0).toFixed(2)}`],
    ["Alertas inventario", report.inventory?.length || 0],
    ["Odontologos productivos", report.productivity?.length || 0],
  ];
  return <div className="p-6 grid grid-cols-1 md:grid-cols-4 gap-4">{cards.map(([label, value]) => <div key={label} className="border border-zinc-200 rounded-xl p-5"><p className="text-sm text-zinc-500">{label}</p><p className="text-2xl font-bold text-zinc-900 mt-1">{value}</p></div>)}</div>;
}

function headersFor(moduleKey: ModuleKey) {
  const map: Record<ModuleKey, string[]> = {
    "clinical-history": ["Fecha", "Paciente", "Odontologo", "Diagnostico", "Tratamiento"],
    "clinical-files": ["Fecha", "Paciente", "Archivo", "Tipo"],
    billing: ["Factura", "Paciente", "Subtotal", "Impuesto", "Total", "Estado"],
    payments: ["Fecha", "Factura", "Paciente", "Monto", "Metodo"],
    inventory: ["Insumo", "Stock", "Minimo", "Unidad"],
    consents: ["Fecha", "Paciente", "Procedimiento", "Estado"],
    audit: ["Fecha", "Usuario", "Accion", "Entidad", "IP"],
    reports: [],
    notifications: ["Fecha", "Tipo", "Mensaje", "Estado"],
    specialties: ["Especialidad", "Descripcion", "Odontologos"],
  };
  return map[moduleKey];
}

function cellsFor(moduleKey: ModuleKey, item: any) {
  const patient = item.patient ? `${item.patient.firstName} ${item.patient.lastName}` : "";
  const doctor = item.odontologist ? `Dr. ${item.odontologist.firstName} ${item.odontologist.lastName}` : "";
  const invoicePatient = item.invoice?.patient ? `${item.invoice.patient.firstName} ${item.invoice.patient.lastName}` : "";
  const map: Record<ModuleKey, any[]> = {
    "clinical-history": [formatDate(item.date), patient, doctor || "No asignado", item.diagnosis, item.treatmentPerformed || "-"],
    "clinical-files": [formatDate(item.uploadedAt), patient, item.fileName, item.fileType],
    billing: [item.invoiceNumber, patient, money(item.subtotal), money(item.tax), money(item.total), item.status],
    payments: [formatDate(item.paymentDate), item.invoice?.invoiceNumber, invoicePatient, money(item.amount), item.paymentMethod],
    inventory: [item.name, item.quantityAvailable <= item.minimumStock ? `${item.quantityAvailable} (bajo)` : item.quantityAvailable, item.minimumStock, item.unitOfMeasure],
    consents: [formatDate(item.signedAt), patient, item.procedureLog?.procedureType?.name || "-", item.status],
    audit: [formatDate(item.timestamp), item.user ? `${item.user.firstName} ${item.user.lastName}` : "Sistema", item.action, item.entity, item.ipAddress || "-"],
    reports: [],
    notifications: [formatDate(item.createdAt), item.type, item.message, item.status],
    specialties: [item.name, item.description || "-", item.doctors?.map((d: any) => `Dr. ${d.lastName}`).join(", ") || "-"],
  };
  return map[moduleKey];
}

function splitIds(value: string) {
  return String(value || "").split(",").map((id) => id.trim()).filter(Boolean);
}

function normalizePayload(payload: any) {
  return Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== ""));
}

function formatDate(value: string) {
  return value ? new Date(value).toLocaleDateString() : "-";
}

function money(value: number) {
  return `$${Number(value || 0).toFixed(2)}`;
}
