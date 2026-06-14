import React, { useEffect, useState } from 'react';
import { apiClient } from '../lib/apiClient';
import { Calendar as CalendarIcon, CheckCircle, ChevronLeft, ChevronRight, Clock, Search, Stethoscope, X, XCircle } from 'lucide-react';
import { addDays, eachDayOfInterval, endOfMonth, endOfWeek, format, startOfMonth, startOfWeek } from 'date-fns';
import { es } from 'date-fns/locale';

type ViewMode = 'day' | 'week' | 'month';

export const Appointments: React.FC = () => {
  const [appointments, setAppointments] = useState<any[]>([]);
  const [patients, setPatients] = useState<any[]>([]);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [procedureTypes, setProcedureTypes] = useState<any[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('day');
  const [filters, setFilters] = useState({ search: '', status: '', doctorId: '', patientId: '' });
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    patientId: '',
    doctorId: '',
    procedureTypeId: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    type: 'CONSULTATION',
    description: '',
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const range = getDateRange(currentDate, viewMode);
      const params = new URLSearchParams({
        startDate: format(range.start, 'yyyy-MM-dd'),
        endDate: format(range.end, 'yyyy-MM-dd'),
      });
      if (filters.search) params.set('search', filters.search);
      if (filters.status) params.set('status', filters.status);
      if (filters.doctorId) params.set('doctorId', filters.doctorId);
      if (filters.patientId) params.set('patientId', filters.patientId);

      const [aptRes, patRes, docRes, procRes] = await Promise.all([
        apiClient.get(`/appointments?${params.toString()}`),
        apiClient.get('/patients'),
        apiClient.get('/employees?role=DOCTOR'),
        apiClient.get('/procedures/types'),
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
    const timer = setTimeout(fetchData, 250);
    return () => clearTimeout(timer);
  }, [currentDate, viewMode, filters]);

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
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 flex items-center gap-2">
            <CalendarIcon className="text-emerald-600" /> Agenda
          </h1>
          <p className="text-zinc-500">Programacion y gestion de citas por dia, semana o mes</p>
        </div>
        <div className="flex items-center gap-2 bg-white p-1 rounded-xl border border-zinc-200 shadow-sm">
          {(['day', 'week', 'month'] as const).map((mode) => (
            <button key={mode} onClick={() => setViewMode(mode)} className={`px-3 py-2 rounded-lg text-sm font-bold ${viewMode === mode ? 'bg-emerald-600 text-white' : 'text-zinc-500 hover:bg-zinc-50'}`}>
              {mode === 'day' ? 'Dia' : mode === 'week' ? 'Semana' : 'Mes'}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white border border-zinc-200 rounded-xl p-4 mb-6 grid grid-cols-1 md:grid-cols-5 gap-3">
        <div className="relative md:col-span-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
          <input className="w-full pl-10 pr-4 py-2 border border-zinc-300 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500" placeholder="Buscar por codigo, paciente o doctor..." value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} />
        </div>
        <select className="p-2 border rounded-lg" value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
          <option value="">Todos los estados</option>
          <option value="SCHEDULED">Programada</option>
          <option value="CONFIRMED">Confirmada</option>
          <option value="ATTENDED">Atendida</option>
          <option value="CANCELLED">Cancelada</option>
          <option value="NO_SHOW">No asistio</option>
        </select>
        <select className="p-2 border rounded-lg" value={filters.doctorId} onChange={(e) => setFilters({ ...filters, doctorId: e.target.value })}>
          <option value="">Todos los doctores</option>
          {doctors.map((d) => <option key={d.id} value={d.id}>Dr. {d.lastName}</option>)}
        </select>
        <button className="px-3 py-2 bg-zinc-100 text-zinc-700 rounded-lg font-bold" onClick={() => setFilters({ search: '', status: '', doctorId: '', patientId: '' })}>Limpiar filtros</button>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl overflow-hidden">
            <div className="p-6 border-b flex justify-between items-center bg-zinc-50">
              <h2 className="text-xl font-bold">Nueva Cita</h2>
              <button onClick={() => setIsModalOpen(false)}><X className="w-6 h-6" /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <Field label="Paciente">
                <select required className="w-full p-2 border rounded-lg" value={formData.patientId} onChange={e => setFormData({ ...formData, patientId: e.target.value })}>
                  <option value="">Seleccionar paciente...</option>
                  {patients.map(p => <option key={p.id} value={p.id}>{p.patientCode || 'SIN-COD'} - {p.firstName} {p.lastName}</option>)}
                </select>
              </Field>
              <Field label="Odontologo">
                <select required className="w-full p-2 border rounded-lg" value={formData.doctorId} onChange={e => setFormData({ ...formData, doctorId: e.target.value })}>
                  <option value="">Seleccionar doctor...</option>
                  {doctors.map(d => <option key={d.id} value={d.id}>Dr. {d.lastName}</option>)}
                </select>
              </Field>
              <Field label="Fecha">
                <input required type="date" className="w-full p-2 border rounded-lg" value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} />
              </Field>
              <Field label="Procedimiento">
                <select className="w-full p-2 border rounded-lg" value={formData.procedureTypeId} onChange={e => setFormData({ ...formData, procedureTypeId: e.target.value })}>
                  <option value="">Sin procedimiento asociado</option>
                  {procedureTypes.map(p => <option key={p.id} value={p.id}>{p.procedureCode || 'SIN-COD'} - {p.name}</option>)}
                </select>
              </Field>
              <Field label="Tipo de servicio">
                <select className="w-full p-2 border rounded-lg" value={formData.type} onChange={e => setFormData({ ...formData, type: e.target.value })}>
                  <option value="CONSULTATION">Consulta general</option>
                  <option value="EXAM">Examen</option>
                  <option value="XRAY">Radiografia</option>
                  <option value="CLEANING">Limpieza</option>
                </select>
              </Field>
              <textarea placeholder="Descripcion..." className="w-full p-2 border rounded-lg" value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} />
              <button type="submit" className="w-full bg-emerald-600 text-white font-bold py-2 rounded-lg">Agendar</button>
            </form>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between bg-white border border-zinc-200 rounded-xl p-3">
            <button onClick={() => setCurrentDate(addDays(currentDate, viewMode === 'month' ? -30 : viewMode === 'week' ? -7 : -1))} className="p-2 hover:bg-zinc-100 rounded-lg"><ChevronLeft className="w-5 h-5" /></button>
            <span className="font-semibold text-zinc-900 text-center capitalize">{periodLabel(currentDate, viewMode)}</span>
            <button onClick={() => setCurrentDate(addDays(currentDate, viewMode === 'month' ? 30 : viewMode === 'week' ? 7 : 1))} className="p-2 hover:bg-zinc-100 rounded-lg"><ChevronRight className="w-5 h-5" /></button>
          </div>
          {viewMode === 'month' && <MonthCalendar date={currentDate} appointments={appointments} onSelectDay={(date: Date) => { setCurrentDate(date); setViewMode('day'); }} />}
          {loading ? (
            <div className="bg-white p-12 rounded-xl border text-center text-zinc-400">Cargando agenda...</div>
          ) : appointments.length === 0 ? (
            <div className="bg-white p-12 rounded-xl border text-center">
              <CalendarIcon className="w-12 h-12 text-zinc-200 mx-auto mb-4" />
              <p className="text-zinc-500">No hay citas programadas en este periodo</p>
            </div>
          ) : (
            appointments.map((apt) => (
              <div key={apt.id} className="bg-white p-4 rounded-xl border border-zinc-200 shadow-sm hover:border-emerald-200 transition-all group">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex gap-4">
                    <div className="w-16 h-16 bg-zinc-50 rounded-lg flex flex-col items-center justify-center border border-zinc-100">
                      <Clock className="w-4 h-4 text-zinc-400 mb-1" />
                      <span className="text-xs font-bold text-zinc-900 text-center">{format(new Date(apt.date), 'dd/MM/yyyy')}</span>
                    </div>
                    <div>
                      <p className="text-xs font-mono text-emerald-700">{apt.appointmentCode || '-'}</p>
                      <h3 className="font-bold text-zinc-900">{apt.patient.firstName} {apt.patient.lastName}</h3>
                      <div className="flex flex-wrap items-center gap-4 mt-1">
                        <span className="flex items-center gap-1 text-xs text-zinc-500"><Stethoscope className="w-3 h-3" /> Dr. {apt.doctor.lastName}</span>
                        <span className="flex items-center gap-1 text-xs text-zinc-500 uppercase tracking-wider">{apt.type}</span>
                        {apt.procedureType && <span className="flex items-center gap-1 text-xs text-zinc-500">{apt.procedureType.procedureCode} - {apt.procedureType.name}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <StatusBadge status={apt.status} />
                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      {apt.status !== 'ATTENDED' && apt.status !== 'CANCELLED' && (
                        <>
                          <button title="Confirmar" onClick={() => updateStatus(apt.id, 'CONFIRMED')} className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"><CheckCircle className="w-4 h-4" /></button>
                          <button title="Cancelar" onClick={() => confirm('Cancelar esta cita?') && updateStatus(apt.id, 'CANCELLED')} className="p-1 text-red-600 hover:bg-red-50 rounded"><XCircle className="w-4 h-4" /></button>
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

function Field({ label, children }: any) {
  return <div className="space-y-1"><label className="text-sm font-medium">{label}</label>{children}</div>;
}

function getDateRange(date: Date, mode: ViewMode) {
  if (mode === 'month') return { start: startOfMonth(date), end: endOfMonth(date) };
  if (mode === 'week') return { start: startOfWeek(date, { weekStartsOn: 1 }), end: endOfWeek(date, { weekStartsOn: 1 }) };
  return { start: date, end: date };
}

function periodLabel(date: Date, mode: ViewMode) {
  if (mode === 'month') return format(date, 'MMMM yyyy', { locale: es });
  if (mode === 'week') return `${format(startOfWeek(date, { weekStartsOn: 1 }), 'dd/MM')} - ${format(endOfWeek(date, { weekStartsOn: 1 }), 'dd/MM/yyyy')}`;
  return format(date, "EEEE, d 'de' MMMM yyyy", { locale: es });
}

function MonthCalendar({ date, appointments, onSelectDay }: any) {
  const days = eachDayOfInterval({ start: startOfMonth(date), end: endOfMonth(date) });
  return (
    <div className="bg-white border border-zinc-200 rounded-xl p-4 grid grid-cols-7 gap-2">
      {days.map((day) => {
        const dayAppointments = appointments.filter((apt: any) => format(new Date(apt.date), 'yyyy-MM-dd') === format(day, 'yyyy-MM-dd'));
        return (
          <button key={day.toISOString()} onClick={() => onSelectDay(day)} className="min-h-24 p-2 text-left border border-zinc-100 rounded-lg hover:border-emerald-300 hover:bg-emerald-50">
            <div className="flex justify-between items-center">
              <span className="font-bold text-sm">{format(day, 'd')}</span>
              {dayAppointments.length > 0 && <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">{dayAppointments.length}</span>}
            </div>
            <div className="mt-2 space-y-1">
              {dayAppointments.slice(0, 2).map((apt: any) => <p key={apt.id} className="text-[10px] truncate text-zinc-600">{apt.patient.firstName} {apt.patient.lastName}</p>)}
            </div>
          </button>
        );
      })}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    SCHEDULED: 'bg-blue-50 text-blue-600',
    CONFIRMED: 'bg-emerald-50 text-emerald-600',
    ATTENDED: 'bg-zinc-100 text-zinc-600',
    CANCELLED: 'bg-red-50 text-red-600',
    NO_SHOW: 'bg-amber-50 text-amber-700',
  };
  return <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${styles[status] || 'bg-zinc-100 text-zinc-600'}`}>{status}</span>;
}
