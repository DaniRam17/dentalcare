import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiClient } from '../lib/apiClient';
import { Calendar as CalendarIcon, Clock, Stethoscope, ChevronLeft, ChevronRight, Plus, X, CheckCircle, XCircle } from 'lucide-react';
import { format, addDays } from 'date-fns';
import { es } from 'date-fns/locale';

export const Appointments: React.FC = () => {
  const { token, user } = useAuth();
  const [appointments, setAppointments] = useState<any[]>([]);
  const [patients, setPatients] = useState<any[]>([]);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [procedureTypes, setProcedureTypes] = useState<any[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    patientId: '',
    doctorId: '',
    procedureTypeId: '',
    date: format(new Date(), "yyyy-MM-dd"),
    type: 'CONSULTATION',
    description: '',
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [aptRes, patRes, docRes, procRes] = await Promise.all([
        apiClient.get(`/appointments?date=${format(currentDate, 'yyyy-MM-dd')}`),
        apiClient.get('/patients'),
        apiClient.get('/employees?role=DOCTOR'),
        apiClient.get('/procedures/types')
      ]);
      setAppointments(aptRes);
      setPatients(patRes.data);
      setDoctors(docRes);
      setProcedureTypes(procRes);
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
      await apiClient.post('/appointments', { ...formData, procedureTypeId: formData.procedureTypeId || null });
      setIsModalOpen(false);
      fetchData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const updateStatus = async (id: string, status: string) => {
    try {
      await apiClient.patch(`/appointments/${id}`, { status });
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
            <CalendarIcon className="text-emerald-600" /> Agenda
          </h1>
          <p className="text-zinc-500">Programación y gestión de citas diarias</p>
        </div>
        <div className="flex items-center gap-4 bg-white p-1 rounded-xl border border-zinc-200 shadow-sm">
          <button onClick={() => setCurrentDate(addDays(currentDate, -1))} className="p-2 hover:bg-zinc-100 rounded-lg"><ChevronLeft className="w-5 h-5" /></button>
          <span className="font-semibold text-zinc-900 min-w-[150px] text-center">{format(currentDate, "EEEE, d 'de' MMMM", { locale: es })}</span>
          <button onClick={() => setCurrentDate(addDays(currentDate, 1))} className="p-2 hover:bg-zinc-100 rounded-lg"><ChevronRight className="w-5 h-5" /></button>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl overflow-hidden">
            <div className="p-6 border-b flex justify-between items-center bg-zinc-50">
              <h2 className="text-xl font-bold">Nueva Cita</h2>
              <button onClick={() => setIsModalOpen(false)}><X className="w-6 h-6" /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-sm font-medium">Paciente</label>
                <select required className="w-full p-2 border rounded-lg" value={formData.patientId} onChange={e => setFormData({...formData, patientId: e.target.value})}>
                  <option value="">Seleccionar paciente...</option>
                  {patients.map(p => <option key={p.id} value={p.id}>{p.patientCode || 'SIN-COD'} - {p.firstName} {p.lastName}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Odontólogo</label>
                <select required className="w-full p-2 border rounded-lg" value={formData.doctorId} onChange={e => setFormData({...formData, doctorId: e.target.value})}>
                  <option value="">Seleccionar doctor...</option>
                  {doctors.map(d => <option key={d.id} value={d.id}>Dr. {d.lastName}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Fecha</label>
                <input required type="date" className="w-full p-2 border rounded-lg" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Procedimiento</label>
                <select className="w-full p-2 border rounded-lg" value={formData.procedureTypeId} onChange={e => setFormData({...formData, procedureTypeId: e.target.value})}>
                  <option value="">Sin procedimiento asociado</option>
                  {procedureTypes.map(p => <option key={p.id} value={p.id}>{p.procedureCode || 'SIN-COD'} - {p.name}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Tipo de Servicio</label>
                <select className="w-full p-2 border rounded-lg" value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})}>
                  <option value="CONSULTATION">Consulta General</option>
                  <option value="EXAM">Examen</option>
                  <option value="XRAY">Radiografía</option>
                  <option value="CLEANING">Limpieza</option>
                </select>
              </div>
              <textarea placeholder="Descripción..." className="w-full p-2 border rounded-lg" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
              <button type="submit" className="w-full bg-emerald-600 text-white font-bold py-2 rounded-lg">Agendar</button>
            </form>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          {loading ? (
            <div className="bg-white p-12 rounded-xl border text-center text-zinc-400">Cargando agenda...</div>
          ) : appointments.length === 0 ? (
            <div className="bg-white p-12 rounded-xl border text-center">
              <CalendarIcon className="w-12 h-12 text-zinc-200 mx-auto mb-4" />
              <p className="text-zinc-500">No hay citas programadas</p>
            </div>
          ) : (
            appointments.map((apt) => (
              <div key={apt.id} className="bg-white p-4 rounded-xl border border-zinc-200 shadow-sm hover:border-emerald-200 transition-all group">
                <div className="flex items-start justify-between">
                  <div className="flex gap-4">
                    <div className="w-16 h-16 bg-zinc-50 rounded-lg flex flex-col items-center justify-center border border-zinc-100">
                      <Clock className="w-4 h-4 text-zinc-400 mb-1" />
                      <span className="text-xs font-bold text-zinc-900 text-center">{format(new Date(apt.date), 'dd/MM/yyyy')}</span>
                    </div>
                    <div>
                      <p className="text-xs font-mono text-emerald-700">{apt.appointmentCode || '-'}</p>
                      <h3 className="font-bold text-zinc-900">{apt.patient.firstName} {apt.patient.lastName}</h3>
                      <div className="flex items-center gap-4 mt-1">
                        <span className="flex items-center gap-1 text-xs text-zinc-500"><Stethoscope className="w-3 h-3" /> Dr. {apt.doctor.lastName}</span>
                        <span className="flex items-center gap-1 text-xs text-zinc-500 uppercase tracking-wider">{apt.type}</span>
                        {apt.procedureType && <span className="flex items-center gap-1 text-xs text-zinc-500">{apt.procedureType.procedureCode} - {apt.procedureType.name}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${
                      apt.status === 'SCHEDULED' ? 'bg-blue-50 text-blue-600' :
                      apt.status === 'CONFIRMED' ? 'bg-emerald-50 text-emerald-600' :
                      apt.status === 'ATTENDED' ? 'bg-zinc-100 text-zinc-600' : 'bg-red-50 text-red-600'
                    }`}>{apt.status}</span>
                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      {apt.status !== 'ATTENDED' && apt.status !== 'CANCELLED' && (
                        <>
                          <button onClick={() => updateStatus(apt.id, 'CONFIRMED')} className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"><CheckCircle className="w-4 h-4" /></button>
                          <button onClick={() => updateStatus(apt.id, 'CANCELLED')} className="p-1 text-red-600 hover:bg-red-50 rounded"><XCircle className="w-4 h-4" /></button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="space-y-6">
          <div className="bg-emerald-900 text-white p-6 rounded-2xl shadow-lg">
            <h2 className="text-lg font-bold mb-2">Nueva Cita</h2>
            <p className="text-emerald-100 text-sm mb-6 opacity-80">Agendar un nuevo servicio para un paciente.</p>
            <button onClick={() => setIsModalOpen(true)} className="w-full bg-white text-emerald-900 font-bold py-3 rounded-xl hover:bg-emerald-50 transition-colors">Programar Ahora</button>
          </div>
        </div>
      </div>
    </div>
  );
};
