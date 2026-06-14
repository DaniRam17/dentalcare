import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Sidebar } from './components/Sidebar';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Patients } from './pages/Patients';
import { Appointments } from './pages/Appointments';
import { Prescriptions } from './pages/Prescriptions';
import { Procedures } from './pages/Procedures';
import { Employees } from './pages/Employees';
import { Shifts } from './pages/Shifts';
import { IntegratedModulePage } from './pages/IntegratedModulePage';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center">Cargando...</div>;
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" />;
};

const Layout: React.FC = () => {
  return (
    <div className="flex min-h-screen bg-zinc-50">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/patients" element={<Patients />} />
          <Route path="/appointments" element={<Appointments />} />
          <Route path="/prescriptions" element={<Prescriptions />} />
          <Route path="/procedures" element={<Procedures />} />
          <Route path="/employees" element={<Employees />} />
          <Route path="/shifts" element={<Shifts />} />
          <Route path="/clinical-history" element={<IntegratedModulePage moduleKey="clinical-history" />} />
          <Route path="/clinical-files" element={<IntegratedModulePage moduleKey="clinical-files" />} />
          <Route path="/billing" element={<IntegratedModulePage moduleKey="billing" />} />
          <Route path="/credit-debit-notes" element={<IntegratedModulePage moduleKey="credit-debit-notes" />} />
          <Route path="/billing/settings" element={<IntegratedModulePage moduleKey="fiscal-ranges" />} />
          <Route path="/payments" element={<IntegratedModulePage moduleKey="payments" />} />
          <Route path="/inventory" element={<IntegratedModulePage moduleKey="inventory" />} />
          <Route path="/consents" element={<IntegratedModulePage moduleKey="consents" />} />
          <Route path="/audit" element={<IntegratedModulePage moduleKey="audit" />} />
          <Route path="/reports" element={<IntegratedModulePage moduleKey="reports" />} />
          <Route path="/notifications" element={<IntegratedModulePage moduleKey="notifications" />} />
          <Route path="/specialties" element={<IntegratedModulePage moduleKey="specialties" />} />
          <Route path="*" element={<div className="p-12 text-center text-zinc-400">Próximamente...</div>} />
        </Routes>
      </main>
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route 
            path="/*" 
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            } 
          />
        </Routes>
      </Router>
    </AuthProvider>
  );
}
