import { X } from "lucide-react";

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

type DetailModalProps = {
  moduleKey: ModuleKey;
  item: any;
  onClose: () => void;
  onDownloadInvoice: (item: any) => void;
  onDownloadConsent?: (item: any) => void;
  onCancelPayment: (item: any) => void;
};

export function DetailModal({ moduleKey, item, onClose, onDownloadInvoice, onDownloadConsent, onCancelPayment }: DetailModalProps) {
  const patient = item.patient ? `${item.patient.firstName} ${item.patient.lastName}` : "-";
  const invoicePaid = item.payments?.filter((payment: any) => payment.status !== "CANCELLED").reduce((sum: number, payment: any) => sum + payment.amount, 0) || 0;
  const invoiceBalance = Math.max(Number(item.total || 0) - invoicePaid, 0);
  const paymentBalance = item.invoice ? Math.max(Number(item.invoice.total || 0) - (item.invoice.payments || []).filter((payment: any) => payment.status !== "CANCELLED").reduce((sum: number, payment: any) => sum + payment.amount, 0), 0) : 0;

  const titleMap: Record<ModuleKey, string> = {
    "clinical-history": "Detalle de historial",
    "clinical-files": "Detalle de archivo",
    billing: "Detalle de factura",
    payments: "Detalle de pago",
    inventory: "Detalle de inventario",
    consents: "Detalle de consentimiento",
    audit: "Detalle de auditoria",
    reports: "Detalle de reporte",
    notifications: "Detalle de notificacion",
    specialties: "Detalle de especialidad",
    "fiscal-ranges": "Detalle de rango fiscal",
  };

  const rows: Array<[string, any]> = moduleKey === "billing" ? [
    ["Factura", item.fiscalNumber || item.invoiceNumber],
    ["Paciente", patient],
    ["Fecha", formatDate(item.issueDate)],
    ["CAI", item.cai || "-"],
    ["Subtotal", money(item.subtotal)],
    ["Impuesto", money(item.tax)],
    ["Total", money(item.total)],
    ["Pagado", money(invoicePaid)],
    ["Saldo", money(invoiceBalance)],
    ["Estado", item.status],
  ] : moduleKey === "payments" ? [
    ["Fecha", formatDate(item.paymentDate)],
    ["Factura", item.invoice?.fiscalNumber || item.invoice?.invoiceNumber],
    ["Paciente", item.invoice?.patient ? `${item.invoice.patient.firstName} ${item.invoice.patient.lastName}` : "-"],
    ["Monto", money(item.amount)],
    ["Metodo", item.paymentMethod],
    ["Referencia", item.reference || "-"],
    ["Procesador", item.processor || "-"],
    ["Estado", item.status],
    ["Saldo factura", money(paymentBalance)],
    ["Motivo cancelacion", item.cancellationReason || "-"],
  ] : moduleKey === "inventory" ? [
    ["Codigo", item.inventoryCode || "-"],
    ["Insumo", item.name],
    ["Descripcion", item.description || "-"],
    ["Stock actual", item.quantityAvailable],
    ["Stock minimo", item.minimumStock],
    ["Unidad", item.unitOfMeasure],
    ["Precio", money(item.unitPrice)],
    ["Impuesto", item.taxable ? "Si" : "No"],
  ] : moduleKey === "consents" ? [
    ["Paciente", patient],
    ["Procedimiento", item.procedureLog?.procedureType?.name || "-"],
    ["Fecha", formatDate(item.signedAt)],
    ["Firmante", item.signerName || "-"],
    ["Estado", item.status],
    ["Documento", item.documentUrl ? "Adjunto" : "Sin adjunto"],
    ["Texto", item.description || "-"],
  ] : moduleKey === "clinical-history" ? [
    ["Fecha", formatDate(item.date)],
    ["Paciente", patient],
    ["Odontologo", item.odontologist ? `Dr. ${item.odontologist.firstName} ${item.odontologist.lastName}` : "-"],
    ["Motivo", item.reason || "-"],
    ["Diagnostico", item.diagnosis || "-"],
    ["Tratamiento", item.treatmentPerformed || "-"],
    ["Observaciones", item.observations || "-"],
  ] : [
    ["Registro", item.name || item.type || item.documentType || item.id],
    ["Estado", item.status || "-"],
    ["Fecha", formatDate(item.createdAt || item.uploadedAt || item.signedAt || item.timestamp)],
  ];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-3xl shadow-xl overflow-hidden">
        <div className="p-6 border-b border-zinc-100 flex justify-between items-center bg-zinc-50">
          <h2 className="text-xl font-bold text-zinc-900">{titleMap[moduleKey]}</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600"><X className="w-6 h-6" /></button>
        </div>
        <div className="p-6 space-y-5 max-h-[70vh] overflow-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {rows.map(([label, value]) => (
              <div key={label} className="border border-zinc-200 rounded-lg p-3">
                <p className="text-xs uppercase text-zinc-400 font-semibold">{label}</p>
                <p className="text-sm text-zinc-800 mt-1 whitespace-pre-wrap break-words">{String(value ?? "-")}</p>
              </div>
            ))}
          </div>

          {moduleKey === "billing" && item.items?.length > 0 && (
            <div>
              <p className="text-sm font-semibold text-zinc-700 mb-2">Lineas facturadas</p>
              <div className="border border-zinc-200 rounded-lg divide-y">
                {item.items.map((line: any) => (
                  <div key={line.id} className="p-3 grid grid-cols-1 md:grid-cols-4 gap-2 text-sm">
                    <span className="md:col-span-2">{line.itemCode || "-"} {line.description}</span>
                    <span>{line.quantity} x {money(line.unitPrice)}</span>
                    <span className="font-semibold md:text-right">{money(line.total)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {moduleKey === "inventory" && item.movements?.length > 0 && (
            <div>
              <p className="text-sm font-semibold text-zinc-700 mb-2">Ultimos movimientos</p>
              <div className="border border-zinc-200 rounded-lg divide-y">
                {item.movements.map((movement: any) => (
                  <div key={movement.id} className="p-3 grid grid-cols-1 md:grid-cols-5 gap-2 text-sm">
                    <span>{formatDate(movement.movementDate)}</span>
                    <span>{movement.movementType}</span>
                    <span>{movement.stockBefore ?? "-"} {"->"} {movement.stockAfter ?? "-"}</span>
                    <span>{movement.quantity}</span>
                    <span className="text-zinc-500">{movement.reason || "-"}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3">
            {moduleKey === "billing" && <button onClick={() => onDownloadInvoice(item)} className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-semibold">Descargar PDF</button>}
            {moduleKey === "payments" && item.status !== "CANCELLED" && <button onClick={() => onCancelPayment(item)} className="px-4 py-2 bg-red-600 text-white rounded-lg font-semibold">Cancelar pago</button>}
            {moduleKey === "consents" && onDownloadConsent && <button onClick={() => onDownloadConsent(item)} className="px-4 py-2 bg-zinc-900 text-white rounded-lg font-semibold">Descargar PDF</button>}
            {moduleKey === "consents" && item.documentUrl && <a href={item.documentUrl} target="_blank" className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-semibold">Abrir documento</a>}
          </div>
        </div>
      </div>
    </div>
  );
}

function formatDate(value: string) {
  return value ? new Date(value).toLocaleDateString() : "-";
}

function money(value: number) {
  return `$${Number(value || 0).toFixed(2)}`;
}
