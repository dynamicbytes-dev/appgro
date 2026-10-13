import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export const ProtectedRoute: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F9F9F9] dark:bg-[#0F1715]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 border-4 border-[#1B4D3E] border-t-[#4E9F3D] rounded-full animate-spin" />
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
            Cargando sistema agropecuario...
          </p>
        </div>
      </div>
    );
  }

  return isAuthenticated ? <Outlet /> : <Navigate to="/login" replace />;
};
