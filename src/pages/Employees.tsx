import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiClient } from '../lib/apiClient';
import { UserCog, Search, UserPlus, Edit2, Trash2, X } from 'lucide-react';

export const Employees: React.FC = () => {
  const { user } = useAuth();
  const [employees, setEmployees] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<any>(null);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    documentId: '',
    email: '',
    password: '',
    role: 'RECEPTIONIST',
    phone: '',
    address: '',
    salary: 0,
  });

  const fetchEmployees = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get(`/employees?search=${search}`);
      setEmployees(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, [search]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = { ...formData, salary: Number(formData.salary) };
      if (!editingEmployee && !payload.password) {
        alert('La contraseña es obligatoria para nuevos empleados');
        return;
      }
      if (editingEmployee) {
        if (!payload.password) delete (payload as any).password;
        await apiClient.put(`/employees/${editingEmployee.id}`, payload);
      } else {
        await apiClient.post('/employees', payload);
      }
      setIsModalOpen(false);
      fetchEmployees();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Estás seguro de desactivar este empleado?')) return;
    try {
      await apiClient.delete(`/employees/${id}`);
      fetchEmployees();
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 flex items-center gap-2">
            <UserCog className="text-emerald-600" /> Empleados
          </h1>
          <p className="text-zinc-500">Gestión del personal y roles de acceso</p>
        </div>
        <button 
          onClick={() => { setEditingEmployee(null); setIsModalOpen(true); }}
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg flex items-center gap-2"
        >
          <UserPlus className="w-4 h-4" /> Nuevo Empleado
        </button>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-xl overflow-hidden">
            <div className="p-6 border-b border-zinc-100 flex justify-between items-center bg-zinc-50">
              <h2 className="text-xl font-bold text-zinc-900">{editingEmployee ? 'Editar Empleado' : 'Nuevo Empleado'}</h2>
              <button onClick={() => setIsModalOpen(false)}><X className="w-6 h-6" /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              <input placeholder="Nombre" required className="p-2 border rounded-lg" value={formData.firstName} onChange={e => setFormData({...formData, firstName: e.target.value})} />
              <input placeholder="Apellido" required className="p-2 border rounded-lg" value={formData.lastName} onChange={e => setFormData({...formData, lastName: e.target.value})} />
              <input placeholder="Documento ID" required className="p-2 border rounded-lg" value={formData.documentId} onChange={e => setFormData({...formData, documentId: e.target.value})} />
              <input placeholder="Email" required type="email" className="p-2 border rounded-lg" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
              <input placeholder={editingEmployee ? "Contraseña (dejar vacío para no cambiar)" : "Contraseña"} type="password" className="p-2 border rounded-lg" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} />
              <select className="p-2 border rounded-lg" value={formData.role} onChange={e => setFormData({...formData, role: e.target.value as any})}>
                <option value="ADMIN">ADMIN</option>
                <option value="DOCTOR">DOCTOR</option>
                <option value="RECEPTIONIST">RECEPTIONIST</option>
                <option value="NURSE">NURSE</option>
              </select>
              <input placeholder="Teléfono" className="p-2 border rounded-lg" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
              <input placeholder="Salario" type="number" className="p-2 border rounded-lg" value={formData.salary} onChange={e => setFormData({...formData, salary: Number(e.target.value)})} />
              <div className="md:col-span-2 flex justify-end gap-3 mt-4">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-zinc-600">Cancelar</button>
                <button type="submit" className="px-6 py-2 bg-emerald-600 text-white rounded-lg font-bold">Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-zinc-200 overflow-hidden">
        <div className="p-4 bg-zinc-50/50">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input
              type="text"
              placeholder="Buscar por nombre o email..."
              className="w-full pl-10 pr-4 py-2 border border-zinc-300 rounded-lg outline-none"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        <table className="w-full text-left">
          <thead>
            <tr className="bg-zinc-50 text-zinc-500 text-xs uppercase font-semibold">
              <th className="px-6 py-4">Empleado</th>
              <th className="px-6 py-4">Rol</th>
              <th className="px-6 py-4">Contacto</th>
              <th className="px-6 py-4 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {employees.map((emp) => (
              <tr key={emp.id} className="hover:bg-zinc-50 group">
                <td className="px-6 py-4">
                  <div className="font-medium text-zinc-900">{emp.firstName} {emp.lastName}</div>
                  <div className="text-xs text-zinc-500">{emp.documentId}</div>
                </td>
                <td className="px-6 py-4">
                  <span className="px-2 py-1 bg-zinc-100 text-zinc-600 rounded text-xs font-bold">{emp.role}</span>
                </td>
                <td className="px-6 py-4 text-sm text-zinc-600">
                  <div>{emp.email}</div>
                  <div className="text-xs text-zinc-400">{emp.phone}</div>
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => { setEditingEmployee(emp); setFormData({...emp, password: ''}); setIsModalOpen(true); }} className="p-2 text-zinc-400 hover:text-emerald-600"><Edit2 className="w-4 h-4" /></button>
                    <button onClick={() => handleDelete(emp.id)} className="p-2 text-zinc-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
