import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiClient } from '../lib/apiClient';
import { FileText, Search, Plus, X, Trash2 } from 'lucide-react';

export const Prescriptions: React.FC = () => {
  const { user } = useAuth();
  const [prescriptions, setPrescriptions] = useState<any[]>([]);
  const [patients, setPatients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    patientId: '',
    items: [{ drugName: '', presentation: 'PILL', dosage: '', frequency: '', duration: '' }]
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [presRes, patRes] = await Promise.all([
        apiClient.get('/prescriptions'),
        apiClient.get('/patients')
      ]);
      setPrescriptions(presRes);
      setPatients(patRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const addItem = () => {
    setFormData({
      ...formData,
      items: [...formData.items, { drugName: '', presentation: 'PILL', dosage: '', frequency: '', duration: '' }]
    });
  };

  const removeItem = (index: number) => {
    setFormData({
      ...formData,
      items: formData.items.filter((_, i) => i !== index)
    });
  };

  const updateItem = (index: number, field: string, value: string) => {
    const newItems = [...formData.items];
    (newItems[index] as any)[field] = value;
    setFormData({ ...formData, items: newItems });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiClient.post('/prescriptions', formData);
      setIsModalOpen(false);
      fetchData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const downloadPdf = async (prescription: any) => {
    try {
      await apiClient.download(`/prescriptions/${prescription.id}/pdf`, `receta-${String(prescription.correlative).padStart(4, '0')}.pdf`);
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 flex items-center gap-2">
            <FileText className="text-emerald-600" /> Recetas Médicas
          </h1>
          <p className="text-zinc-500">Historial y emisión de prescripciones electrónicas</p>
        </div>
        {(user?.role === 'ADMIN' || user?.role === 'DOCTOR') && (
          <button onClick={() => setIsModalOpen(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-all shadow-sm">
            <Plus className="w-4 h-4" /> Nueva Receta
          </button>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-3xl shadow-xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="p-6 border-b flex justify-between items-center bg-zinc-50">
              <h2 className="text-xl font-bold">Emitir Nueva Receta</h2>
              <button onClick={() => setIsModalOpen(false)}><X className="w-6 h-6" /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 flex-1 overflow-auto space-y-6">
              <div className="space-y-1">
                <label className="text-sm font-medium">Paciente</label>
                <select required className="w-full p-2 border rounded-lg" value={formData.patientId} onChange={e => setFormData({...formData, patientId: e.target.value})}>
                  <option value="">Seleccionar paciente...</option>
                  {patients.map(p => <option key={p.id} value={p.id}>{p.firstName} {p.lastName}</option>)}
                </select>
              </div>
              
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="font-bold text-zinc-700">Medicamentos</h3>
                  <button type="button" onClick={addItem} className="text-emerald-600 text-sm font-bold">+ Añadir</button>
                </div>
                {formData.items.map((item, index) => (
                  <div key={index} className="p-4 border rounded-xl space-y-3 relative bg-zinc-50/50">
                    <button type="button" onClick={() => removeItem(index)} className="absolute top-2 right-2 text-red-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                    <div className="grid grid-cols-2 gap-3">
                      <input placeholder="Nombre del fármaco" required className="p-2 border rounded-lg" value={item.drugName} onChange={e => updateItem(index, 'drugName', e.target.value)} />
                      <select className="p-2 border rounded-lg" value={item.presentation} onChange={e => updateItem(index, 'presentation', e.target.value)}>
                        <option value="PILL">Pastilla</option>
                        <option value="INJECTION">Inyección</option>
                        <option value="SYRUP">Jarabe</option>
                        <option value="CREAM">Crema</option>
                      </select>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <input placeholder="Dosis" required className="p-2 border rounded-lg" value={item.dosage} onChange={e => updateItem(index, 'dosage', e.target.value)} />
                      <input placeholder="Frecuencia" required className="p-2 border rounded-lg" value={item.frequency} onChange={e => updateItem(index, 'frequency', e.target.value)} />
                      <input placeholder="Duración" required className="p-2 border rounded-lg" value={item.duration} onChange={e => updateItem(index, 'duration', e.target.value)} />
                    </div>
                  </div>
                ))}
              </div>
              <button type="submit" className="w-full bg-emerald-600 text-white font-bold py-3 rounded-xl">Emitir Receta</button>
            </form>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-zinc-200 overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-zinc-50 text-zinc-500 text-xs uppercase font-semibold">
              <th className="px-6 py-4">Correlativo</th>
              <th className="px-6 py-4">Paciente</th>
              <th className="px-6 py-4">Fecha</th>
              <th className="px-6 py-4">Medicamentos</th>
              <th className="px-6 py-4 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {prescriptions.map((p) => (
              <tr key={p.id} className="hover:bg-zinc-50">
                <td className="px-6 py-4 font-bold text-emerald-600">#{String(p.correlative).padStart(4, '0')}</td>
                <td className="px-6 py-4 font-medium">{p.patient.firstName} {p.patient.lastName}</td>
                <td className="px-6 py-4 text-sm text-zinc-500">{new Date(p.date).toLocaleDateString()}</td>
                <td className="px-6 py-4 text-sm text-zinc-600">{p.items.length} items</td>
                <td className="px-6 py-4 text-right">
                  <button onClick={() => downloadPdf(p)} className="text-emerald-600 hover:underline text-sm font-bold">Descargar PDF</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
