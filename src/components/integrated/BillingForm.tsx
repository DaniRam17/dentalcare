import type { ReactNode } from "react";
import { Trash2 } from "lucide-react";
import { Field } from "./FormControls";

type BillingFormProps = {
  form: any;
  setForm: (form: any) => void;
  lookups: any;
  patientSelect: ReactNode;
};

export function BillingForm({ form, setForm, lookups, patientSelect }: BillingFormProps) {
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
