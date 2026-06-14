import React, { useEffect, useMemo, useState } from "react";
import { apiClient } from "../lib/apiClient";
import { DetailModal } from "../components/integrated/DetailModal";
import { Field } from "../components/integrated/FormControls";
import { ModuleForm } from "../components/integrated/ModuleForm";
import {
  Archive,
  Ban,
  Bell,
  ClipboardList,
  CreditCard,
  Download,
  Eye,
  FileCheck,
  FileText,
  History,
  Package,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  Stethoscope,
  Trash2,
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
  | "specialties"
  | "fiscal-ranges"
  | "credit-debit-notes";

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
  "fiscal-ranges": { title: "Configuracion CAI y Rangos SAR", description: "Rangos fiscales autorizados para facturacion Honduras", icon: ShieldCheck, endpoint: "/fiscal-ranges", canCreate: true },
  "credit-debit-notes": { title: "Notas Credito / Debito", description: "Documentos fiscales ligados a facturas para reversos y ajustes", icon: FileText, endpoint: "/credit-debit-notes", canCreate: true },
};

const emptyForms: Record<ModuleKey, any> = {
  "clinical-history": { patientId: "", odontologistId: "", reason: "", diagnosis: "", treatmentPerformed: "", observations: "", procedureTypeIds: [] as string[], date: new Date().toISOString().slice(0, 10) },
  "clinical-files": { patientId: "", file: null },
  billing: { patientId: "", clinicalProcedureIds: [] as string[], procedureLogIds: [] as string[], inventoryItems: [] as any[], taxRate: 0.15, notes: "" },
  payments: { invoiceId: "", amount: 0, paymentMethod: "Efectivo", reference: "", processor: "" },
  inventory: { name: "", description: "", quantityAvailable: 0, minimumStock: 0, unitOfMeasure: "unidad", unitPrice: 0, taxable: true },
  consents: { patientId: "", procedureLogId: "", consentType: "Tratamiento", description: "", signerName: "", relationship: "", observations: "", status: "SIGNED", file: null },
  audit: {},
  reports: {},
  notifications: { type: "REMINDER", message: "", appointmentId: "", status: "PENDING" },
  specialties: { name: "", description: "", doctorIds: [] as string[] },
  "fiscal-ranges": { documentType: "FACTURA", cai: "", establishmentCode: "000", emissionPointCode: "001", documentTypeCode: "01", prefix: "", startNumber: 1, endNumber: 1000, currentNumber: 0, nextNumber: 1, authorizationDate: new Date().toISOString().slice(0, 10), emissionDeadline: new Date().toISOString().slice(0, 10), status: "ACTIVE", notes: "" },
  "credit-debit-notes": { invoiceId: "", documentType: "NOTA_CREDITO", reason: "", amount: 0 },
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
  const [movementModal, setMovementModal] = useState<any>(null);
  const [detailItem, setDetailItem] = useState<any>(null);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [form, setForm] = useState<any>(emptyForms[moduleKey]);
  const [movementForm, setMovementForm] = useState({ movementType: "IN", quantity: 1, reason: "", reference: "", observations: "" });
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
      if (editingItem && moduleKey === "clinical-history") {
        await apiClient.put(`/clinical-history/${editingItem.id}`, {
          ...form,
          procedureTypeIds: form.procedureTypeIds || [],
        });
      } else if (moduleKey === "clinical-files") {
        if (!form.file || !form.patientId) throw new Error("Selecciona paciente y archivo");
        const body = new FormData();
        body.append("patientId", form.patientId);
        body.append("file", form.file);
        await apiClient.post("/clinical-files", body);
      } else if (moduleKey === "billing") {
        await apiClient.post(meta.endpoint, {
          ...form,
          clinicalProcedureIds: form.clinicalProcedureIds || [],
          procedureLogIds: form.procedureLogIds || [],
          inventoryItems: (form.inventoryItems || []).map((item: any) => ({
            ...item,
            quantity: Number(item.quantity),
            unitPrice: Number(item.unitPrice),
            taxable: Boolean(item.taxable),
          })),
          taxRate: Number(form.taxRate),
        });
      } else if (moduleKey === "fiscal-ranges") {
        await apiClient.post(meta.endpoint, {
          ...form,
          startNumber: Number(form.startNumber),
          endNumber: Number(form.endNumber),
          currentNumber: Number(form.currentNumber),
          nextNumber: Number(form.nextNumber),
        });
      } else if (moduleKey === "specialties") {
        const payload = { ...form, doctorIds: Array.isArray(form.doctorIds) ? form.doctorIds : splitIds(form.doctorIds) };
        if (editingItem) {
          await apiClient.put(`/specialties/${editingItem.id}`, payload);
        } else {
          await apiClient.post(meta.endpoint, payload);
        }
      } else if (moduleKey === "consents") {
        const body = new FormData();
        body.append("patientId", form.patientId);
        if (form.procedureLogId) body.append("procedureLogId", form.procedureLogId);
        body.append("description", `${form.consentType}: ${form.description || ""}${form.relationship ? `\nRelacion: ${form.relationship}` : ""}${form.observations ? `\nObservaciones: ${form.observations}` : ""}`);
        body.append("signerName", form.signerName || "");
        body.append("status", form.status || "SIGNED");
        if (form.file) body.append("file", form.file);
        await apiClient.post(meta.endpoint, body);
      } else if (moduleKey === "payments") {
        const payload = { ...form, amount: Number(form.amount) };
        if (editingItem) {
          await apiClient.put(`/payments/${editingItem.id}`, payload);
        } else {
          await apiClient.post(meta.endpoint, payload);
        }
      } else if (moduleKey === "credit-debit-notes") {
        await apiClient.post(meta.endpoint, { ...form, amount: Number(form.amount) || undefined });
      } else if (moduleKey === "inventory") {
        const payload = { ...form, quantityAvailable: Number(form.quantityAvailable), minimumStock: Number(form.minimumStock), unitPrice: Number(form.unitPrice), taxable: Boolean(form.taxable) };
        if (editingItem) {
          await apiClient.put(`/inventory/${editingItem.id}`, payload);
        } else {
          await apiClient.post(meta.endpoint, payload);
        }
      } else {
        await apiClient.post(meta.endpoint, normalizePayload(form));
      }
      setModalOpen(false);
      setEditingItem(null);
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

  const openMovement = (item: any, movementType: "IN" | "OUT" | "ADJUST") => {
    setMovementModal(item);
    setMovementForm({ movementType, quantity: 1, reason: "", reference: "", observations: "" });
  };

  const openCreate = () => {
    setEditingItem(null);
    setForm(emptyForms[moduleKey]);
    setModalOpen(true);
  };

  const openEditInventory = (item: any) => {
    setEditingItem(item);
    setForm({
      name: item.name || "",
      description: item.description || "",
      quantityAvailable: item.quantityAvailable || 0,
      minimumStock: item.minimumStock || 0,
      unitOfMeasure: item.unitOfMeasure || "unidad",
      unitPrice: item.unitPrice || 0,
      taxable: Boolean(item.taxable),
    });
    setModalOpen(true);
  };

  const openEditIntegrated = (item: any) => {
    setEditingItem(item);
    if (moduleKey === "clinical-history") {
      setForm({
        patientId: item.patientId || item.patient?.id || "",
        odontologistId: item.odontologistId || item.odontologist?.id || "",
        reason: item.reason || "",
        diagnosis: item.diagnosis || "",
        treatmentPerformed: item.treatmentPerformed || "",
        observations: item.observations || "",
        date: item.date ? new Date(item.date).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
        procedureTypeIds: item.procedures?.map((procedure: any) => procedure.procedureTypeId).filter(Boolean) || [],
      });
    } else if (moduleKey === "payments") {
      setForm({
        invoiceId: item.invoiceId || item.invoice?.id || "",
        amount: Number(item.amount || 0),
        paymentMethod: item.paymentMethod || "Efectivo",
        reference: item.reference || "",
        processor: item.processor || "",
      });
    } else if (moduleKey === "specialties") {
      setForm({
        name: item.name || "",
        description: item.description || "",
        doctorIds: item.doctors?.map((doctor: any) => doctor.id) || [],
      });
    }
    setModalOpen(true);
  };

  const removeSpecialty = async (item: any) => {
    if (!confirm(`Eliminar especialidad ${item.name}?`)) return;
    try {
      await apiClient.delete(`/specialties/${item.id}`);
      loadData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const removeInventory = async (item: any) => {
    if (!confirm(`Inactivar insumo ${item.inventoryCode || item.name}?`)) return;
    try {
      await apiClient.delete(`/inventory/${item.id}`);
      loadData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const submitMovement = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!movementModal) return;
    try {
      await apiClient.post(`/inventory/${movementModal.id}/movements`, { ...movementForm, quantity: Number(movementForm.quantity) });
      setMovementModal(null);
      loadData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const downloadInvoice = async (item: any) => {
    try {
      await apiClient.download(`/billing/${item.id}/pdf`, `${item.fiscalNumber || item.invoiceNumber}.pdf`);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const downloadConsentPdf = async (item: any) => {
    try {
      await apiClient.download(`/consents/${item.id}/pdf`, `consentimiento-${item.id}.pdf`);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const cancelPayment = async (item: any) => {
    const reason = prompt("Motivo de cancelacion del pago");
    if (!reason || reason.trim().length < 3) return;
    try {
      await apiClient.patch(`/payments/${item.id}/cancel`, { reason: reason.trim() });
      loadData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const updateFiscalStatus = async (item: any, status: string) => {
    if (!confirm(`Cambiar estado del rango ${item.cai} a ${status}?`)) return;
    try {
      await apiClient.patch(`/fiscal-ranges/${item.id}/status`, { status });
      loadData();
    } catch (err: any) {
      setError(err.message);
    }
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
          <button onClick={openCreate} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg flex items-center justify-center gap-2 transition-all shadow-sm">
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
                      <div className="flex justify-end gap-2">
                        {moduleKey !== "audit" && moduleKey !== "reports" && (
                          <button title="Ver detalle" onClick={() => setDetailItem(item)} className="p-2 text-zinc-400 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg"><Eye className="w-4 h-4" /></button>
                        )}
                      </div>
                      {moduleKey === "clinical-files" && (
                        <div className="flex justify-end gap-2">
                          <a title="Descargar" className="p-2 text-zinc-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg" href={item.fileUrl} target="_blank"><Download className="w-4 h-4" /></a>
                          <button onClick={() => removeFile(item.id)} className="p-2 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      )}
                      {moduleKey === "billing" && (
                        <div className="flex justify-end gap-2">
                          <button title="Descargar factura PDF" onClick={() => downloadInvoice(item)} className="p-2 text-emerald-700 hover:bg-emerald-50 rounded-lg"><Download className="w-4 h-4" /></button>
                        </div>
                      )}
                      {moduleKey === "payments" && item.status !== "CANCELLED" && (
                        <div className="flex justify-end gap-2">
                          <button title="Editar pago" onClick={() => openEditIntegrated(item)} className="p-2 text-zinc-400 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg"><Pencil className="w-4 h-4" /></button>
                          <button title="Cancelar pago" onClick={() => cancelPayment(item)} className="p-2 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Ban className="w-4 h-4" /></button>
                        </div>
                      )}
                      {moduleKey === "clinical-history" && (
                        <div className="flex justify-end gap-2">
                          <button title="Editar historial" onClick={() => openEditIntegrated(item)} className="p-2 text-zinc-400 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg"><Pencil className="w-4 h-4" /></button>
                        </div>
                      )}
                      {moduleKey === "specialties" && (
                        <div className="flex justify-end gap-2">
                          <button title="Editar especialidad" onClick={() => openEditIntegrated(item)} className="p-2 text-zinc-400 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg"><Pencil className="w-4 h-4" /></button>
                          <button title="Eliminar especialidad" onClick={() => removeSpecialty(item)} className="p-2 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      )}
                      {moduleKey === "consents" && item.documentUrl && (
                        <div className="flex justify-end gap-2">
                          <a title="Abrir documento" className="p-2 text-emerald-700 hover:bg-emerald-50 rounded-lg" href={item.documentUrl} target="_blank"><Download className="w-4 h-4" /></a>
                        </div>
                      )}
                      {moduleKey === "consents" && (
                        <div className="flex justify-end gap-2">
                          <button title="Descargar consentimiento PDF" onClick={() => downloadConsentPdf(item)} className="p-2 text-zinc-700 hover:bg-zinc-100 rounded-lg"><Download className="w-4 h-4" /></button>
                        </div>
                      )}
                      {moduleKey === "inventory" && (
                        <div className="flex justify-end gap-2">
                          <button title="Editar insumo" onClick={() => openEditInventory(item)} className="p-2 text-zinc-400 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg"><Pencil className="w-4 h-4" /></button>
                          <button onClick={() => openMovement(item, "IN")} className="px-2 py-1 text-xs bg-emerald-50 text-emerald-700 rounded">Entrada</button>
                          <button onClick={() => openMovement(item, "OUT")} className="px-2 py-1 text-xs bg-red-50 text-red-700 rounded">Salida</button>
                          <button onClick={() => openMovement(item, "ADJUST")} className="px-2 py-1 text-xs bg-zinc-100 text-zinc-700 rounded">Ajuste</button>
                          <button title="Inactivar insumo" onClick={() => removeInventory(item)} className="p-2 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      )}
                      {moduleKey === "fiscal-ranges" && (
                        <div className="flex justify-end gap-2">
                          {item.status !== "ACTIVE" && <button onClick={() => updateFiscalStatus(item, "ACTIVE")} className="px-2 py-1 text-xs bg-emerald-50 text-emerald-700 rounded">Activar</button>}
                          {item.status === "ACTIVE" && <button onClick={() => updateFiscalStatus(item, "INACTIVE")} className="px-2 py-1 text-xs bg-zinc-100 text-zinc-700 rounded">Inactivar</button>}
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
              <h2 className="text-xl font-bold text-zinc-900">{editingItem ? "Editar registro" : "Nuevo registro"}</h2>
              <button onClick={() => { setModalOpen(false); setEditingItem(null); }} className="text-zinc-400 hover:text-zinc-600"><X className="w-6 h-6" /></button>
            </div>
            <form onSubmit={submit} className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              <ModuleForm moduleKey={moduleKey} form={form} setForm={setForm} lookups={lookups} />
              <div className="md:col-span-2 flex justify-end gap-3 mt-4">
                <button type="button" onClick={() => { setModalOpen(false); setEditingItem(null); }} className="px-4 py-2 text-zinc-600 hover:bg-zinc-100 rounded-lg">Cancelar</button>
                <button type="submit" className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-bold">Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {movementModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl overflow-hidden">
            <div className="p-6 border-b border-zinc-100 flex justify-between items-center bg-zinc-50">
              <div>
                <p className="font-mono text-sm text-emerald-700">{movementModal.inventoryCode || "-"}</p>
                <h2 className="text-xl font-bold text-zinc-900">{movementModal.name}</h2>
              </div>
              <button onClick={() => setMovementModal(null)} className="text-zinc-400 hover:text-zinc-600"><X className="w-6 h-6" /></button>
            </div>
            <form onSubmit={submitMovement} className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Tipo movimiento">
                <select className="w-full p-2 border rounded-lg" value={movementForm.movementType} onChange={(event) => setMovementForm({ ...movementForm, movementType: event.target.value })}>
                  <option value="IN">Entrada</option>
                  <option value="OUT">Salida</option>
                  <option value="ADJUST">Ajuste</option>
                </select>
              </Field>
              <Field label="Stock actual"><input readOnly className="w-full p-2 border rounded-lg bg-zinc-50" value={movementModal.quantityAvailable} /></Field>
              <Field label="Cantidad"><input type="number" min="1" className="w-full p-2 border rounded-lg" value={movementForm.quantity} onChange={(event) => setMovementForm({ ...movementForm, quantity: Number(event.target.value) })} /></Field>
              <Field label="Nuevo stock"><input readOnly className="w-full p-2 border rounded-lg bg-zinc-50" value={movementForm.movementType === "IN" ? movementModal.quantityAvailable + Number(movementForm.quantity || 0) : movementForm.movementType === "OUT" ? movementModal.quantityAvailable - Number(movementForm.quantity || 0) : Number(movementForm.quantity || 0)} /></Field>
              <Field label="Motivo"><input required className="w-full p-2 border rounded-lg" value={movementForm.reason} onChange={(event) => setMovementForm({ ...movementForm, reason: event.target.value })} /></Field>
              <Field label="Referencia"><input className="w-full p-2 border rounded-lg" value={movementForm.reference} onChange={(event) => setMovementForm({ ...movementForm, reference: event.target.value })} /></Field>
              <div className="md:col-span-2"><Field label="Observaciones"><textarea className="w-full p-2 border rounded-lg" value={movementForm.observations} onChange={(event) => setMovementForm({ ...movementForm, observations: event.target.value })} /></Field></div>
              <div className="md:col-span-2 flex justify-end gap-3">
                <button type="button" onClick={() => setMovementModal(null)} className="px-4 py-2 text-zinc-600 hover:bg-zinc-100 rounded-lg">Cancelar</button>
                <button type="submit" className="px-6 py-2 bg-emerald-600 text-white rounded-lg font-bold">Registrar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {detailItem && (
        <DetailModal moduleKey={moduleKey} item={detailItem} onClose={() => setDetailItem(null)} onDownloadInvoice={downloadInvoice} onDownloadConsent={downloadConsentPdf} onCancelPayment={cancelPayment} />
      )}
    </div>
  );
};

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
    billing: ["Factura", "Paciente", "Lineas", "Subtotal", "Impuesto", "Total", "Estado"],
    payments: ["Fecha", "Factura", "Paciente", "Monto", "Metodo"],
    inventory: ["Codigo", "Insumo", "Stock", "Minimo", "Unidad", "Precio", "Impuesto"],
    consents: ["Fecha", "Paciente", "Procedimiento", "Estado"],
    audit: ["Fecha", "Usuario", "Accion", "Entidad", "IP"],
    reports: [],
    notifications: ["Fecha", "Tipo", "Mensaje", "Estado"],
    specialties: ["Especialidad", "Descripcion", "Odontologos"],
    "fiscal-ranges": ["Documento", "CAI", "Rango", "Siguiente", "Limite", "Estado"],
    "credit-debit-notes": ["Fecha", "Tipo", "Numero fiscal", "Factura", "Paciente", "Total", "Estado"],
  };
  return map[moduleKey];
}

function cellsFor(moduleKey: ModuleKey, item: any) {
  const patient = item.patient ? `${item.patient.firstName} ${item.patient.lastName}` : "";
  const doctor = item.odontologist ? `Dr. ${item.odontologist.firstName} ${item.odontologist.lastName}` : "";
  const invoicePatient = item.invoice?.patient ? `${item.invoice.patient.firstName} ${item.invoice.patient.lastName}` : "";
  const map: Record<ModuleKey, any[]> = {
    "clinical-history": [formatDate(item.date), patient, doctor || "No asignado", item.diagnosis, item.procedures?.map((p: any) => `${p.procedureCode} ${p.procedureName}`).join(", ") || item.treatmentPerformed || "-"],
    "clinical-files": [formatDate(item.uploadedAt), patient, item.fileName, item.fileType],
    billing: [item.fiscalNumber || item.invoiceNumber, patient, item.items?.length || item.procedureLogs?.length || 0, money(item.subtotal), money(item.tax), money(item.total), item.status],
    payments: [formatDate(item.paymentDate), item.invoice?.invoiceNumber, invoicePatient, money(item.amount), item.paymentMethod],
    inventory: [item.inventoryCode || "-", item.name, item.quantityAvailable <= item.minimumStock ? `${item.quantityAvailable} (bajo)` : item.quantityAvailable, item.minimumStock, item.unitOfMeasure, money(item.unitPrice), item.taxable ? "Si" : "No"],
    consents: [formatDate(item.signedAt), patient, item.procedureLog?.procedureType?.name || "-", item.signerName ? `${item.status} - ${item.signerName}` : item.status],
    audit: [formatDate(item.timestamp), item.user ? `${item.user.firstName} ${item.user.lastName}` : "Sistema", item.action, item.entity, item.ipAddress || "-"],
    reports: [],
    notifications: [formatDate(item.createdAt), item.type, item.message, item.status],
    specialties: [item.name, item.description || "-", item.doctors?.map((d: any) => `Dr. ${d.lastName}`).join(", ") || "-"],
    "fiscal-ranges": [item.documentType, item.cai, `${item.establishmentCode}-${item.emissionPointCode}-${item.documentTypeCode} ${item.startNumber}-${item.endNumber}`, item.nextNumber, formatDate(item.emissionDeadline), item.status],
    "credit-debit-notes": [formatDate(item.issueDate), item.documentType, item.fiscalNumber, item.invoice?.fiscalNumber || item.invoice?.invoiceNumber, item.invoice?.patient ? `${item.invoice.patient.firstName} ${item.invoice.patient.lastName}` : "-", money(item.total), item.status],
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
