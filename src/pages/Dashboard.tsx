import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { BarChart3, TrendingUp, Users, Calendar, Activity } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

export const Dashboard: React.FC = () => {
  const { token } = useAuth();
  const [stats, setStats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch('/api/reports/productivity', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        setStats(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  const COLORS = ['#059669', '#10b981', '#34d399', '#6ee7b7'];

  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-zinc-900">Panel de Control</h1>
        <p className="text-zinc-500">Métricas clave y rendimiento de la clínica</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {[
          { label: 'Pacientes Totales', value: '1,284', icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Citas Hoy', value: '12', icon: Calendar, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Procedimientos', value: '48', icon: Activity, color: 'text-purple-600', bg: 'bg-purple-50' },
          { label: 'Ingresos Mes', value: '$12.4k', icon: TrendingUp, color: 'text-orange-600', bg: 'bg-orange-50' },
        ].map((stat, i) => (
          <div key={i} className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm">
            <div className="flex justify-between items-start mb-4">
              <div className={`p-3 rounded-xl ${stat.bg}`}>
                <stat.icon className={`w-6 h-6 ${stat.color}`} />
              </div>
              <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">+12%</span>
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
              <BarChart3 className="w-5 h-5 text-emerald-600" /> Productividad por Odontólogo
            </h3>
            <select className="text-sm border-none bg-zinc-50 rounded-lg px-3 py-1 outline-none">
              <option>Últimos 30 días</option>
              <option>Este año</option>
            </select>
          </div>
          <div className="h-[300px] w-full">
            {loading ? (
              <div className="h-full flex items-center justify-center text-zinc-400">Cargando datos...</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f4f4f5" />
                  <XAxis dataKey="doctor" axisLine={false} tickLine={false} tick={{ fill: '#71717a', fontSize: 12 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#71717a', fontSize: 12 }} />
                  <Tooltip 
                    cursor={{ fill: '#f8fafc' }}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]} barSize={40}>
                    {stats.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm">
          <h3 className="font-bold text-zinc-900 mb-6">Actividad Reciente</h3>
          <div className="space-y-6">
            {[
              { user: 'Admin', action: 'Creó paciente', target: 'María García', time: 'hace 5 min' },
              { user: 'Dr. Pérez', action: 'Completó cita', target: 'Carlos Ruiz', time: 'hace 12 min' },
              { user: 'Recepcionista', action: 'Canceló turno', target: 'Turno Mañana', time: 'hace 45 min' },
              { user: 'Admin', action: 'Actualizó receta', target: '#REC-0042', time: 'hace 1 hora' },
            ].map((log, i) => (
              <div key={i} className="flex gap-4">
                <div className="w-2 h-2 rounded-full bg-emerald-500 mt-2 shrink-0" />
                <div>
                  <p className="text-sm text-zinc-900">
                    <span className="font-bold">{log.user}</span> {log.action} <span className="text-emerald-600 font-medium">{log.target}</span>
                  </p>
                  <p className="text-xs text-zinc-400 mt-1">{log.time}</p>
                </div>
              </div>
            ))}
          </div>
          <button className="w-full mt-8 text-sm text-zinc-500 hover:text-zinc-900 font-medium transition-colors">
            Ver bitácora completa →
          </button>
        </div>
      </div>
    </div>
  );
};
