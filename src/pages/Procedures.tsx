import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiClient } from '../lib/apiClient';
import { Activity, Search, Settings, ShieldAlert, Plus, X } from 'lucide-react';

export const Procedures: React.FC = () => {
  const { user } = useAuth();
  const [types, setTypes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: 0,
    risks: '',
  });

  const fetchTypes = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/procedures/types');
      setTypes(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTypes();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiClient.post('/procedures/types', { ...formData, price: Number(formData.price) });
      setIsModalOpen(false);
      fetchTypes();
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 flex items-center gap-2">
            <Activity className="text-emerald-600" /> Procedimientos
          </h1>
          <p className="text-zinc-500">Catálogo de intervenciones y registro clínico</p>
        </div>
        {user?.role === 'ADMIN' && (
          <button onClick={() => setIsModalOpen(true)} className="bg-zinc-900 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-zinc-800 transition-all">
            <Plus className="w-4 h-4" /> Nuevo Procedimiento
          </button>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl overflow-hidden">
            <div className="p-6 border-b flex justify-between items-center bg-zinc-50">
              <h2 className="text-xl font-bold">Nuevo Tipo de Procedimiento</h2>
              <button onClick={() => setIsModalOpen(false)}><X className="w-6 h-6" /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <input placeholder="Nombre" required className="w-full p-2 border rounded-lg" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
              <textarea placeholder="Descripción" className="w-full p-2 border rounded-lg" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
              <input placeholder="Precio" type="number" required className="w-full p-2 border rounded-lg" value={formData.price} onChange={e => setFormData({...formData, price: Number(e.target.value)})} />
              <textarea placeholder="Riesgos" className="w-full p-2 border rounded-lg" value={formData.risks} onChange={e => setFormData({...formData, risks: e.target.value})} />
              <button type="submit" className="w-full bg-emerald-600 text-white font-bold py-2 rounded-lg">Guardar</button>
            </form>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full py-12 text-center text-zinc-400 italic">Cargando catálogo...</div>
        ) : types.length === 0 ? (
          <div className="col-span-full py-12 text-center text-zinc-400 italic">No hay procedimientos configurados</div>
        ) : (
          types.map((t) => (
            <div key={t.id} className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm hover:border-emerald-200 transition-all">
              <div className="flex justify-between items-start mb-4">
                <h3 className="font-bold text-zinc-900">{t.name}</h3>
                <span className="text-emerald-600 font-bold">${t.price}</span>
              </div>
              <p className="text-sm text-zinc-500 mb-6 line-clamp-2">{t.description || 'Sin descripción técnica disponible.'}</p>
              <div className="flex items-center gap-2 text-[10px] text-zinc-400 uppercase tracking-widest font-bold">
                <ShieldAlert className="w-3 h-3" /> Riesgos asociados
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
