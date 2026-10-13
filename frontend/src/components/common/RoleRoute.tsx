import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

interface RoleRouteProps {
  allowedRoles: string[];
}

export const RoleRoute: React.FC<RoleRouteProps> = ({ allowedRoles }) => {
  const { user, isLoading } = useAuth();

  // Defensive loading guard
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F9F9F9] dark:bg-[#0F1715]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-[#1B4D3E] border-t-[#4E9F3D] rounded-full animate-spin" />
          <p className="text-xs font-semibold text-gray-600 dark:text-gray-400">
            Validando permisos del usuario...
          </p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const userRoleUpper = user.role ? user.role.toUpperCase() : '';
  const isAllowed = allowedRoles.some((r) => r.toUpperCase() === userRoleUpper);

  if (!isAllowed) {
    return <Navigate to="/forbidden" replace />;
  }

  return <Outlet />;
};
