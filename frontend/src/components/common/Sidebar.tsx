import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth, extractEnabledModules } from '../../context/AuthContext';
import { SYSTEM_MODULES, normalizeModuleCode, isModuleItemEnabled, MODULE_DISPLAY_ORDER } from '../../config/modules';
import { safeText } from '../../utils/safeText';
import type { ModuleId } from '../../types/auth';
import {
  LayoutDashboard,
  Building2,
  Users,
  ShieldCheck,
  CheckCircle2,
  ChevronRight,
  Boxes,
  Warehouse,
  Fence,
  Layers,
  ClipboardList,
  Package,
  BarChart3,
  History,
} from 'lucide-react';

const MODULE_ICONS: Record<string, React.ReactNode> = {
  especies: <Layers className="w-4 h-4 text-[#4E9F3D]" />,
  galpones: <Warehouse className="w-4 h-4 text-[#4E9F3D]" />,
  potreros: <Fence className="w-4 h-4 text-[#4E9F3D]" />,
  lotes: <Boxes className="w-4 h-4 text-[#4E9F3D]" />,
  actividades: <ClipboardList className="w-4 h-4 text-[#4E9F3D]" />,
  inventario: <Package className="w-4 h-4 text-[#4E9F3D]" />,
  analitica: <BarChart3 className="w-4 h-4 text-[#4E9F3D]" />,
  historial: <History className="w-4 h-4 text-[#4E9F3D]" />,
};

