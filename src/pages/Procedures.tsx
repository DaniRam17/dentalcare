import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiClient } from '../lib/apiClient';
import { Activity, Edit2, Eye, Plus, Search, ShieldAlert, Trash2, X } from 'lucide-react';

export const Procedures: React.FC = () => {
  const { user } = useAuth();
  const [types, setTypes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProcedure, setEditingProcedure] = useState<any>(null);
  const [viewingProcedure, setViewingProcedure] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: 0,
    risks: '',
    category: '',
    estimatedDuration: 30,
    taxType: 'ISV_15',
  });

  const fetchTypes = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get(`/procedures/types?search=${encodeURIComponent(search)}`);
      setTypes(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTypes();
  }, [search]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = { ...formData, price: Number(formData.price), estimatedDuration: Number(formData.estimatedDuration) };
      if (editingProcedure) {
        await apiClient.put(`/procedures/types/${editingProcedure.id}`, payload);
      } else {
        await apiClient.post('/procedures/types', payload);
      }
      setIsModalOpen(false);
      setEditingProcedure(null);
      setFormData({ name: '', description: '', price: 0, risks: '', category: '', estimatedDuration: 30, taxType: 'ISV_15' });
      fetchTypes();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const openEdit = (procedure: any) => {
    setEditingProcedure(procedure);
    setFormData({
      name: procedure.name || '',
      description: procedure.description || '',
      price: Number(procedure.price || 0),
      risks: procedure.risks || '',
      category: procedure.category || '',
      estimatedDuration: Number(procedure.estimatedDuration || 30),
      taxType: procedure.taxType || 'ISV_15',
    });
    setIsModalOpen(true);
  };

  const openNew = () => {
    setEditingProcedure(null);
    setFormData({ name: '', description: '', price: 0, risks: '', category: '', estimatedDuration: 30, taxType: 'ISV_15' });
    setIsModalOpen(true);
  };

  const removeProcedure = async (procedure: any) => {
    if (!confirm(`Inactivar el procedimiento ${procedure.procedureCode || procedure.name}?`)) return;
    try {
      await apiClient.delete(`/procedures/types/${procedure.id}`);
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
          <p className="text-zinc-500">Catalogo de tratamientos que luego se registran al paciente</p>
        </div>
        {user?.role === 'ADMIN' && (
          <button onClick={openNew} className="bg-zinc-900 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-zinc-800 transition-all">
            <Plus className="w-4 h-4" /> Nuevo tipo de procedimiento
          </button>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl overflow-hidden">
            <div className="p-6 border-b flex justify-between items-center bg-zinc-50">
              <h2 className="text-xl font-bold">{editingProcedure ? 'Editar procedimiento' : 'Nuevo tipo de procedimiento'}</h2>
              <button onClick={() => setIsModalOpen(false)}><X className="w-6 h-6" /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <Field label="Nombre del procedimiento">
                <input placeholder="Ej. Limpieza dental profunda" required className="w-full p-2 border rounded-lg" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
              </Field>
              <Field label="Descripcion clinica">
                <textarea placeholder="Que incluye, cuando se recomienda y alcance del tratamiento" className="w-full p-2 border rounded-lg" value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} />
              </Field>
              <Field label="Precio base">
                <input placeholder="0.00" type="number" min="0" step="0.01" required className="w-full p-2 border rounded-lg" value={formData.price} onChange={e => setFormData({ ...formData, price: Number(e.target.value) })} />
              </Field>
              <Field label="Categoria">
                <input placeholder="Ej. Preventivo" className="w-full p-2 border rounded-lg" value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })} />
              </Field>
              <Field label="Duracion estimada (min)">
                <input type="number" min="1" className="w-full p-2 border rounded-lg" value={formData.estimatedDuration} onChange={e => setFormData({ ...formData, estimatedDuration: Number(e.target.value) })} />
              </Field>
              <Field label="Tipo de impuesto">
                <select className="w-full p-2 border rounded-lg" value={formData.taxType} onChange={e => setFormData({ ...formData, taxType: e.target.value })}>
                  <option value="ISV_15">ISV 15%</option>
                  <option value="ISV_18">ISV 18%</option>
                  <option value="EXEMPT">Exento</option>
                </select>
              </Field>
              <Field label="Riesgos o cuidados">
                <textarea placeholder="Contraindicaciones, cuidados posteriores o riesgos asociados" className="w-full p-2 border rounded-lg" value={formData.risks} onChange={e => setFormData({ ...formData, risks: e.target.value })} />
              </Field>
              <button type="submit" className="w-full bg-emerald-600 text-white font-bold py-2 rounded-lg">Guardar</button>
            </form>
          </div>
        </div>
      )}

      <div className="bg-white border border-zinc-200 rounded-xl p-4 mb-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
          <input className="w-full pl-10 pr-4 py-2 border border-zinc-300 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500" placeholder="Buscar por codigo o nombre..." value={search} onChange={(event) => setSearch(event.target.value)} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full py-12 text-center text-zinc-400 italic">Cargando catalogo...</div>
        ) : types.length === 0 ? (
          <div className="col-span-full py-12 text-center text-zinc-400 italic">No hay procedimientos configurados</div>
        ) : (
          types.map((t) => (
            <div key={t.id} className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm hover:border-emerald-200 transition-all">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <p className="text-xs font-mono text-emerald-700">{t.procedureCode || '-'}</p>
                  <h3 className="font-bold text-zinc-900">{t.name}</h3>
                </div>
                <span className="text-emerald-600 font-bold">${Number(t.price || 0).toFixed(2)}</span>
              </div>
              <p className="text-sm text-zinc-500 mb-4 line-clamp-2">{t.description || 'Sin descripcion tecnica disponible.'}</p>
              <p className="text-xs text-zinc-500 mb-4">{t.category || 'Sin categoria'} · {t.estimatedDuration || '-'} min · {t.taxType || 'ISV_15'}</p>
              <div className="flex items-center gap-2 text-[10px] text-zinc-400 uppercase tracking-widest font-bold">
                <ShieldAlert className="w-3 h-3" /> Riesgos asociados
              </div>
              <p className="text-xs text-zinc-500 mt-2">{t.risks || 'Sin riesgos registrados.'}</p>
              <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-zinc-100">
                <button title="Ver detalle" onClick={() => setViewingProcedure(t)} className="p-2 text-zinc-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg"><Eye className="w-4 h-4" /></button>
                {user?.role === 'ADMIN' && <button title="Editar" onClick={() => openEdit(t)} className="p-2 text-zinc-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg"><Edit2 className="w-4 h-4" /></button>}
                {user?.role === 'ADMIN' && <button title="Inactivar" onClick={() => removeProcedure(t)} className="p-2 text-zinc-500 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4" /></button>}
              </div>
            </div>
          ))
        )}
      </div>

      {viewingProcedure && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl overflow-hidden">
            <div className="p-6 border-b flex justify-between items-center bg-zinc-50">
              <div>
                <p className="font-mono text-sm text-emerald-700">{viewingProcedure.procedureCode || '-'}</p>
                <h2 className="text-xl font-bold">{viewingProcedure.name}</h2>
              </div>
              <button onClick={() => setViewingProcedure(null)}><X className="w-6 h-6" /></button>
            </div>
            <div className="p-6 space-y-4">
              <Info label="Precio" value={`$${Number(viewingProcedure.price || 0).toFixed(2)}`} />
              <Info label="Categoria" value={viewingProcedure.category || 'Sin categoria'} />
              <Info label="Duracion" value={`${viewingProcedure.estimatedDuration || '-'} minutos`} />
              <Info label="Impuesto" value={viewingProcedure.taxType || 'ISV_15'} />
              <Info label="Descripcion" value={viewingProcedure.description || 'Sin descripcion'} />
              <Info label="Riesgos" value={viewingProcedure.risks || 'Sin riesgos registrados'} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

function Field({ label, children }: any) {
  return <div className="space-y-1"><label className="text-sm font-medium text-zinc-700">{label}</label>{children}</div>;
}

function Info({ label, value }: any) {
  return <div><p className="text-xs uppercase font-bold text-zinc-400">{label}</p><p className="text-sm text-zinc-800 mt-1">{value}</p></div>;
}
