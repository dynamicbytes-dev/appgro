import React from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { normalizeModuleCode } from '../../config/modules';
import type { ModuleId } from '../../types/auth';

interface ModuleGuardProps {
  children: React.ReactNode;
  moduleCode?: ModuleId;
}

export const ModuleGuard: React.FC<ModuleGuardProps> = ({ children, moduleCode }) => {
  const params = useParams<{ moduleId?: string }>();
  const targetModule = moduleCode || (params.moduleId as ModuleId | undefined);
  const { user, enabledModules, isLoading } = useAuth();

  // Defensive loading guard
  if (isLoading) {
    return (
      <div className="p-12 text-center bg-[#F9F9F9] dark:bg-[#0F1715] rounded-2xl border border-gray-200 dark:border-[#263632]">
        <div className="w-10 h-10 border-4 border-[#1B4D3E] border-t-[#4E9F3D] rounded-full animate-spin mx-auto mb-3" />
        <p className="text-xs font-semibold text-gray-600 dark:text-gray-400">
          Verificando acceso al módulo...
        </p>
      </div>
    );
  }

  if (!user || !targetModule) {
    return <Navigate to="/forbidden" replace />;
  }

  const roleUpper = user.role ? user.role.toUpperCase() : '';
  const normalizedTarget = normalizeModuleCode(targetModule);

  // Root has access to all modules, Admin & Encargado need explicit module activation
  const hasAccess =
    roleUpper === 'ROOT' ||
    (Array.isArray(enabledModules) &&
      enabledModules.some((m) => {
        const norm = normalizeModuleCode(m);
        return (
          (norm && norm === normalizedTarget) ||
          m === targetModule ||
          m === normalizedTarget
        );
      }));

  if (!hasAccess) {
    return <Navigate to="/forbidden" replace />;
  }

  return <>{children}</>;
};
