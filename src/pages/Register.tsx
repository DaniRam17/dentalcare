import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { UserPlus, ShieldCheck } from 'lucide-react';

type Role = 'ADMIN' | 'DOCTOR' | 'RECEPTIONIST' | 'NURSE';

const ROLES: { value: Role; label: string }[] = [
  { value: 'ADMIN', label: 'Administrador' },
  { value: 'DOCTOR', label: 'Doctor' },
  { value: 'RECEPTIONIST', label: 'Recepcionista' },
  { value: 'NURSE', label: 'Enfermero/a' },
];

interface FormData {
  firstName: string;
  lastName: string;
  documentId: string;
  email: string;
  password: string;
  confirmPassword: string;
  role: Role;
  phone: string;
  address: string;
}

interface FieldErrors {
  firstName?: string[];
  lastName?: string[];
  documentId?: string[];
  email?: string[];
  password?: string[];
  role?: string[];
  [key: string]: string[] | undefined;
}

export const Register: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState<FormData>({
    firstName: '',
    lastName: '',
    documentId: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'RECEPTIONIST',
    phone: '',
    address: '',
  });

  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [loading, setLoading] = useState(false);

  const set = (field: keyof FormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
    setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
    setError('');
  };

  const validate = (): boolean => {
    const errors: FieldErrors = {};
    if (form.firstName.trim().length < 2) errors.firstName = ['Mínimo 2 caracteres'];
    if (form.lastName.trim().length < 2) errors.lastName = ['Mínimo 2 caracteres'];
    if (!form.documentId.trim()) errors.documentId = ['Requerido'];
    if (!/\S+@\S+\.\S+/.test(form.email)) errors.email = ['Correo inválido'];
    if (form.password.length < 6) errors.password = ['Mínimo 6 caracteres'];
    if (form.password !== form.confirmPassword) errors.confirmPassword = ['Las contraseñas no coinciden'];
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          documentId: form.documentId.trim(),
          email: form.email.trim(),
          password: form.password,
          role: form.role,
          phone: form.phone.trim() || undefined,
          address: form.address.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        if (data.fields) setFieldErrors(data.fields);
        throw new Error(data.error || 'Error al registrar');
      }

      login(data.token, data.user);
      navigate('/', { replace: true });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const field = (label: string, key: keyof FormData, type = 'text', placeholder = '') => (
    <div>
      <label className="block text-sm font-medium text-zinc-700 mb-1">{label}</label>
      <input
        type={type}
        className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all ${
          fieldErrors[key] ? 'border-red-400 bg-red-50' : 'border-zinc-300'
        }`}
        value={form[key] as string}
        onChange={set(key)}
        placeholder={placeholder}
      />
      {fieldErrors[key] && (
        <p className="text-red-500 text-xs mt-1">{fieldErrors[key]![0]}</p>
      )}
    </div>
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 p-4">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl border border-zinc-200 p-8">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mb-4">
            <ShieldCheck className="w-8 h-8 text-emerald-600" />
          </div>
          <h1 className="text-2xl font-bold text-zinc-900">DentalCare Pro</h1>
          <p className="text-zinc-500 text-sm">Crear nueva cuenta</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {field('Nombre', 'firstName', 'text', 'Juan')}
            {field('Apellido', 'lastName', 'text', 'Pérez')}
          </div>

          {field('Documento de Identidad', 'documentId', 'text', '0801-1990-12345')}
          {field('Correo Electrónico', 'email', 'email', 'juan@dentalcare.com')}

          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">Rol</label>
            <select
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all bg-white ${
                fieldErrors.role ? 'border-red-400' : 'border-zinc-300'
              }`}
              value={form.role}
              onChange={set('role')}
            >
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
            {fieldErrors.role && (
              <p className="text-red-500 text-xs mt-1">{fieldErrors.role[0]}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            {field('Contraseña', 'password', 'password', '••••••••')}
            {field('Confirmar Contraseña', 'confirmPassword', 'password', '••••••••')}
          </div>

          {field('Teléfono (opcional)', 'phone', 'tel', '+504 0000-0000')}
          {field('Dirección (opcional)', 'address', 'text', 'Tegucigalpa, Honduras')}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3">
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-semibold py-2.5 rounded-lg flex items-center justify-center gap-2 transition-colors"
          >
            <UserPlus className="w-4 h-4" />
            {loading ? 'Creando cuenta...' : 'Crear Cuenta'}
          </button>

          <p className="text-center text-sm text-zinc-500">
            ¿Ya tienes cuenta?{' '}
            <Link to="/login" className="text-emerald-600 hover:underline font-medium">
              Inicia sesión
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
};
