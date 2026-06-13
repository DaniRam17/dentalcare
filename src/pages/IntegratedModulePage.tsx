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
  | "specialties"
  | "fiscal-ranges";

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
};

const emptyForms: Record<ModuleKey, any> = {
  "clinical-history": { patientId: "", odontologistId: "", reason: "", diagnosis: "", treatmentPerformed: "", observations: "", procedureTypeIds: [] as string[], date: new Date().toISOString().slice(0, 10) },
  "clinical-files": { patientId: "", file: null },
  billing: { patientId: "", clinicalProcedureIds: [] as string[], procedureLogIds: [] as string[], inventoryItems: [] as any[], taxRate: 0.15, paymentMethod: "Efectivo", notes: "" },
  payments: { invoiceId: "", amount: 0, paymentMethod: "Efectivo", reference: "", processor: "" },
  inventory: { name: "", description: "", quantityAvailable: 0, minimumStock: 0, unitOfMeasure: "unidad", unitPrice: 0, taxable: true },
  consents: { patientId: "", procedureLogId: "", description: "", documentUrl: "", signerName: "", signatureDataUrl: "", status: "SIGNED" },
  audit: {},
  reports: {},
  notifications: { type: "REMINDER", message: "", appointmentId: "", status: "PENDING" },
  specialties: { name: "", description: "", doctorIds: "" },
  "fiscal-ranges": { documentType: "FACTURA", cai: "", establishmentCode: "000", emissionPointCode: "001", documentTypeCode: "01", prefix: "", startNumber: 1, endNumber: 1000, currentNumber: 0, nextNumber: 1, authorizationDate: new Date().toISOString().slice(0, 10), emissionDeadline: new Date().toISOString().slice(0, 10), status: "ACTIVE", notes: "" },
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
        await apiClient.post(meta.endpoint, { ...form, doctorIds: splitIds(form.doctorIds) });
      } else if (moduleKey === "payments") {
        await apiClient.post(meta.endpoint, { ...form, amount: Number(form.amount) });
      } else if (moduleKey === "inventory") {
        await apiClient.post(meta.endpoint, { ...form, quantityAvailable: Number(form.quantityAvailable), minimumStock: Number(form.minimumStock), unitPrice: Number(form.unitPrice), taxable: Boolean(form.taxable) });
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

  const downloadInvoice = async (item: any) => {
    try {
      await apiClient.download(`/billing/${item.id}/pdf`, `${item.fiscalNumber || item.invoiceNumber}.pdf`);
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
                      {moduleKey === "billing" && (
                        <div className="flex justify-end gap-2">
                          <button onClick={() => downloadInvoice(item)} className="px-3 py-1 text-xs rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100">Factura PDF</button>
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
  const patientSelect = <SelectField label="Paciente" value={form.patientId} onChange={(value) => setForm({ ...form, patientId: value })} options={lookups.patients.map((p: any) => ({ value: p.id, label: `${p.patientCode || "SIN-COD"} - ${p.firstName} ${p.lastName} - ${p.documentNumber}` }))} />;
  const doctorSelect = <SelectField label="Odontologo" value={form.odontologistId || ""} onChange={(value) => setForm({ ...form, odontologistId: value })} options={lookups.doctors.map((d: any) => ({ value: d.id, label: `Dr. ${d.firstName} ${d.lastName}` }))} required={false} />;
  const invoiceSelect = <SelectField label="Factura" value={form.invoiceId || ""} onChange={(value) => setForm({ ...form, invoiceId: value })} options={lookups.invoices.map((i: any) => ({ value: i.id, label: `${i.invoiceNumber} - ${i.patient.firstName} ${i.patient.lastName} - $${i.total}` }))} />;

  if (moduleKey === "clinical-history") return <>{patientSelect}{doctorSelect}{input("date", "Fecha", "date")}{textarea("reason", "Motivo de consulta")}{textarea("diagnosis", "Diagnostico")}{textarea("treatmentPerformed", "Tratamiento")}{textarea("observations", "Observaciones")}<ProcedurePicker form={form} setForm={setForm} procedures={lookups.procedureTypes || []} /></>;
  if (moduleKey === "clinical-files") return <>{patientSelect}<Field label="Archivo PDF/JPG/PNG"><input required type="file" accept=".pdf,.jpg,.jpeg,.png" className="w-full p-2 border rounded-lg" onChange={(event) => setForm({ ...form, file: event.target.files?.[0] })} /></Field><div className="md:col-span-2 text-sm text-zinc-500 flex gap-2"><Upload className="w-4 h-4" /> El archivo se guarda en almacenamiento local y la metadata en Prisma.</div></>;
  if (moduleKey === "billing") return <BillingForm form={form} setForm={setForm} lookups={lookups} patientSelect={patientSelect} />;
  if (moduleKey === "payments") return <>{invoiceSelect}{input("amount", "Monto", "number")}<SelectField label="Metodo de pago" value={form.paymentMethod} onChange={(value) => setForm({ ...form, paymentMethod: value })} options={["Efectivo", "Transferencia", "Tarjeta de credito", "Tarjeta de debito", "App de pagos"].map((value) => ({ value, label: value }))} />{input("reference", "Referencia o autorizacion")}{input("processor", "Procesador/app")}</>;
  if (moduleKey === "inventory") return <>{input("name", "Insumo")}{input("unitOfMeasure", "Unidad")}{input("quantityAvailable", "Stock inicial", "number")}{input("minimumStock", "Stock minimo", "number")}{input("unitPrice", "Precio de venta", "number")}<Field label="Aplica impuesto"><label className="flex items-center gap-2 p-2 border rounded-lg"><input type="checkbox" checked={Boolean(form.taxable)} onChange={(event) => setForm({ ...form, taxable: event.target.checked })} /> Si</label></Field>{textarea("description", "Descripcion")}</>;
  if (moduleKey === "consents") return <>{patientSelect}<SelectField label="Procedimiento" value={form.procedureLogId || ""} onChange={(value) => setForm({ ...form, procedureLogId: value })} options={(lookups.procedureLogs || []).filter((log: any) => !form.patientId || log.patientId === form.patientId).map((log: any) => ({ value: log.id, label: `${log.procedureType.name} - ${log.patient.firstName} ${log.patient.lastName}` }))} required={false} />{textarea("description", "Texto del consentimiento")}{input("signerName", "Nombre del firmante")}{textarea("signatureDataUrl", "Firma digital o base64")}{input("documentUrl", "URL del documento firmado")}</>;
  if (moduleKey === "notifications") return <>{input("type", "Tipo")}{textarea("message", "Mensaje")}</>;
  if (moduleKey === "specialties") return <>{input("name", "Especialidad")}{textarea("description", "Descripcion")}<Field label="Odontologos"><input className="w-full p-2 border rounded-lg" value={form.doctorIds} onChange={(event) => setForm({ ...form, doctorIds: event.target.value })} placeholder="IDs separados por coma" /></Field></>;
  if (moduleKey === "fiscal-ranges") return <><SelectField label="Tipo documento" value={form.documentType} onChange={(value) => setForm({ ...form, documentType: value })} options={[{ value: "FACTURA", label: "Factura" }, { value: "NOTA_CREDITO", label: "Nota de credito" }, { value: "NOTA_DEBITO", label: "Nota de debito" }]} />{input("cai", "CAI")}{input("establishmentCode", "Establecimiento")}{input("emissionPointCode", "Punto de emision")}{input("documentTypeCode", "Tipo documento fiscal")}{input("startNumber", "Numero inicial", "number")}{input("endNumber", "Numero final", "number")}{input("currentNumber", "Correlativo actual", "number")}{input("nextNumber", "Siguiente correlativo", "number")}{input("authorizationDate", "Fecha autorizacion", "date")}{input("emissionDeadline", "Fecha limite emision", "date")}<SelectField label="Estado" value={form.status} onChange={(value) => setForm({ ...form, status: value })} options={["ACTIVE", "INACTIVE", "VENCIDO", "AGOTADO"].map((value) => ({ value, label: value }))} />{textarea("notes", "Notas")}</>;
  return null;
}

function ProcedurePicker({ form, setForm, procedures }: any) {
  const selected = form.procedureTypeIds || [];
  const toggle = (id: string) => {
    setForm({
      ...form,
      procedureTypeIds: selected.includes(id) ? selected.filter((item: string) => item !== id) : [...selected, id],
    });
  };
  return (
    <div className="md:col-span-2 space-y-2">
      <label className="text-sm font-medium text-zinc-700">Procedimientos realizados</label>
      <div className="max-h-40 overflow-auto border rounded-lg divide-y">
        {procedures.map((procedure: any) => (
          <label key={procedure.id} className="flex items-center gap-3 p-3 text-sm">
            <input type="checkbox" checked={selected.includes(procedure.id)} onChange={() => toggle(procedure.id)} />
            <span className="font-mono text-xs text-emerald-700">{procedure.procedureCode || "-"}</span>
            <span className="flex-1">{procedure.name}</span>
            <span className="font-semibold">{money(procedure.price)}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

function BillingForm({ form, setForm, lookups, patientSelect }: any) {
  const selectedProcedures = form.clinicalProcedureIds || [];
  const inventoryItems = form.inventoryItems || [];
  const procedureOptions = (lookups.clinicalProcedures || []).filter((procedure: any) => !form.patientId || procedure.patientId === form.patientId);

  const toggleProcedure = (id: string) => {
    setForm({
      ...form,
      clinicalProcedureIds: selectedProcedures.includes(id)
        ? selectedProcedures.filter((item: string) => item !== id)
        : [...selectedProcedures, id],
    });
  };

  const addInventoryLine = () => {
    const first = lookups.inventoryItems?.[0];
    setForm({
      ...form,
      inventoryItems: [
        ...inventoryItems,
        { inventoryItemId: first?.id || "", quantity: 1, unitPrice: first?.unitPrice || 0, taxable: first?.taxable ?? true },
      ],
    });
  };

  const updateInventoryLine = (index: number, patch: any) => {
    const next = inventoryItems.map((item: any, itemIndex: number) => itemIndex === index ? { ...item, ...patch } : item);
    setForm({ ...form, inventoryItems: next });
  };

  const removeInventoryLine = (index: number) => {
    setForm({ ...form, inventoryItems: inventoryItems.filter((_: any, itemIndex: number) => itemIndex !== index) });
  };

  return (
    <>
      {patientSelect}
      <Field label="Impuesto general">
        <input className="w-full p-2 border rounded-lg" type="number" step="0.01" min="0" max="1" value={form.taxRate} onChange={(event) => setForm({ ...form, taxRate: Number(event.target.value) })} />
      </Field>
      <SelectField label="Metodo pago" value={form.paymentMethod} onChange={(value) => setForm({ ...form, paymentMethod: value })} options={["Efectivo", "Transferencia", "Tarjeta de credito", "Tarjeta de debito", "App de pagos"].map((value) => ({ value, label: value }))} />
      <div className="md:col-span-2 space-y-2">
        <label className="text-sm font-medium text-zinc-700">Procedimientos pendientes</label>
        <div className="max-h-36 overflow-auto border rounded-lg divide-y">
          {procedureOptions.length === 0 ? <p className="p-3 text-sm text-zinc-400">No hay procedimientos pendientes para este paciente.</p> : procedureOptions.map((procedure: any) => (
            <label key={procedure.id} className="flex items-center gap-3 p-3 text-sm">
              <input type="checkbox" checked={selectedProcedures.includes(procedure.id)} onChange={() => toggleProcedure(procedure.id)} />
              <span className="font-mono text-xs text-emerald-700">{procedure.procedureCode}</span>
              <span className="flex-1">{procedure.procedureName} - {procedure.patient.firstName} {procedure.patient.lastName}</span>
              <span className="font-semibold">${Number(procedure.price || 0).toFixed(2)}</span>
            </label>
          ))}
        </div>
      </div>
      <div className="md:col-span-2 space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-zinc-700">Inventario facturable</label>
          <button type="button" onClick={addInventoryLine} className="px-3 py-1 text-sm bg-zinc-900 text-white rounded-lg">Agregar insumo</button>
        </div>
        {inventoryItems.map((line: any, index: number) => {
          const selected = lookups.inventoryItems.find((item: any) => item.id === line.inventoryItemId);
          return (
            <div key={index} className="grid grid-cols-1 md:grid-cols-5 gap-2 p-3 border rounded-lg">
              <select className="p-2 border rounded-lg md:col-span-2" value={line.inventoryItemId} onChange={(event) => {
                const item = lookups.inventoryItems.find((entry: any) => entry.id === event.target.value);
                updateInventoryLine(index, { inventoryItemId: event.target.value, unitPrice: item?.unitPrice || 0, taxable: item?.taxable ?? true });
              }}>
                <option value="">Seleccionar insumo...</option>
                {lookups.inventoryItems.map((item: any) => <option key={item.id} value={item.id}>{item.name} ({item.quantityAvailable} {item.unitOfMeasure})</option>)}
              </select>
              <input className="p-2 border rounded-lg" type="number" min="1" max={selected?.quantityAvailable || undefined} value={line.quantity} onChange={(event) => updateInventoryLine(index, { quantity: Number(event.target.value) })} />
              <input className="p-2 border rounded-lg" type="number" min="0" step="0.01" value={line.unitPrice} onChange={(event) => updateInventoryLine(index, { unitPrice: Number(event.target.value) })} />
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(line.taxable)} onChange={(event) => updateInventoryLine(index, { taxable: event.target.checked })} /> Imp.</label>
                <button type="button" onClick={() => removeInventoryLine(index)} className="ml-auto p-2 text-red-500 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
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
    billing: ["Factura", "Paciente", "Lineas", "Subtotal", "Impuesto", "Total", "Estado"],
    payments: ["Fecha", "Factura", "Paciente", "Monto", "Metodo"],
    inventory: ["Insumo", "Stock", "Minimo", "Unidad", "Precio", "Impuesto"],
    consents: ["Fecha", "Paciente", "Procedimiento", "Estado"],
    audit: ["Fecha", "Usuario", "Accion", "Entidad", "IP"],
    reports: [],
    notifications: ["Fecha", "Tipo", "Mensaje", "Estado"],
    specialties: ["Especialidad", "Descripcion", "Odontologos"],
    "fiscal-ranges": ["Documento", "CAI", "Rango", "Siguiente", "Limite", "Estado"],
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
    inventory: [item.name, item.quantityAvailable <= item.minimumStock ? `${item.quantityAvailable} (bajo)` : item.quantityAvailable, item.minimumStock, item.unitOfMeasure, money(item.unitPrice), item.taxable ? "Si" : "No"],
    consents: [formatDate(item.signedAt), patient, item.procedureLog?.procedureType?.name || "-", item.signerName ? `${item.status} - ${item.signerName}` : item.status],
    audit: [formatDate(item.timestamp), item.user ? `${item.user.firstName} ${item.user.lastName}` : "Sistema", item.action, item.entity, item.ipAddress || "-"],
    reports: [],
    notifications: [formatDate(item.createdAt), item.type, item.message, item.status],
    specialties: [item.name, item.description || "-", item.doctors?.map((d: any) => `Dr. ${d.lastName}`).join(", ") || "-"],
    "fiscal-ranges": [item.documentType, item.cai, `${item.establishmentCode}-${item.emissionPointCode}-${item.documentTypeCode} ${item.startNumber}-${item.endNumber}`, item.nextNumber, formatDate(item.emissionDeadline), item.status],
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
