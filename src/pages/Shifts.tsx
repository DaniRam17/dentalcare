import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiClient } from '../lib/apiClient';
import { Clock, Calendar as CalendarIcon, UserPlus, X, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { format, addDays } from 'date-fns';
import { es } from 'date-fns/locale';

export const Shifts: React.FC = () => {
  const { user } = useAuth();
  const [shifts, setShifts] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    employeeId: '',
    shiftId: '',
    date: format(new Date(), 'yyyy-MM-dd'),
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [shiftsRes, assignRes, empRes] = await Promise.all([
        apiClient.get('/shifts'),
        apiClient.get(`/shifts/assignments?date=${format(currentDate, 'yyyy-MM-dd')}`),
        apiClient.get('/employees')
      ]);
      setShifts(shiftsRes);
      setAssignments(assignRes);
      setEmployees(empRes);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [currentDate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiClient.post('/shifts/assignments', formData);
      setIsModalOpen(false);
      fetchData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 flex items-center gap-2">
            <Clock className="text-emerald-600" /> Turnos y Horarios
          </h1>
          <p className="text-zinc-500">Asignación de jornadas laborales para el personal</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-white p-1 rounded-xl border border-zinc-200 shadow-sm">
            <button onClick={() => setCurrentDate(addDays(currentDate, -1))} className="p-2 hover:bg-zinc-100 rounded-lg"><ChevronLeft className="w-4 h-4" /></button>
            <span className="font-semibold text-sm min-w-[120px] text-center">{format(currentDate, "d 'de' MMM", { locale: es })}</span>
            <button onClick={() => setCurrentDate(addDays(currentDate, 1))} className="p-2 hover:bg-zinc-100 rounded-lg"><ChevronRight className="w-4 h-4" /></button>
          </div>
          {user?.role === 'ADMIN' && (
            <button onClick={() => setIsModalOpen(true)} className="bg-emerald-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-bold">
              <UserPlus className="w-4 h-4" /> Asignar Turno
            </button>
          )}
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl overflow-hidden">
            <div className="p-6 border-b flex justify-between items-center bg-zinc-50">
              <h2 className="text-xl font-bold">Asignar Turno</h2>
              <button onClick={() => setIsModalOpen(false)}><X className="w-6 h-6" /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-sm font-medium">Empleado</label>
                <select required className="w-full p-2 border rounded-lg" value={formData.employeeId} onChange={e => setFormData({...formData, employeeId: e.target.value})}>
                  <option value="">Seleccionar empleado...</option>
                  {employees.map(e => <option key={e.id} value={e.id}>{e.firstName} {e.lastName} ({e.role})</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Turno</label>
                <select required className="w-full p-2 border rounded-lg" value={formData.shiftId} onChange={e => setFormData({...formData, shiftId: e.target.value})}>
                  <option value="">Seleccionar turno...</option>
                  {shifts.map(s => <option key={s.id} value={s.id}>{s.name} ({s.startTime} - {s.endTime})</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Fecha</label>
                <input required type="date" className="w-full p-2 border rounded-lg" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} />
              </div>
              <button type="submit" className="w-full bg-emerald-600 text-white font-bold py-2 rounded-lg">Confirmar Asignación</button>
            </form>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full py-12 text-center text-zinc-400">Cargando asignaciones...</div>
        ) : assignments.length === 0 ? (
          <div className="col-span-full py-12 text-center bg-white rounded-2xl border border-dashed border-zinc-300">
            <Clock className="w-12 h-12 text-zinc-200 mx-auto mb-4" />
            <p className="text-zinc-500">No hay turnos asignados para este día</p>
          </div>
        ) : (
          assignments.map((as) => (
            <div key={as.id} className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-600 font-bold">
                {as.employee.firstName[0]}{as.employee.lastName[0]}
              </div>
              <div>
                <h3 className="font-bold text-zinc-900">{as.employee.firstName} {as.employee.lastName}</h3>
                <p className="text-xs text-zinc-500 uppercase tracking-widest font-bold mb-1">{as.employee.role}</p>
                <div className="flex items-center gap-2 text-sm text-zinc-600">
                  <span className="px-2 py-0.5 bg-zinc-100 rounded font-medium">{as.shift.name}</span>
                  <span>{as.shift.startTime} - {as.shift.endTime}</span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
