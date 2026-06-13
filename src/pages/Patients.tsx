import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiClient } from '../lib/apiClient';
import { Users, Search, Edit2, Trash2, UserPlus, X } from 'lucide-react';

export const Patients: React.FC = () => {
  const { user } = useAuth();
  const [patients, setPatients] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPatient, setEditingPatient] = useState<any>(null);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    documentType: 'DNI',
    documentNumber: '',
    birthDate: '',
    gender: 'Masculino',
    phone: '',
    email: '',
  });

  const fetchPatients = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get(`/patients?search=${search}`);
      setPatients(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(fetchPatients, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingPatient) {
        await apiClient.put(`/patients/${editingPatient.id}`, formData);
      } else {
        await apiClient.post('/patients', formData);
      }
      setIsModalOpen(false);
      setEditingPatient(null);
      setFormData({
        firstName: '', lastName: '', documentType: 'DNI', documentNumber: '',
        birthDate: '', gender: 'Masculino', phone: '', email: ''
      });
      fetchPatients();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar este paciente?')) return;
    try {
      await apiClient.delete(`/patients/${id}`);
      fetchPatients();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const openEdit = (p: any) => {
    setEditingPatient(p);
    setFormData({
      firstName: p.firstName,
      lastName: p.lastName,
      documentType: p.documentType,
      documentNumber: p.documentNumber,
      birthDate: p.birthDate.split('T')[0],
      gender: p.gender,
      phone: p.phone,
      email: p.email || '',
    });
    setIsModalOpen(true);
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 flex items-center gap-2">
            <Users className="text-emerald-600" /> Pacientes
          </h1>
          <p className="text-zinc-500">Gestión de base de datos de pacientes</p>
        </div>
        {(user?.role === 'ADMIN' || user?.role === 'RECEPTIONIST') && (
          <button 
            onClick={() => { setEditingPatient(null); setIsModalOpen(true); }}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-all shadow-sm"
          >
            <UserPlus className="w-4 h-4" /> Nuevo Paciente
          </button>
        )}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-xl overflow-hidden">
            <div className="p-6 border-b border-zinc-100 flex justify-between items-center bg-zinc-50">
              <h2 className="text-xl font-bold text-zinc-900">
                {editingPatient ? 'Editar Paciente' : 'Nuevo Paciente'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-zinc-400 hover:text-zinc-600">
                <X className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-medium text-zinc-700">Nombre</label>
                <input required className="w-full p-2 border rounded-lg" value={formData.firstName} onChange={e => setFormData({...formData, firstName: e.target.value})} />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-zinc-700">Apellido</label>
                <input required className="w-full p-2 border rounded-lg" value={formData.lastName} onChange={e => setFormData({...formData, lastName: e.target.value})} />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-zinc-700">Tipo Documento</label>
                <select className="w-full p-2 border rounded-lg" value={formData.documentType} onChange={e => setFormData({...formData, documentType: e.target.value})}>
                  <option>DNI</option>
                  <option>Pasaporte</option>
                  <option>Cédula</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-zinc-700">Nro Documento</label>
                <input required className="w-full p-2 border rounded-lg" value={formData.documentNumber} onChange={e => setFormData({...formData, documentNumber: e.target.value})} />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-zinc-700">Fecha Nacimiento</label>
                <input required type="date" className="w-full p-2 border rounded-lg" value={formData.birthDate} onChange={e => setFormData({...formData, birthDate: e.target.value})} />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-zinc-700">Género</label>
                <select className="w-full p-2 border rounded-lg" value={formData.gender} onChange={e => setFormData({...formData, gender: e.target.value})}>
                  <option>Masculino</option>
                  <option>Femenino</option>
                  <option>Otro</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-zinc-700">Teléfono</label>
                <input required className="w-full p-2 border rounded-lg" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-zinc-700">Email</label>
                <input type="email" className="w-full p-2 border rounded-lg" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
              </div>
              <div className="md:col-span-2 flex justify-end gap-3 mt-4">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-zinc-600 hover:bg-zinc-100 rounded-lg">Cancelar</button>
                <button type="submit" className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-bold">Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-zinc-200 overflow-hidden">
        <div className="p-4 border-bottom border-zinc-100 bg-zinc-50/50">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input
              type="text"
              placeholder="Buscar por nombre, apellido o documento..."
              className="w-full pl-10 pr-4 py-2 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-zinc-50 text-zinc-500 text-xs uppercase tracking-wider font-semibold">
                <th className="px-6 py-4">Paciente</th>
                <th className="px-6 py-4">Documento</th>
                <th className="px-6 py-4">Contacto</th>
                <th className="px-6 py-4">Odontólogo</th>
                <th className="px-6 py-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {loading ? (
                <tr><td colSpan={5} className="px-6 py-8 text-center text-zinc-400">Cargando...</td></tr>
              ) : patients.length === 0 ? (
                <tr><td colSpan={5} className="px-6 py-8 text-center text-zinc-400">No se encontraron pacientes</td></tr>
              ) : (
                patients.map((p) => (
                  <tr key={p.id} className="hover:bg-zinc-50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="font-medium text-zinc-900">{p.firstName} {p.lastName}</div>
                      <div className="text-xs text-zinc-500">{new Date(p.birthDate).toLocaleDateString()}</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-zinc-600">{p.documentNumber}</td>
                    <td className="px-6 py-4 text-sm text-zinc-600">
                      <div>{p.phone}</div>
                      <div className="text-xs text-zinc-400">{p.email}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 bg-zinc-100 text-zinc-600 rounded text-xs">
                        {p.doctor ? `Dr. ${p.doctor.lastName}` : 'No asignado'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => openEdit(p)} className="p-2 text-zinc-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        {user?.role === 'ADMIN' && (
                          <button onClick={() => handleDelete(p.id)} className="p-2 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
