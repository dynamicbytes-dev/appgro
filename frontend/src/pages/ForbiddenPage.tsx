import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { ShieldAlert, Home, ArrowLeft } from 'lucide-react';

export const ForbiddenPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center text-center p-6">
      <div className="w-20 h-20 bg-red-100 dark:bg-red-900/40 rounded-full flex items-center justify-center text-red-600 dark:text-red-400 mb-4 shadow-lg border border-red-200 dark:border-red-800">
        <ShieldAlert className="w-10 h-10" />
      </div>

      <h1 className="text-3xl font-black text-[#1E1E1E] dark:text-white tracking-tight">
        403 - Acceso No Autorizado
      </h1>
      
      <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md mt-2 mb-6">
        No tienes permisos suficientes para acceder a este módulo o sección. Esta restricción ha sido configurada por tu Administrador o por la política global de módulos.
      </p>

      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          onClick={() => navigate(-1)}
          icon={<ArrowLeft className="w-4 h-4" />}
        >
          Volver Atrás
        </Button>

        <Button
          variant="primary"
          onClick={() => navigate('/dashboard')}
          icon={<Home className="w-4 h-4" />}
        >
          Ir al Inicio
        </Button>
      </div>
    </div>
  );
};
