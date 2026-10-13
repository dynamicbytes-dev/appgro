import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { farmService } from '../services/farmService';
import { authService } from '../services/authService';
import { tokenStorage, api } from '../services/api';
import { subordinateService } from '../services/subordinateService';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { StatusBadge } from '../components/ui/StatusBadge';
import { Modal } from '../components/ui/Modal';
import { SkeletonLoader } from '../components/ui/SkeletonLoader';
import { SYSTEM_MODULES, normalizeModuleCode, isModuleItemEnabled } from '../config/modules';
import { safeText } from '../utils/safeText';
import type { ModuleId, Subordinate } from '../types/auth';
import {
  Building2,
  Users,
  CheckCircle2,
  Sliders,
  Plus,
  ArrowRight,
  Boxes,
  Warehouse,
  Layers,
  ClipboardList,
  BarChart3,
  UserCheck,
} from 'lucide-react';

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Layers,
  Warehouse,
  Boxes,
  ClipboardList,
  BarChart3,
  Users,
};

const extractModulesArrayFromPayload = (payload: any): any[] | null => {
  if (!payload) return null;
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.data)) return payload.data;
  if (Array.isArray(payload.modules)) return payload.modules;
  if (Array.isArray(payload.farm_modules)) return payload.farm_modules;
  if (Array.isArray(payload.subordinate_modules)) return payload.subordinate_modules;
  if (payload.data && typeof payload.data === 'object') {
    if (Array.isArray(payload.data.modules)) return payload.data.modules;
    if (Array.isArray(payload.data.farm_modules)) return payload.data.farm_modules;
    if (Array.isArray(payload.data.subordinate_modules)) return payload.data.subordinate_modules;
    if (Array.isArray(payload.data.data)) return payload.data.data;
  }
  if (payload.farm && typeof payload.farm === 'object') {
    if (Array.isArray(payload.farm.modules)) return payload.farm.modules;
    if (Array.isArray(payload.farm.farm_modules)) return payload.farm.farm_modules;
  }
  return null;
};

