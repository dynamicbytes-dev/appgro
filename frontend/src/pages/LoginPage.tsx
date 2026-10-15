import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/Button';
import { ArrowRight, Lock, Mail, AlertCircle, ShieldCheck } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { login, isLoading } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!email.trim()) {
      setErrorMessage('Por favor ingresa tu correo electrónico.');
      return;
    }
    if (!password) {
      setErrorMessage('Por favor ingresa tu contraseña.');
      return;
    }

    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Credenciales inválidas. Inténtalo nuevamente.';
      setErrorMessage(msg);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1B4D3E] via-[#143A2F] to-[#0B2019] flex items-center justify-center p-4 sm:p-6 lg:p-8">
      <div className="max-w-md w-full bg-white dark:bg-[#18221F] rounded-3xl shadow-2xl border border-emerald-900/30 overflow-hidden">
        
        {/* Header Branding */}
        <div className="bg-[#1B4D3E] p-8 text-center text-white relative">
          <div className="w-16 h-16 mx-auto mb-3 rounded-2xl bg-gradient-to-tr from-[#4E9F3D] to-[#6DBF5C] p-3 flex items-center justify-center shadow-lg border border-white/20">
            <span className="text-3xl font-extrabold text-white">AG</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white">
            Appgro Multi-Granja
          </h1>
          <p className="text-xs text-emerald-200 mt-1">
            Plataforma Integral de Control y Gestión Agropecuaria
          </p>
        </div>

        <div className="p-8 space-y-6">
          
          {/* Error Banner */}
          {errorMessage && (
            <div className="p-3.5 bg-red-50 dark:bg-red-950/50 rounded-2xl border border-red-200 dark:border-red-800 text-xs text-red-700 dark:text-red-300 flex items-start gap-2.5 animate-in fade-in duration-200">
              <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Correo Electrónico
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3.5 top-3.5 text-gray-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ejemplo@granja.com"
                  required
                  autoComplete="email"
                  className="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-[#121816] border border-gray-200 dark:border-[#263632] rounded-xl text-sm focus:ring-2 focus:ring-[#1B4D3E] focus:outline-none transition-all text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Contraseña
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3.5 top-3.5 text-gray-400" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  required
                  autoComplete="current-password"
                  className="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-[#121816] border border-gray-200 dark:border-[#263632] rounded-xl text-sm focus:ring-2 focus:ring-[#1B4D3E] focus:outline-none transition-all text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
                />
              </div>
            </div>

            {/* Secure API Badge */}
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-200 dark:border-[#263632] text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#4E9F3D] shrink-0" />
              <span>Autenticación segura JWT enlazada con la API Backend</span>
            </div>

            <Button
              type="submit"
              variant="accent"
              className="w-full py-3 text-sm shadow-lg font-bold"
              disabled={isLoading}
              icon={<ArrowRight className="w-4 h-4" />}
            >
              {isLoading ? 'Autenticando...' : 'Iniciar Sesión'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
};