export const Sidebar: React.FC = () => {
  const { user, enabledModules } = useAuth();

  if (!user) return null;

  const roleUpper = user.role ? user.role.toUpperCase() : '';
  const isRoot = roleUpper === 'ROOT';
  const isAdmin = roleUpper === 'ADMIN';

  // Dynamic extraction ensuring real-time evaluation of enabled modules returned by API
  const activeModules =
    enabledModules && enabledModules.length > 0
      ? enabledModules
      : extractEnabledModules(user);

  const rawUserModules = isRoot
    ? Object.keys(SYSTEM_MODULES)
    : (activeModules || [])
        .map(normalizeModuleCode)
        .filter((m): m is ModuleId => m !== null && m in SYSTEM_MODULES);

  // Orden estricto solicitado para los módulos operativos en la barra
  // lateral, independiente del orden que devuelva la API o del orden de
  // las claves de `SYSTEM_MODULES`.
  const moduleRank = (id: string): number => {
    const index = (MODULE_DISPLAY_ORDER as string[]).indexOf(id);
    return index === -1 ? MODULE_DISPLAY_ORDER.length : index;
  };

  const userModules = Array.from(new Set(rawUserModules)).sort(
    (a, b) => moduleRank(a) - moduleRank(b)
  );

  // Dynamic evaluation: is Historial module enabled for current user/farm?
  const isHistoryEnabled =
    isRoot ||
    userModules.includes('historial') ||
    (activeModules || []).some((m: any) => {
      const code = normalizeModuleCode(typeof m === 'object' && m !== null ? m.code || m.id : m);
      return code === 'historial' && isModuleItemEnabled(m);
    });

  // Prevent duplicating Historial in operative list if already shown in administrative blocks
  const displayModules = isRoot || isAdmin
    ? userModules.filter((m) => m !== 'historial')
    : userModules;

  const getNavLinkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all ${
      isActive
        ? 'bg-[#1B4D3E] text-white shadow-md border-l-4 border-[#4E9F3D]'
        : 'text-gray-700 dark:text-gray-300 hover:bg-emerald-50 dark:hover:bg-[#263632]'
    }`;

  return (
    <aside className="w-64 bg-white dark:bg-[#18221F] border-r border-gray-200 dark:border-[#263632] rounded-2xl min-h-[calc(100vh-6rem)] p-4 flex flex-col justify-between shrink-0 shadow-sm transition-colors">
      <div className="space-y-6">
        
        {/* Navigation Section */}
        <nav className="space-y-5">
          
          {/* Main Dashboard Section */}
          <div>
            <div className="px-3 text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">
              Panel Principal
            </div>
            <NavLink key="dashboard" to="/dashboard" className={getNavLinkClass}>
              <div className="flex items-center gap-3">
                <LayoutDashboard className="w-4 h-4 text-[#4E9F3D]" />
                <span>Resumen General</span>
              </div>
              <ChevronRight className="w-3.5 h-3.5 opacity-40" />
            </NavLink>
          </div>

          {/* Root Special Control Section */}
          {isRoot && (
            <div>
              <div className="px-3 text-[11px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider mb-2 flex items-center justify-between">
                <span>Módulos Administrativos</span>
                <ShieldCheck className="w-3.5 h-3.5" />
              </div>
              <div className="space-y-1">
                <NavLink key="root-farms" to="/root/farms" className={getNavLinkClass}>
                  <div className="flex items-center gap-3">
                    <Building2 className="w-4 h-4 text-amber-400" />
                    <span>Gestión de Granjas</span>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 opacity-40" />
                </NavLink>

                <NavLink key="root-admins" to="/root/admins" className={getNavLinkClass}>
                  <div className="flex items-center gap-3">
                    <Users className="w-4 h-4 text-[#4E9F3D]" />
                    <span>Gestión Administradores</span>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 opacity-40" />
                </NavLink>

                <NavLink key="history" to="/history" className={getNavLinkClass}>
                  <div className="flex items-center gap-3">
                    <History className="w-4 h-4 text-[#4E9F3D]" />
                    <span>Historial y Auditoría</span>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 opacity-40" />
                </NavLink>
              </div>
            </div>
          )}

          {/* Admin Special Control Section */}
          {isAdmin && (
            <div>
              <div className="px-3 text-[11px] font-bold text-[#1B4D3E] dark:text-[#4E9F3D] uppercase tracking-wider mb-2">
                Módulos Administrativos
              </div>
              <div className="space-y-1">
                <NavLink key="admin-subordinates" to="/admin/subordinates" className={getNavLinkClass}>
                  <div className="flex items-center gap-3">
                    <Users className="w-4 h-4 text-[#4E9F3D]" />
                    <span>Gestión de Encargados</span>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 opacity-40" />
                </NavLink>

                {isHistoryEnabled && (
                  <NavLink key="history" to="/history" className={getNavLinkClass}>
                    <div className="flex items-center gap-3">
                      <History className="w-4 h-4 text-[#4E9F3D]" />
                      <span>Historial de Actividades</span>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 opacity-40" />
                  </NavLink>
                )}
              </div>
            </div>
          )}

          {/* Dynamic Active Modules Section */}
          {displayModules.length > 0 && (
            <div>
              <div className="px-3 text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">
                Módulos Agropecuarios Operativos
              </div>
              <div className="space-y-1">
                {displayModules.map((modId) => {
                  const config = SYSTEM_MODULES[modId as keyof typeof SYSTEM_MODULES];
                  if (!config && !isRoot) return null;
                  const name = config?.name || modId;
                  const icon = MODULE_ICONS[modId] || <Boxes className="w-4 h-4 text-[#4E9F3D]" />;
                  // El encargado (subordinado) entra a SU bandeja de actividades;
                  // el admin/root entra al panel de gestión.
                  const targetPath =
                    modId === 'historial'
                      ? '/history'
                      : modId === 'actividades' && !isRoot && !isAdmin
                        ? '/mis-actividades'
                        : `/modules/${modId}`;
                  const itemKey = modId === 'historial' ? 'history' : `sidebar-module-${modId}`;

                  return (
                    <NavLink key={itemKey} to={targetPath} className={getNavLinkClass}>
                      <div className="flex items-center gap-3 truncate">
                        {icon}
                        <span className="truncate">{safeText(name)}</span>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 opacity-40 shrink-0" />
                    </NavLink>
                  );
                })}
              </div>
            </div>
          )}

        </nav>
      </div>

      {/* Footer Status Box */}
      <div className="pt-4 border-t border-gray-100 dark:border-[#263632]">
        <div className="bg-[#F9F9F9] dark:bg-[#121816] p-3 rounded-xl border border-gray-200 dark:border-[#263632] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#4E9F3D] shrink-0" />
            <span className="text-[11px] font-bold text-[#1E1E1E] dark:text-gray-200 truncate">
              {isRoot ? 'Consola Root Global' : safeText(user.farmName || (user.farm && (user.farm as any).name), 'Sistema Agropecuario')}
            </span>
          </div>
        </div>
      </div>
    </aside>
  );
};