export const AdminDashboard: React.FC = () => {
  const { activeFarm, user: authUser, subordinates, createSubordinate, updateSubordinate, toggleSubordinateStatus, enabledModules, updateEnabledModules } = useAuth();
  const user = authUser;
  const navigate = useNavigate();

  console.log('USUARIO LOGUEADO:', authUser);

  // Modal States
  const [isAddSubModalOpen, setIsAddSubModalOpen] = useState(false);
  const [isEditSubModalOpen, setIsEditSubModalOpen] = useState(false);
  const [selectedSub, setSelectedSub] = useState<Subordinate | null>(null);

  // New Subordinate Form
  const [subName, setSubName] = useState('');
  const [subEmail, setSubEmail] = useState('');
  const [subPassword, setSubPassword] = useState('');
  const [assignedModules, setAssignedModules] = useState<ModuleId[]>([]);

  // Edit Subordinate Form
  const [editSubName, setEditSubName] = useState('');
  const [editSubEmail, setEditSubEmail] = useState('');
  const [editSubPassword, setEditSubPassword] = useState('');
  const [editSubModules, setEditSubModules] = useState<ModuleId[]>([]);

  // API Farm Modules fetch state
  const [apiFarmModules, setApiFarmModules] = useState<ModuleId[] | null>(null);
  const [isFetchingModules, setIsFetchingModules] = useState<boolean>(false);

  // Dashboard stats state and real subordinates list
  const [stats, setStats] = useState<any>(null);
  const [subordinatesList, setSubordinatesList] = useState<any[]>([]);

  const storedUser = tokenStorage.getUser();
  const targetFarmId =
    activeFarm?.id ||
    authUser?.farm_id ||
    authUser?.farmId ||
    authUser?.farm?.id ||
    storedUser?.farm_id ||
    storedUser?.farmId ||
    storedUser?.farm?.id;

  const loadFarmActiveModules = async (farmIdToUse?: any) => {
    setIsFetchingModules(true);
    let rawData: any = null;

    try {
      let resolvedFarmId = farmIdToUse || targetFarmId;

      if (!resolvedFarmId) {
        try {
          const userRes = await authService.getCurrentUser();
          if (userRes && userRes.user) {
            resolvedFarmId =
              userRes.user.farm_id ||
              userRes.user.farmId ||
              (userRes.user.farm && userRes.user.farm.id) ||
              undefined;
          }
        } catch (authErr) {
          console.warn('Error al verificar usuario actual:', authErr);
        }
      }

      if (resolvedFarmId) {
        try {
          rawData = await farmService.getFarmModules(resolvedFarmId);
          console.log('DATOS CRUDOS DE LA API:', rawData);
        } catch (err: any) {
          console.error('DATOS CRUDOS DE LA API (Error al consultar API de módulos):', err?.response?.data || err);
          rawData = null;
        }
      } else {
        console.warn('DATOS CRUDOS DE LA API: No se encontró targetFarmId para consultar módulos');
      }

      const rawList = extractModulesArrayFromPayload(rawData);

      console.log('DATOS CRUDOS DE LA API (Módulos extraídos):', rawList);
      console.log('DATOS CRUDOS DE LA API (User context):', user);
      console.log('DATOS CRUDOS DE LA API (Enabled modules):', enabledModules);

      let enabledOnly: ModuleId[] = [];

      if (rawList && Array.isArray(rawList) && rawList.length > 0) {
        for (const item of rawList) {
          if (!isModuleItemEnabled(item)) continue;

          let codeRaw = item;
          if (typeof item === 'object' && item !== null) {
            codeRaw =
              item.code ||
              item.slug ||
              item.module_code ||
              item.id ||
              item.module_id ||
              item.name ||
              (item.pivot && (item.pivot.module_id || item.pivot.code || item.pivot.slug));
          }

          const code = normalizeModuleCode(codeRaw);
          if (code && code in SYSTEM_MODULES) {
            enabledOnly.push(code);
          }
        }
      }

      // Context Fallback si el endpoint de la API viene vacío o indefinido
      if (enabledOnly.length === 0) {
        console.log('DATOS CRUDOS DE LA API: Arreglo de la API vacío o indefinido. Ejecutando fallback de contexto...');
        const userContextCandidates = [
          user?.farm_modules,
          user?.subordinate_modules,
          user?.modules,
          user?.farm && (user.farm as any).modules,
          user?.farm && (user.farm as any).farm_modules,
          enabledModules,
        ];

        for (const cand of userContextCandidates) {
          if (Array.isArray(cand) && cand.length > 0) {
            for (const item of cand) {
              if (!isModuleItemEnabled(item)) continue;
              let codeRaw = item;
              if (typeof item === 'object' && item !== null) {
                codeRaw =
                  item.code ||
                  item.slug ||
                  item.module_code ||
                  item.id ||
                  item.module_id ||
                  item.name ||
                  (item.pivot && (item.pivot.module_id || item.pivot.code || item.pivot.slug));
              }
              const code = normalizeModuleCode(codeRaw);
              if (code && code in SYSTEM_MODULES) {
                enabledOnly.push(code);
              }
            }
            if (enabledOnly.length > 0) break;
          }
        }
      }

      console.log('DATOS CRUDOS DE LA API (Lista final mapeada):', enabledOnly);
      const finalList = Array.from(new Set(enabledOnly));
      setApiFarmModules(finalList);
      if (updateEnabledModules) {
        updateEnabledModules(finalList);
      }
    } catch (err: any) {
      console.error('Error al procesar la respuesta de la API:', err);
      const ctxEnabled = (enabledModules || []).map(normalizeModuleCode).filter((m): m is ModuleId => m !== null && m in SYSTEM_MODULES);
      setApiFarmModules(Array.from(new Set(ctxEnabled)));
    } finally {
      setIsFetchingModules(false);
    }
  };

  const loadDashboardData = async () => {
    let resolvedFarmId = targetFarmId;

    if (!resolvedFarmId) {
      try {
        const userRes = await authService.getCurrentUser();
        if (userRes && userRes.user) {
          resolvedFarmId =
            userRes.user.farm_id ||
            userRes.user.farmId ||
            (userRes.user.farm && userRes.user.farm.id) ||
            undefined;
        }
      } catch (authErr) {
        console.warn('Error al verificar usuario actual:', authErr);
      }
    }

    // 1. Fetch dashboard stats from /api/admin/dashboard
    try {
      const dashRes = await api.get('/admin/dashboard', {
        params: resolvedFarmId ? { farm_id: resolvedFarmId } : {},
      });
      const dashRaw = dashRes.data?.data || dashRes.data || {};
      setStats(dashRaw);
    } catch (dashErr) {
      console.warn('Error al consultar /api/admin/dashboard:', dashErr);
    }

    // 2. Fetch real subordinates for the active farm
    try {
      const subs = await subordinateService.getAllSubordinates(resolvedFarmId);
      if (Array.isArray(subs)) {
        const mappedSubs = subs.map((s: any) => {
          const rawMods = s.subordinate_modules || s.subordinateModules || s.assigned_modules || s.assignedModules || [];
          const cleanMods: ModuleId[] = Array.isArray(rawMods)
            ? rawMods
                .map((m: any) => {
                  if (typeof m === 'string') return normalizeModuleCode(m) as ModuleId;
                  if (m?.pivot && !m.pivot.is_enabled) return null;
                  return normalizeModuleCode(m?.code || m?.slug || m?.id) as ModuleId;
                })
                .filter(Boolean) as ModuleId[]
            : [];

          return {
            id: s.id,
            name: s.name ? (s.lastname ? `${s.name} ${s.lastname}`.trim() : s.name) : 'Encargado de Campo',
            email: s.email || '',
            assignedModules: cleanMods,
            status: s.is_active !== undefined ? (s.is_active ? 'active' : 'inactive') : (s.status || 'active'),
            lastAccess: s.last_login_at || s.lastAccess || 'Reciente',
            farmId: s.farm_id || resolvedFarmId,
          };
        });
        setSubordinatesList(mappedSubs);
      }
    } catch (subsErr) {
      console.warn('Error al consultar subordinados de la granja:', subsErr);
    }

    // 3. Load active farm modules
    await loadFarmActiveModules(resolvedFarmId);
  };

  useEffect(() => {
    loadDashboardData();
  }, [targetFarmId]);

  // Enabled modules for this admin's farm (Authorized and Active from Root)
  const farmModules = (
    apiFarmModules !== null
      ? apiFarmModules
      : (activeFarm?.enabledModules)
      ? activeFarm.enabledModules
      : enabledModules || []
  ) as ModuleId[];

  const farmSubordinates = subordinates.filter((s: any) => {
    const sFarmId = s.farmId || s.farm_id || (s.farm && s.farm.id);
    if (!targetFarmId || !sFarmId) return true;
    return String(sFarmId) === String(targetFarmId);
  });

  const displayedSubordinates = subordinatesList.length > 0 ? subordinatesList : farmSubordinates;

  // Map the numeric subordinates count from stats object (e.g. stats.subordinates_count, stats.totalSubordinates)
  const subordinatesCount = (() => {
    if (stats) {
      if (typeof stats.subordinates_count === 'number') return stats.subordinates_count;
      if (typeof stats.totalSubordinates === 'number') return stats.totalSubordinates;
      if (typeof stats.total_subordinates === 'number') return stats.total_subordinates;
      if (typeof stats.subordinatesCount === 'number') return stats.subordinatesCount;
      if (typeof stats.subordinates === 'number') return stats.subordinates;
      if (stats.data && typeof stats.data.subordinates_count === 'number') return stats.data.subordinates_count;
      if (stats.data && typeof stats.data.totalSubordinates === 'number') return stats.data.totalSubordinates;
    }
    // Instant fallback if stats object has not finished or returns 0 but list is loaded
    if (subordinatesList.length > 0) return subordinatesList.length;
    return farmSubordinates.length;
  })();

  const handleOpenAddSubModal = () => {
    loadFarmActiveModules();
    setIsAddSubModalOpen(true);
  };

  const handleCreateSubordinateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const CODE_TO_ID: Record<string, number> = {
        especies: 1, species: 1,
        galpones: 2, barns: 2,
        lotes: 3, lots: 3,
        actividades: 4, activities: 4,
        analitica: 5, analytics: 5,
      };
      const validMods = assignedModules.filter((m) => farmModules.includes(m));
      const modIds = validMods.map((m) => CODE_TO_ID[m]).filter(Boolean);

      await subordinateService.createSubordinate({
        name: subName,
        email: subEmail,
        password: subPassword,
        modules: validMods,
        module_ids: modIds,
        is_active: true,
      });

      // Update local context and dashboard state
      createSubordinate({
        name: subName,
        email: subEmail,
        password: subPassword,
        assignedModules: validMods,
      });

      loadDashboardData();
    } catch (err) {
      console.error('Error al registrar encargado:', err);
      createSubordinate({
        name: subName,
        email: subEmail,
        password: subPassword,
        assignedModules: assignedModules.filter((m) => farmModules.includes(m)),
      });
    }

    setIsAddSubModalOpen(false);
    setSubName('');
    setSubEmail('');
    setSubPassword('');
    setAssignedModules([]);
  };

  const openEditSubModal = (sub: Subordinate) => {
    loadFarmActiveModules();
    setSelectedSub(sub);
    setEditSubName(sub.name);
    setEditSubEmail(sub.email);
    setEditSubPassword('');
    setEditSubModules((sub.assignedModules || []).filter((m) => farmModules.includes(m as ModuleId)) as ModuleId[]);
    setIsEditSubModalOpen(true);
  };

  const handleEditSubordinateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSub) return;
    const payload: Partial<Subordinate> = {
      name: editSubName,
      email: editSubEmail,
      assignedModules: editSubModules.filter((m) => farmModules.includes(m)),
    };
    if (editSubPassword.trim()) {
      payload.password = editSubPassword;
    }
    updateSubordinate(selectedSub.id, payload);
    setIsEditSubModalOpen(false);
    setSelectedSub(null);
  };

  if (isFetchingModules && (!farmModules || farmModules.length === 0)) {
    return <SkeletonLoader type="dashboard" />;
  }

  return (
    <div className="space-y-6">
      
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-[#1B4D3E] via-[#143A2F] to-[#256653] rounded-3xl p-6 sm:p-8 text-white shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center px-3 py-1 rounded-full bg-[#4E9F3D]/20 text-[#6DBF5C] text-xs font-bold mb-3 border border-[#4E9F3D]/40">
            <UserCheck className="w-3.5 h-3.5 mr-1.5" /> Panel de Dueño de Granja
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            {activeFarm ? safeText(activeFarm.name, 'Mi Granja Agropecuaria') : 'Mi Granja Agropecuaria'}
          </h1>
          <p className="text-emerald-100/80 text-sm mt-1 max-w-2xl">
            {safeText(activeFarm?.code, 'FARM')} • {safeText(activeFarm?.location, 'Ubicación')} — Monitoreo de producción, lotes y delegación de tareas a encargados.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="accent"
            size="md"
            onClick={handleOpenAddSubModal}
            icon={<Plus className="w-4 h-4" />}
          >
            Nuevo Encargado
          </Button>
        </div>
      </div>

      {/* Farm Status & Modules Count Header */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-l-4 border-l-[#1B4D3E]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Módulos Habilitados</p>
              <h4 className="text-2xl font-black text-[#1E1E1E] dark:text-white mt-1">
                {farmModules.length} Módulos
              </h4>
            </div>
            <div className="p-3 bg-[#1B4D3E]/10 rounded-xl text-[#1B4D3E] dark:text-[#6DBF5C]">
              <Building2 className="w-6 h-6" />
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-2">Asignados por el Administrador Root</p>
        </Card>

        <Card className="border-l-4 border-l-[#4E9F3D]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Encargados de Campo</p>
              <h4 className="text-2xl font-black text-[#1E1E1E] dark:text-white mt-1">
                {subordinatesCount} Subordinados
              </h4>
            </div>
            <div className="p-3 bg-[#4E9F3D]/10 rounded-xl text-[#4E9F3D]">
              <Users className="w-6 h-6" />
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-2">Personal con acceso a vistas operativas</p>
        </Card>

        <Card className="border-l-4 border-l-emerald-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Estado de Instalación</p>
              <h4 className="text-xl font-bold text-[#4E9F3D] mt-1 flex items-center gap-1.5">
                <CheckCircle2 className="w-5 h-5" /> Totalmente Operativa
              </h4>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-2">Capacidad y densidad verificadas</p>
        </Card>
      </div>

      {/* Active Modules Grid */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-[#1E1E1E] dark:text-gray-100">
              Módulos Habilitados para la Granja
            </h2>
            <p className="text-xs text-gray-500">
              Módulos activados por Root. Haz clic en cualquiera para abrir su consola de control.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {farmModules.length === 0 ? (
            <div className="col-span-full p-6 bg-amber-50 dark:bg-amber-950/40 rounded-2xl border border-amber-200 dark:border-amber-900/50 text-center text-xs text-amber-800 dark:text-amber-300 font-semibold">
              ⚠️ No hay módulos activados por Root para esta granja.
            </div>
          ) : (
            (farmModules || []).map((modId) => {
              const mod = SYSTEM_MODULES[modId];
              if (!mod) return null;
              const Icon = ICON_MAP[mod.icon] || Boxes;

              return (
                <Card
                  key={`admin-farm-mod-${modId}`}
                  className="hover:border-[#1B4D3E] dark:hover:border-[#4E9F3D] transition-all cursor-pointer group"
                >
                  <div className="flex items-start justify-between">
                    <div className="p-3 rounded-xl bg-[#1B4D3E]/10 dark:bg-[#1B4D3E]/30 text-[#1B4D3E] dark:text-[#6DBF5C] group-hover:bg-[#1B4D3E] group-hover:text-white transition-colors">
                      <Icon className="w-6 h-6" />
                    </div>
                    <Badge variant="success">Activo</Badge>
                  </div>

                  <h3 className="font-bold text-base text-[#1E1E1E] dark:text-gray-100 mt-4 group-hover:text-[#1B4D3E] dark:group-hover:text-[#6DBF5C] transition-colors">
                    {safeText(mod.name)}
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                    {safeText(mod.description)}
                  </p>

                  <div className="mt-4 pt-3 border-t border-gray-100 dark:border-[#263632] flex items-center justify-between text-xs font-semibold text-[#1B4D3E] dark:text-[#6DBF5C]">
                    <button
                      onClick={() => navigate(`/modules/${modId}`)}
                      className="flex items-center gap-1 hover:underline cursor-pointer"
                    >
                      <span>Ingresar al Módulo</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </Card>
              );
            })
          )}
        </div>
      </div>

      {/* Subordinates Management Section */}
      <Card
        title="Gestión de Encargados y Subordinados"
        subtitle="Crea perfiles operativos para tu personal de campo con su correo y contraseña de inicio de sesión."
        action={
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => navigate('/admin/subordinates')}
            >
              Administrar Todos
            </Button>
            <Button
              size="sm"
              variant="accent"
              onClick={handleOpenAddSubModal}
              icon={<Plus className="w-3.5 h-3.5" />}
            >
              Registrar Encargado
            </Button>
          </div>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-200 dark:border-[#263632] text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                <th className="py-3 px-4">Encargado</th>
                <th className="py-3 px-4">Correo Electrónico</th>
                <th className="py-3 px-4">Módulos Delegados (Autorizados)</th>
                <th className="py-3 px-4">Último Acceso</th>
                <th className="py-3 px-4">Estado</th>
                <th className="py-3 px-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-[#263632] text-xs">
              {displayedSubordinates.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-gray-500">
                    No hay encargados registrados en esta granja. Haz clic en "Registrar Encargado".
                  </td>
                </tr>
              ) : (
                (displayedSubordinates || []).map((sub) => (
                  <tr key={sub.id} className="hover:bg-gray-50/80 dark:hover:bg-[#263632]/50 transition-colors">
                    <td className="py-4 px-4">
                      <div className="font-bold text-[#1E1E1E] dark:text-gray-100">{safeText(sub.name)}</div>
                      <div className="text-[11px] text-[#4E9F3D] font-mono">Rol: Encargado de Campo</div>
                    </td>

                    <td className="py-4 px-4">
                      <div className="font-medium text-gray-800 dark:text-gray-200">{safeText(sub.email)}</div>
                      <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono">Credencial Activa</div>
                    </td>

                    <td className="py-4 px-4">
                      <div className="flex flex-wrap gap-1 max-w-xs">
                        {(sub.assignedModules || []).filter((m: string) => (farmModules || []).includes(m as ModuleId)).map((modId: string) => (
                          <span
                            key={`sub-tag-${sub.id}-${modId}`}
                            className="px-2 py-0.5 rounded-md bg-[#4E9F3D]/15 text-[#4E9F3D] text-[10px] font-bold"
                          >
                            {safeText(SYSTEM_MODULES[modId as ModuleId]?.name || modId)}
                          </span>
                        ))}
                      </div>
                    </td>

                    <td className="py-4 px-4 text-gray-500">
                      {safeText(sub.lastAccess, 'Hoy')}
                    </td>

                    <td className="py-4 px-4">
                      <StatusBadge isActive={sub.status === 'active' || (sub as any).is_active} gender="male" />
                    </td>

                    <td className="py-4 px-4 text-right space-x-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openEditSubModal(sub)}
                        icon={<Sliders className="w-3.5 h-3.5" />}
                      >
                        Editar / Permisos
                      </Button>

                      <Button
                        size="sm"
                        variant={sub.status === 'active' ? 'danger' : 'accent'}
                        onClick={() => toggleSubordinateStatus(sub.id)}
                      >
                        {sub.status === 'active' ? 'Desactivar' : 'Activar'}
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Modal: Registrar Nuevo Encargado */}
      <Modal
        isOpen={isAddSubModalOpen}
        onClose={() => setIsAddSubModalOpen(false)}
        title="Registrar Nuevo Encargado de Campo"
        subtitle="Define el nombre, correo y contraseña de inicio de sesión para el encargado de la granja."
        destroyOnClose={true}
      >
        <form onSubmit={handleCreateSubordinateSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
              Nombre Completo *
            </label>
            <input
              type="text"
              required
              placeholder="Ej: José Rodríguez"
              value={subName}
              onChange={(e) => setSubName(e.target.value)}
              className="w-full px-3 py-2 bg-gray-50 dark:bg-[#121816] border border-gray-200 dark:border-[#263632] rounded-xl text-xs focus:ring-2 focus:ring-[#1B4D3E]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Correo Electrónico *
              </label>
              <input
                type="email"
                required
                placeholder="encargado@granja.com"
                value={subEmail}
                onChange={(e) => setSubEmail(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 dark:bg-[#121816] border border-gray-200 dark:border-[#263632] rounded-xl text-xs focus:ring-2 focus:ring-[#1B4D3E]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Contraseña de Inicio de Sesión *
              </label>
              <input
                type="password"
                required
                placeholder="••••••••"
                value={subPassword}
                onChange={(e) => setSubPassword(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 dark:bg-[#121816] border border-gray-200 dark:border-[#263632] rounded-xl text-xs focus:ring-2 focus:ring-[#1B4D3E]"
              />
            </div>
          </div>

          <div className="border-t border-gray-100 dark:border-[#263632] pt-4">
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-bold text-[#1B4D3E] dark:text-[#6DBF5C] uppercase tracking-wider">
                Módulos Permitidos para la Granja ({farmModules.length}):
              </label>
              <span className="text-[10px] text-gray-400">Filtrado por permisos de Root</span>
            </div>
            
            {isFetchingModules ? (
              <div className="p-4 text-center text-xs text-gray-500">
                Consultando módulos activos de la granja con la API...
              </div>
            ) : farmModules.length === 0 ? (
              <div className="p-3.5 bg-amber-50 dark:bg-amber-950/40 rounded-xl border border-amber-200 dark:border-amber-900/50 text-xs text-amber-800 dark:text-amber-300 font-medium">
                ⚠️ No hay módulos activos disponibles para esta granja. El Administrador Root ha inhabilitado todos los módulos.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                {(farmModules || []).map((modId) => {
                  const mod = SYSTEM_MODULES[modId];
                  if (!mod) return null;
                  const isChecked = assignedModules.includes(modId);

                  return (
                    <label
                      key={`add-sub-mod-${modId}`}
                      className={`flex items-center p-2.5 rounded-xl border text-xs font-medium cursor-pointer transition-all ${
                        isChecked
                          ? 'bg-[#4E9F3D]/10 border-[#4E9F3D] text-[#1B4D3E] dark:text-[#6DBF5C]'
                          : 'bg-gray-50 dark:bg-[#121816] border-gray-200 dark:border-[#263632] text-gray-600'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {
                          setAssignedModules((prev) =>
                            prev.includes(modId)
                              ? prev.filter((m) => m !== modId)
                              : [...prev, modId]
                          );
                        }}
                        className="mr-2 accent-[#4E9F3D]"
                      />
                      {mod.name}
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button type="button" variant="outline" onClick={() => setIsAddSubModalOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="accent" disabled={farmModules.length === 0}>
              Crear Encargado
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Editar Datos y Permisos del Encargado */}
      <Modal
        isOpen={isEditSubModalOpen}
        onClose={() => setIsEditSubModalOpen(false)}
        title={`Editar Encargado: ${safeText(selectedSub?.name)}`}
        subtitle="Actualiza la información general, contraseña y los módulos autorizados para esta granja."
        destroyOnClose={true}
      >
        {selectedSub && (
          <form onSubmit={handleEditSubordinateSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Nombre Completo *
              </label>
              <input
                type="text"
                required
                value={editSubName}
                onChange={(e) => setEditSubName(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 dark:bg-[#121816] border border-gray-200 dark:border-[#263632] rounded-xl text-xs focus:ring-2 focus:ring-[#1B4D3E]"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Correo Electrónico *
                </label>
                <input
                  type="email"
                  required
                  value={editSubEmail}
                  onChange={(e) => setEditSubEmail(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-[#121816] border border-gray-200 dark:border-[#263632] rounded-xl text-xs focus:ring-2 focus:ring-[#1B4D3E]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Nueva Contraseña (Opcional)
                </label>
                <input
                  type="password"
                  placeholder="Dejar en blanco para conservar"
                  value={editSubPassword}
                  onChange={(e) => setEditSubPassword(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-[#121816] border border-gray-200 dark:border-[#263632] rounded-xl text-xs focus:ring-2 focus:ring-[#1B4D3E]"
                />
              </div>
            </div>

            <div className="border-t border-gray-100 dark:border-[#263632] pt-4">
              <label className="block text-xs font-bold text-[#1B4D3E] dark:text-[#6DBF5C] uppercase tracking-wider mb-2">
                Módulos Delegados (Solo autorizados por Root para esta granja):
              </label>

              {isFetchingModules ? (
                <div className="p-4 text-center text-xs text-gray-500">
                  Consultando módulos activos de la granja con la API...
                </div>
              ) : farmModules.length === 0 ? (
                <div className="p-3.5 bg-amber-50 dark:bg-amber-950/40 rounded-xl border border-amber-200 dark:border-amber-900/50 text-xs text-amber-800 dark:text-amber-300 font-medium">
                  ⚠️ No hay módulos activos disponibles para esta granja. El Administrador Root ha inhabilitado todos los módulos.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                  {(farmModules || []).map((modId) => {
                    const mod = SYSTEM_MODULES[modId];
                    if (!mod) return null;
                    const isChecked = editSubModules.includes(modId);

                    return (
                      <label
                        key={`edit-sub-mod-${modId}`}
                        className={`flex items-center p-2.5 rounded-xl border text-xs font-medium cursor-pointer transition-all ${
                          isChecked
                            ? 'bg-[#4E9F3D]/10 border-[#4E9F3D] text-[#1B4D3E] dark:text-[#6DBF5C]'
                            : 'bg-gray-50 dark:bg-[#121816] border-gray-200 dark:border-[#263632] text-gray-600'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {
                            setEditSubModules((prev) =>
                              prev.includes(modId)
                                ? prev.filter((m) => m !== modId)
                                : [...prev, modId]
                            );
                          }}
                          className="mr-2 accent-[#4E9F3D]"
                        />
                        {mod.name}
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex justify-end space-x-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setIsEditSubModalOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" variant="primary">
                Guardar Cambios
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
};

export default AdminDashboard;

