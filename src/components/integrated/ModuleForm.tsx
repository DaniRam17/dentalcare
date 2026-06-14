import { Upload } from "lucide-react";
import { BillingForm } from "./BillingForm";
import { Field, SelectField } from "./FormControls";

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

type ModuleFormProps = {
  moduleKey: ModuleKey;
  form: any;
  setForm: (form: any) => void;
  lookups: any;
};

export function ModuleForm({ moduleKey, form, setForm, lookups }: ModuleFormProps) {
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
  const invoiceSelect = <SelectField label="Factura pendiente" value={form.invoiceId || ""} onChange={(value) => {
    const invoice = lookups.invoices.find((item: any) => item.id === value);
    const paid = invoice?.payments?.filter((payment: any) => payment.status !== "CANCELLED").reduce((sum: number, payment: any) => sum + payment.amount, 0) || 0;
    const balance = invoice ? Math.max(Number(invoice.total || 0) - paid, 0) : form.amount;
    setForm({ ...form, invoiceId: value, amount: Number(balance.toFixed(2)) });
  }} options={lookups.invoices.filter((i: any) => i.status !== "PAID").map((i: any) => {
    const paid = i.payments?.filter((payment: any) => payment.status !== "CANCELLED").reduce((sum: number, payment: any) => sum + payment.amount, 0) || 0;
    const balance = Math.max(Number(i.total || 0) - paid, 0);
    return { value: i.id, label: `${i.fiscalNumber || i.invoiceNumber} - ${i.patient.firstName} ${i.patient.lastName} - Saldo $${balance.toFixed(2)}` };
  })} />;

  if (moduleKey === "clinical-history") return <>{patientSelect}{doctorSelect}{input("date", "Fecha", "date")}{textarea("reason", "Motivo de consulta")}{textarea("diagnosis", "Diagnostico")}{textarea("treatmentPerformed", "Tratamiento")}{textarea("observations", "Observaciones")}<ProcedurePicker form={form} setForm={setForm} procedures={lookups.procedureTypes || []} /></>;
  if (moduleKey === "clinical-files") return <>{patientSelect}<Field label="Archivo PDF/JPG/PNG"><input required type="file" accept=".pdf,.jpg,.jpeg,.png" className="w-full p-2 border rounded-lg" onChange={(event) => setForm({ ...form, file: event.target.files?.[0] })} /></Field><div className="md:col-span-2 text-sm text-zinc-500 flex gap-2"><Upload className="w-4 h-4" /> El archivo se guarda en almacenamiento local y la metadata en Prisma.</div></>;
  if (moduleKey === "billing") return <BillingForm form={form} setForm={setForm} lookups={lookups} patientSelect={patientSelect} />;
  if (moduleKey === "payments") return <>{invoiceSelect}{input("amount", "Monto a pagar", "number")}<SelectField label="Metodo de pago" value={form.paymentMethod} onChange={(value) => setForm({ ...form, paymentMethod: value })} options={["Efectivo", "Tarjeta", "Transferencia", "POS", "Billetera digital", "Otro"].map((value) => ({ value, label: value }))} />{input("reference", "Referencia externa (opcional)")}{input("processor", "Procesador/app")}</>;
  if (moduleKey === "inventory") return <>{input("name", "Insumo")}{input("unitOfMeasure", "Unidad")}{input("quantityAvailable", "Stock inicial", "number")}{input("minimumStock", "Stock minimo", "number")}{input("unitPrice", "Precio de venta", "number")}<Field label="Aplica impuesto"><label className="flex items-center gap-2 p-2 border rounded-lg"><input type="checkbox" checked={Boolean(form.taxable)} onChange={(event) => setForm({ ...form, taxable: event.target.checked })} /> Si</label></Field>{textarea("description", "Descripcion")}</>;
  if (moduleKey === "consents") return <>{patientSelect}<SelectField label="Procedimiento" value={form.procedureLogId || ""} onChange={(value) => setForm({ ...form, procedureLogId: value })} options={(lookups.procedureLogs || []).filter((log: any) => !form.patientId || log.patientId === form.patientId).map((log: any) => ({ value: log.id, label: `${log.procedureType.name} - ${log.patient.firstName} ${log.patient.lastName}` }))} required={false} /><SelectField label="Tipo consentimiento" value={form.consentType} onChange={(value) => setForm({ ...form, consentType: value })} options={["Tratamiento", "Cirugia", "Radiografia", "Anestesia", "Otro"].map((value) => ({ value, label: value }))} />{textarea("description", "Texto del consentimiento")}{input("signerName", "Nombre del firmante")}{input("relationship", "Parentesco o relacion")}{textarea("observations", "Observaciones")}<Field label="Archivo escaneado"><input type="file" accept=".pdf,.jpg,.jpeg,.png" className="w-full p-2 border rounded-lg" onChange={(event) => setForm({ ...form, file: event.target.files?.[0] || null })} /></Field></>;
  if (moduleKey === "notifications") return <>{input("type", "Tipo")}{textarea("message", "Mensaje")}</>;
  if (moduleKey === "specialties") return <>{input("name", "Especialidad")}{textarea("description", "Descripcion")}<DoctorPicker form={form} setForm={setForm} doctors={lookups.doctors || []} /></>;
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

function DoctorPicker({ form, setForm, doctors }: any) {
  const selected = form.doctorIds || [];
  const toggle = (id: string) => {
    setForm({ ...form, doctorIds: selected.includes(id) ? selected.filter((item: string) => item !== id) : [...selected, id] });
  };
  return (
    <div className="md:col-span-2 space-y-2">
      <label className="text-sm font-medium text-zinc-700">Odontologos</label>
      <div className="max-h-40 overflow-auto border rounded-lg divide-y">
        {doctors.length === 0 ? <p className="p-3 text-sm text-zinc-400">No hay odontologos disponibles</p> : doctors.map((doctor: any) => (
          <label key={doctor.id} className="flex items-center gap-3 p-3 text-sm">
            <input type="checkbox" checked={selected.includes(doctor.id)} onChange={() => toggle(doctor.id)} />
            <span className="flex-1">Dr. {doctor.firstName} {doctor.lastName}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

function money(value: number) {
  return `$${Number(value || 0).toFixed(2)}`;
}
