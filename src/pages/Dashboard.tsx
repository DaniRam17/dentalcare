import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Activity, BarChart3, Calendar, TrendingUp, Users } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

export const Dashboard: React.FC = () => {
  const { token } = useAuth();
  const [stats, setStats] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch('/api/reports/dashboard', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        setStats(data.productivity || []);
        setSummary(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, [token]);

  const cards = [
    { label: 'Pacientes Totales', value: summary?.cards?.patientsTotal ?? 0, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Citas Hoy', value: summary?.cards?.appointmentsToday ?? 0, icon: Calendar, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Pendientes Facturar', value: summary?.cards?.pendingBilling ?? 0, icon: Activity, color: 'text-purple-600', bg: 'bg-purple-50' },
    { label: 'Alertas CAI/SAR', value: summary?.cards?.fiscalAlerts ?? 0, icon: BarChart3, color: 'text-red-600', bg: 'bg-red-50' },
    { label: 'Ingresos Mes', value: `$${Number(summary?.cards?.revenueMonth || 0).toFixed(2)}`, icon: TrendingUp, color: 'text-orange-600', bg: 'bg-orange-50' },
  ];
  const colors = ['#059669', '#2563eb', '#9333ea', '#ea580c'];

  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-zinc-900">Panel de Control</h1>
        <p className="text-zinc-500">Metricas clave conectadas a la base de datos</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-6 mb-8">
        {cards.map((stat, i) => (
          <div key={stat.label} className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm">
            <div className="flex justify-between items-start mb-4">
              <div className={`p-3 rounded-xl ${stat.bg}`}>
                <stat.icon className={`w-6 h-6 ${stat.color}`} />
              </div>
              <span className="text-xs font-bold text-zinc-500 bg-zinc-50 px-2 py-1 rounded-full">Real</span>
            </div>
            <h3 className="text-zinc-500 text-sm font-medium">{stat.label}</h3>
            <p className="text-2xl font-bold text-zinc-900 mt-1">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-bold text-zinc-900 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-emerald-600" /> Productividad por odontologo
            </h3>
            <span className="text-sm text-zinc-500">Mes actual</span>
          </div>
          <div className="h-[300px] w-full">
            {loading ? (
              <div className="h-full flex items-center justify-center text-zinc-400">Cargando datos...</div>
            ) : stats.length === 0 ? (
              <div className="h-full flex items-center justify-center text-zinc-400">Sin procedimientos registrados este mes</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f4f4f5" />
                  <XAxis dataKey="doctor" axisLine={false} tickLine={false} tick={{ fill: '#71717a', fontSize: 12 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#71717a', fontSize: 12 }} />
                  <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]} barSize={40}>
                    {stats.map((_, index) => <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm">
          <h3 className="font-bold text-zinc-900 mb-6">Actividad Reciente</h3>
          <div className="space-y-6">
            {(summary?.audit || []).map((log: any) => (
              <div key={log.id} className="flex gap-4">
                <div className="w-2 h-2 rounded-full bg-emerald-500 mt-2 shrink-0" />
                <div>
                  <p className="text-sm text-zinc-900">
                    <span className="font-bold">{log.user ? `${log.user.firstName} ${log.user.lastName}` : 'Sistema'}</span> {log.action} <span className="text-emerald-600 font-medium">{log.entity}</span>
                  </p>
                  <p className="text-xs text-zinc-400 mt-1">{new Date(log.timestamp).toLocaleString()}</p>
                </div>
              </div>
            ))}
            {(!summary?.audit || summary.audit.length === 0) && <p className="text-sm text-zinc-400">Sin actividad reciente</p>}
          </div>
        </div>
      </div>
    </div>
  );
};
