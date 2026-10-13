import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { HelpCircle, Home } from 'lucide-react';

export const NotFoundPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center text-center p-6">
      <div className="w-20 h-20 bg-amber-100 dark:bg-amber-900/40 rounded-full flex items-center justify-center text-amber-600 dark:text-amber-400 mb-4 shadow-lg border border-amber-200 dark:border-amber-800">
        <HelpCircle className="w-10 h-10" />
      </div>

      <h1 className="text-3xl font-black text-[#1E1E1E] dark:text-white tracking-tight">
        404 - Página No Encontrada
      </h1>

      <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md mt-2 mb-6">
        La ruta a la que intentas ingresar no existe o ha sido movida.
      </p>

      <Button
        variant="primary"
        onClick={() => navigate('/dashboard')}
        icon={<Home className="w-4 h-4" />}
      >
        Ir al Dashboard
      </Button>
    </div>
  );
};
