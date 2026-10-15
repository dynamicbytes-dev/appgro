import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { subordinateService } from '../../services/subordinateService';
import { farmService } from '../../services/farmService';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { Modal } from '../../components/ui/Modal';
import { SYSTEM_MODULES, normalizeModuleCode, isModuleItemEnabled, CODE_TO_MODULE_ID } from '../../config/modules';
import type { ModuleId } from '../../types/auth';
import {
  UserPlus,
  Search,
  Building2,
  Mail,
  Edit2,
  Power,
  Eye,
  ChevronLeft,
  ChevronRight,
  Phone,
  Lock,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  UserCheck,
} from 'lucide-react';
import { safeText } from '../../utils/safeText';

export const AdminSubordinatesView: React.FC = () => {
  const { user, activeFarm, enabledModules: authEnabledModules } = useAuth();
  const { toastSuccess, toastError } = useToast();

  const [subordinates, setSubordinates] = useState<any[]>([]);
  const [farmAvailableModules, setFarmAvailableModules] = useState<ModuleId[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Filters & Search
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 8;

  // Modal States
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedSub, setSelectedSub] = useState<any | null>(null);

  // Form Fields
  const [subFirstName, setSubFirstName] = useState('');
  const [subLastName, setSubLastName] = useState('');
  const [subEmail, setSubEmail] = useState('');
  const [subPhone, setSubPhone] = useState('');
  const [subPassword, setSubPassword] = useState('');
  const [selectedModules, setSelectedModules] = useState<string[]>([]);

  // Load available modules exclusively for the logged-in admin's farm
  const loadFarmModules = async (): Promise<ModuleId[]> => {
    const currentFarmId = activeFarm?.id || user?.farm_id || (user?.farm && user.farm.id);
    let resolvedModules: ModuleId[] = [];

    try {
      // 1. Consume dedicated endpoint GET /api/subordinates/available-modules
      const subModulesRes = await subordinateService.getAvailableModules(currentFarmId);
      if (Array.isArray(subModulesRes) && subModulesRes.length > 0) {
        const enabledList = subModulesRes
          .filter((m: any) => isModuleItemEnabled(m?.pivot?.is_enabled ?? m?.is_enabled ?? true))
          .map((m: any) => normalizeModuleCode(m?.code || m?.slug || m?.id))
          .filter(Boolean) as ModuleId[];

        if (enabledList.length > 0) {
          resolvedModules = Array.from(new Set(enabledList));
        }
      }

      // 2. Fallback to /api/farms/{id}/modules if needed
      if (resolvedModules.length === 0 && currentFarmId) {
        const farmRes = await farmService.getFarmModules(currentFarmId);
        const rawList = Array.isArray(farmRes) ? farmRes : farmRes?.data || farmRes?.modules || [];
        if (Array.isArray(rawList) && rawList.length > 0) {
          const enabledList = rawList
            .filter((m: any) => isModuleItemEnabled(m?.pivot?.is_enabled ?? m?.is_enabled))
            .map((m: any) => normalizeModuleCode(m?.code || m?.module?.code || m?.module_id || m?.id))
            .filter(Boolean) as ModuleId[];

          if (enabledList.length > 0) {
            resolvedModules = Array.from(new Set(enabledList));
          }
        }
      }
    } catch (err) {
      console.warn('Error al consultar módulos activos de la granja:', err);
    }

    // 3. Fallback: check admin's user.enabledModules or authContext.enabledModules
    if (resolvedModules.length === 0) {
      const sourceList = (user?.enabledModules && user.enabledModules.length > 0)
        ? user.enabledModules
        : authEnabledModules || [];

      resolvedModules = sourceList
        .map((m: any) => normalizeModuleCode(typeof m === 'string' ? m : m?.code || m?.id))
        .filter(Boolean) as ModuleId[];
    }

    const unique = Array.from(new Set(resolvedModules));
    setFarmAvailableModules(unique);
    return unique;
  };

  // Load subordinates for the admin's farm from backend API
  const loadSubordinates = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const currentFarmId = activeFarm?.id || user?.farm_id || (user?.farm && user.farm.id);
      const data = await subordinateService.getAllSubordinates(currentFarmId);
      const list = Array.isArray(data) ? data : [];

      // Strictly ensure only subordinates belonging to current admin's farm are processed
      const farmFiltered = currentFarmId
        ? list.filter((s: any) => !s.farm_id || String(s.farm_id) === String(currentFarmId))
        : list;

      const mapped = farmFiltered.map((s: any) => {
        // Extract assigned modules
        const rawMods = s.subordinate_modules || s.subordinateModules || s.assigned_modules || s.assignedModules || [];
        const cleanMods: string[] = Array.isArray(rawMods)
          ? rawMods
              .map((m: any) => {
                if (typeof m === 'string') return normalizeModuleCode(m) || m;
                if (m?.pivot) {
                  if (!m.pivot.is_enabled) return null;
                  return normalizeModuleCode(m.code || m.id) || m.code;
                }
                if (m?.is_enabled !== undefined && !m.is_enabled) return null;
                return normalizeModuleCode(m?.code || m?.slug || m?.id) || m?.code || m?.id || '';
              })
              .filter(Boolean)
          : [];

        const firstName = s.name || '';
        const lastName = s.lastname || '';
        const fullName = lastName ? `${firstName} ${lastName}`.trim() : firstName;

        return {
          id: s.id,
          name: fullName || 'Encargado de Campo',
          firstName,
          lastName,
          email: s.email || '',
          phone: s.phone || '',
          role: s.role || 'subordinate',
          farmId: s.farm_id || activeFarm?.id,
          farmName: s.farm?.name || activeFarm?.name || 'Mi Granja',
          assignedModules: cleanMods,
          status: s.is_active !== undefined ? (s.is_active ? 'active' : 'inactive') : (s.status || 'active'),
          is_active: s.is_active !== undefined ? Boolean(s.is_active) : true,
          createdAt: s.created_at || s.createdAt || '',
        };
      });

      setSubordinates(mapped);
    } catch (err: any) {
      setErrorMessage(
        err.response?.data?.message || 'Error al conectar con la API de Encargados de Granja.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSubordinates();
    loadFarmModules();
  }, [activeFarm?.id, user?.farm_id]);

  // Filtering & Pagination
  const filteredSubordinates = subordinates.filter((s) => {
    const query = searchTerm.toLowerCase();
    const matchesSearch =
      s.name.toLowerCase().includes(query) ||
      s.email.toLowerCase().includes(query) ||
      (s.phone && s.phone.includes(searchTerm)) ||
      s.assignedModules.some((m: string) => m.toLowerCase().includes(query));
    const matchesStatus = statusFilter === 'all' || s.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalPages = Math.max(1, Math.ceil(filteredSubordinates.length / pageSize));
  const activePage = Math.min(currentPage, totalPages);
  const startIndex = (activePage - 1) * pageSize;
  const paginatedSubordinates = filteredSubordinates.slice(startIndex, startIndex + pageSize);

  const resetForm = (availableList: ModuleId[] = farmAvailableModules) => {
    setSubFirstName('');
    setSubLastName('');
    setSubEmail('');
    setSubPhone('');
    setSubPassword('');
    // By default, select only modules currently active in the admin's farm
    setSelectedModules([...availableList]);
  };

  const openAddModal = async () => {
    const modules = await loadFarmModules();
    resetForm(modules);
    setIsAddModalOpen(true);
  };

  const openEditModal = async (sub: any) => {
    setSelectedSub(sub);
    const available = await loadFarmModules();
    const nameParts = (sub.name || '').trim().split(' ');
    setSubFirstName(sub.firstName || nameParts[0] || '');
    setSubLastName(sub.lastName || nameParts.slice(1).join(' ') || '');
    setSubEmail(sub.email || '');
    setSubPhone(sub.phone || '');
    setSubPassword('');

    // Pre-select only assigned modules that are currently ACTIVE in the admin's farm
    const currentMods = (sub.assignedModules || [])
      .map((m: any) => normalizeModuleCode(m))
      .filter((m: any): m is ModuleId => Boolean(m) && available.includes(m as ModuleId));

    setSelectedModules(currentMods);
    setIsEditModalOpen(true);
  };

  const openDetailModal = (sub: any) => {
    setSelectedSub(sub);
    setIsDetailModalOpen(true);
  };

  const toggleModuleSelection = (moduleId: string) => {
    // Strictly prevent toggling restricted or disabled modules
    if (!farmAvailableModules.includes(moduleId as ModuleId)) {
      toastError(
        'Módulo No Disponible',
        `El módulo "${SYSTEM_MODULES[moduleId as keyof typeof SYSTEM_MODULES]?.name || moduleId}" no está habilitado en tu granja.`
      );
      return;
    }

    setSelectedModules((prev) =>
      prev.includes(moduleId) ? prev.filter((m) => m !== moduleId) : [...prev, moduleId]
    );
  };

  const CODE_TO_ID: Record<string, number> = CODE_TO_MODULE_ID;

  // Submit Handler: Create Subordinate
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subFirstName.trim()) {
      toastError('Nombre Requerido', 'Ingresa el nombre del encargado.');
      return;
    }
    if (!subEmail.trim() || !subEmail.includes('@')) {
      toastError('Correo Inválido', 'Ingresa un correo electrónico válido.');
      return;
    }
    if (!subPassword || subPassword.length < 6) {
      toastError('Contraseña Inválida', 'La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    // Strictly enforce authorized modules belonging to the farm
    const authorizedModules = selectedModules.filter((m) =>
      farmAvailableModules.includes(m as ModuleId)
    );
    const moduleIds = authorizedModules.map((m) => CODE_TO_ID[m]).filter(Boolean);
    const fullName = `${subFirstName.trim()} ${subLastName.trim()}`.trim();

    try {
      await subordinateService.createSubordinate({
        name: subFirstName.trim(),
        lastname: subLastName.trim() || undefined,
        email: subEmail.trim(),
        phone: subPhone.trim() || undefined,
        password: subPassword,
        is_active: true,
        module_ids: moduleIds,
        modules: authorizedModules,
      });

      setSuccessMessage(`Encargado ${fullName} registrado correctamente.`);
      toastSuccess('Encargado Creado', `Se generó el acceso para ${fullName}.`);
      setIsAddModalOpen(false);
      resetForm();
      loadSubordinates();
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Error al registrar encargado.';
      toastError('Error al Crear', msg);
    }
  };

  // Submit Handler: Edit Subordinate
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSub) return;
    if (!subFirstName.trim()) {
      toastError('Nombre Requerido', 'Ingresa el nombre del encargado.');
      return;
    }
    if (!subEmail.trim() || !subEmail.includes('@')) {
      toastError('Correo Inválido', 'Ingresa un correo electrónico válido.');
      return;
    }

    // Strictly enforce authorized modules belonging to the farm
    const authorizedModules = selectedModules.filter((m) =>
      farmAvailableModules.includes(m as ModuleId)
    );
    const moduleIds = authorizedModules.map((m) => CODE_TO_ID[m]).filter(Boolean);
    const fullName = `${subFirstName.trim()} ${subLastName.trim()}`.trim();

    try {
      const payload: any = {
        name: subFirstName.trim(),
        lastname: subLastName.trim() || undefined,
        email: subEmail.trim(),
        phone: subPhone.trim() || undefined,
        module_ids: moduleIds,
        modules: authorizedModules,
      };

      if (subPassword.trim() && subPassword.length >= 6) {
        payload.password = subPassword.trim();
      }

      await subordinateService.updateSubordinate(selectedSub.id, payload);

      setSubordinates((prev) =>
        prev.map((s) => {
          if (s.id === selectedSub.id) {
            return {
              ...s,
              name: fullName,
              firstName: subFirstName.trim(),
              lastName: subLastName.trim(),
              email: subEmail.trim(),
              phone: subPhone.trim(),
              assignedModules: selectedModules,
            };
          }
          return s;
        })
      );

      setSuccessMessage(`Encargado ${fullName} actualizado correctamente con ${selectedModules.length} módulos.`);
      toastSuccess('Encargado Actualizado', `Perfil y permisos de ${fullName} guardados.`);
      setIsEditModalOpen(false);
      loadSubordinates();
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Error al actualizar encargado.';
      toastError('Error al Actualizar', msg);
    }
  };

  // Toggle Subordinate Active Status
  const handleToggleStatus = async (sub: any) => {
    const newStatus = sub.status === 'active' ? 'inactive' : 'active';
    const isNowActive = newStatus === 'active';

    try {
      await subordinateService.updateSubordinate(sub.id, {
        is_active: isNowActive,
      });

      setSubordinates((prev) =>
        prev.map((s) => (s.id === sub.id ? { ...s, status: newStatus, is_active: isNowActive } : s))
      );

      toastSuccess(
        'Estado Modificado',
        `Acceso del encargado ${sub.name} cambiado a ${isNowActive ? 'Activo' : 'Inactivo'}.`
      );
    } catch (err: any) {
      toastError('Error de Estado', err.response?.data?.message || 'No se pudo cambiar el estado.');
    }
  };

  const farmTitle = activeFarm?.name || user?.farmName || 'Mi Granja Agropecuaria';

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* Header Banner replicating Root Admins Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-[#18221F] p-6 rounded-2xl border border-gray-200 dark:border-[#263632] shadow-sm">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#4E9F3D]/10 text-[#4E9F3D] text-[11px] font-bold mb-1.5 border border-[#4E9F3D]/20">
            <Building2 className="w-3.5 h-3.5" />
            <span>{safeText(farmTitle)}</span>
          </div>
          <h1 className="text-xl font-black text-[#1E1E1E] dark:text-gray-100 flex items-center gap-2">
            <UserCheck className="w-6 h-6 text-[#1B4D3E] dark:text-[#4E9F3D]" />
            Gestión de Encargados de Campo
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Administra los usuarios operativos de tu granja y asigna los módulos a los que tendrán acceso en campo.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => { loadSubordinates(); loadFarmModules(); }}
            icon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            Actualizar Lista
          </Button>
          <Button
            variant="accent"
            size="sm"
            onClick={openAddModal}
            icon={<UserPlus className="w-4 h-4" />}
          >
            Nuevo Encargado
          </Button>
        </div>
      </div>

      {/* Notification Banners */}
      {successMessage && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs text-emerald-800 dark:text-emerald-300 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#4E9F3D] shrink-0" />
            <span>{safeText(successMessage)}</span>
          </div>
          <button onClick={() => setSuccessMessage(null)} className="font-bold text-xs">✕</button>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 rounded-xl text-xs text-red-700 dark:text-red-300 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{safeText(errorMessage)}</span>
          </div>
          <button onClick={() => setErrorMessage(null)} className="font-bold text-xs">✕</button>
        </div>
      )}

      {/* Filters & Search Control Card */}
      <Card className="p-4">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="relative w-full md:w-96">
            <Search className="w-4 h-4 absolute left-3.5 top-3 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por nombre, correo, teléfono o módulo..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-10 pr-4 py-2 bg-[#F9F9F9] dark:bg-[#121816] border border-gray-200 dark:border-[#263632] rounded-xl text-xs focus:ring-2 focus:ring-[#1B4D3E] text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
            />
          </div>

          <div className="flex items-center space-x-2 w-full md:w-auto">
            <span className="text-xs text-[#1E1E1E] dark:text-gray-300 font-medium">Estado:</span>
            <select
              value={statusFilter}
              onChange={(e: any) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="px-3 py-1.5 bg-[#F9F9F9] dark:bg-[#121816] border border-gray-200 dark:border-[#263632] rounded-xl text-xs focus:ring-2 focus:ring-[#1B4D3E] text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
            >
              <option value="all">Todos los estados</option>
              <option value="active">Activos</option>
              <option value="inactive">Inactivos</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Subordinates Clean Data Table */}
      <Card className="overflow-hidden">
        {isLoading ? (
          <div key="subordinates-loading-state" className="p-12 text-center text-xs text-gray-500">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto text-[#1B4D3E] mb-2" />
            <p className="mt-2 text-xs text-gray-500">Cargando lista de encargados de la granja...</p>
          </div>
        ) : (
          <div key="subordinates-table-wrapper" className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#F9F9F9] dark:bg-[#121816] border-b border-gray-200 dark:border-[#263632] text-[11px] font-bold uppercase text-[#1E1E1E] dark:text-gray-400 tracking-wider">
                  <th className="py-3.5 px-4">Nombre</th>
                  <th className="py-3.5 px-4">Correo</th>
                  <th className="py-3.5 px-4 text-center">Estado</th>
                  <th className="py-3.5 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-[#263632] text-xs">
                {paginatedSubordinates.length === 0 ? (
                  <tr key="subordinates-empty-state-row">
                    <td colSpan={4} className="py-8 text-center text-gray-500">
                      <p className="text-xs text-gray-500">No se encontraron encargados registrados para esta granja.</p>
                    </td>
                  </tr>
                ) : (
                  paginatedSubordinates.map((subordinate) => {
                    const subName = typeof subordinate?.name === 'string' ? subordinate.name : safeText(subordinate?.name, 'Encargado');
                    const subInitial = (subName.charAt(0) || 'E').toUpperCase();
                    const subEmail = typeof subordinate?.email === 'string' ? subordinate.email : safeText(subordinate?.email, 'Sin correo');
                    const subPhone = typeof subordinate?.phone === 'string' ? subordinate.phone : safeText(subordinate?.phone, '');
                    const isAccountActive = Boolean(subordinate.status === 'active' || subordinate.is_active);

                    return (
                      <tr
                        key={subordinate.id}
                        className="hover:bg-gray-50/50 dark:hover:bg-[#18221F]/50 transition-colors"
                      >
                        <td className="py-3.5 px-4 font-bold text-[#1E1E1E] dark:text-gray-100">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-[#1B4D3E]/10 dark:bg-[#4E9F3D]/20 text-[#1B4D3E] dark:text-[#4E9F3D] flex items-center justify-center font-black text-xs shrink-0">
                              {subInitial}
                            </div>
                            <div>
                              <span className="block font-bold text-sm text-[#1E1E1E] dark:text-gray-100 leading-tight">
                                {subName}
                              </span>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-[10px] text-gray-400 font-normal">
                                  Encargado Operativo
                                </span>
                                {subPhone && (
                                  <span className="text-[10px] text-gray-400 font-mono flex items-center gap-1">
                                    <Phone className="w-2.5 h-2.5 text-[#4E9F3D]" />
                                    {subPhone}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="py-3.5 px-4 text-gray-600 dark:text-gray-300">
                          <div className="flex items-center gap-1.5">
                            <Mail className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                            <span>{subEmail}</span>
                          </div>
                          {(subordinate.assignedModules || []).length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {(subordinate.assignedModules || []).slice(0, 3).map((modId: string) => {
                                const modConfig = SYSTEM_MODULES[modId as keyof typeof SYSTEM_MODULES];
                                const label = modConfig?.name || modId;
                                return (
                                  <span
                                    key={`sub-tag-${subordinate.id}-${modId}`}
                                    className="px-1.5 py-0.5 rounded bg-[#4E9F3D]/10 text-[#4E9F3D] text-[10px] font-semibold"
                                  >
                                    {safeText(label)}
                                  </span>
                                );
                              })}
                              {(subordinate.assignedModules || []).length > 3 && (
                                <span className="text-[10px] text-gray-400 font-semibold self-center">
                                  +{(subordinate.assignedModules || []).length - 3} más
                                </span>
                              )}
                            </div>
                          )}
                        </td>

                        <td className="py-3.5 px-4 text-center">
                          <StatusBadge isActive={subordinate.is_active ?? subordinate.status} gender="male" />
                        </td>

                        <td className="py-3.5 px-4 text-right space-x-1 whitespace-nowrap">
                          <button
                            onClick={() => openDetailModal(subordinate)}
                            className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors cursor-pointer inline-flex items-center justify-center"
                            title="Ver detalles"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => openEditModal(subordinate)}
                            className="p-1.5 rounded-lg text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40 transition-colors cursor-pointer inline-flex items-center justify-center"
                            title="Editar permisos"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => handleToggleStatus(subordinate)}
                            className={`p-1.5 rounded-lg transition-colors cursor-pointer inline-flex items-center justify-center ${
                              isAccountActive
                                ? 'text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40'
                                : 'text-[#4E9F3D] hover:bg-emerald-50 dark:hover:bg-emerald-950/40'
                            }`}
                            title={isAccountActive ? 'Desactivar Cuenta' : 'Activar Cuenta'}
                          >
                            <Power className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        <div key="subordinates-pagination-bar" className="p-4 bg-[#F9F9F9] dark:bg-[#121816] border-t border-gray-200 dark:border-[#263632] flex items-center justify-between text-xs">
          <span className="text-gray-500">
            {`Mostrando ${filteredSubordinates.length === 0 ? 0 : startIndex + 1} a ${Math.min(startIndex + pageSize, filteredSubordinates.length)} de ${filteredSubordinates.length} Encargados`}
          </span>

          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              disabled={activePage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </Button>
            <span className="font-bold text-[#1E1E1E] dark:text-gray-300">
              {`${activePage} / ${totalPages}`}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={activePage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </Card>

      {/* Modal: Registrar Nuevo Encargado */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Registrar Nuevo Encargado de Campo"
        subtitle="Crea un perfil de acceso operativo con credenciales y módulos autorizados."
        destroyOnClose={true}
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#1E1E1E] dark:text-gray-300 mb-1">
                Nombre <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="Ej: José"
                value={subFirstName}
                onChange={(e) => setSubFirstName(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-[#F9F9F9] dark:bg-[#121816] border border-gray-200 dark:border-[#263632] rounded-xl text-xs focus:ring-2 focus:ring-[#1B4D3E] text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#1E1E1E] dark:text-gray-300 mb-1">
                Apellido
              </label>
              <input
                type="text"
                placeholder="Ej: Rodríguez"
                value={subLastName}
                onChange={(e) => setSubLastName(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-[#F9F9F9] dark:bg-[#121816] border border-gray-200 dark:border-[#263632] rounded-xl text-xs focus:ring-2 focus:ring-[#1B4D3E] text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#1E1E1E] dark:text-gray-300 mb-1">
                Correo Electrónico <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                required
                placeholder="encargado@granja.com"
                value={subEmail}
                onChange={(e) => setSubEmail(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-[#F9F9F9] dark:bg-[#121816] border border-gray-200 dark:border-[#263632] rounded-xl text-xs focus:ring-2 focus:ring-[#1B4D3E] text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#1E1E1E] dark:text-gray-300 mb-1">
                Teléfono de Contacto
              </label>
              <input
                type="tel"
                placeholder="+58 412 1234567"
                value={subPhone}
                onChange={(e) => setSubPhone(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-[#F9F9F9] dark:bg-[#121816] border border-gray-200 dark:border-[#263632] rounded-xl text-xs focus:ring-2 focus:ring-[#1B4D3E] text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#1E1E1E] dark:text-gray-300 mb-1">
              Contraseña de Acceso <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
              <input
                type="password"
                required
                minLength={6}
                placeholder="Mínimo 6 caracteres"
                value={subPassword}
                onChange={(e) => setSubPassword(e.target.value)}
                className="w-full pl-9 pr-3.5 py-2.5 bg-[#F9F9F9] dark:bg-[#121816] border border-gray-200 dark:border-[#263632] rounded-xl text-xs focus:ring-2 focus:ring-[#1B4D3E] text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
              />
            </div>
          </div>

          {/* Module selection for subordinate */}
          <div className="border-t border-gray-200 dark:border-[#263632] pt-3">
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-bold text-[#1B4D3E] dark:text-[#4E9F3D] uppercase tracking-wider">
                Módulos Permitidos para el Encargado
              </label>
              <span className="text-[10px] text-gray-500 font-semibold">
                {farmAvailableModules.length} de {Object.keys(SYSTEM_MODULES).length} activos en tu granja
              </span>
            </div>
            <p className="text-[11px] text-gray-500 mb-2.5">
              Solo puedes asignar módulos activos de tu granja. Los módulos no habilitados se muestran bloqueados.
            </p>

            {farmAvailableModules.length === 0 ? (
              <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl text-xs text-amber-800 dark:text-amber-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Tu granja no tiene módulos operativos habilitados actualmente. Solicita al Administrador Root que habilite módulos para poder asignarlos a tus encargados.</span>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-52 overflow-y-auto p-2 bg-[#F9F9F9] dark:bg-[#121816] rounded-xl border border-gray-200 dark:border-[#263632]">
                {Object.entries(SYSTEM_MODULES).map(([key, config]) => {
                  const isAvailable = farmAvailableModules.includes(key as ModuleId);
                  const isSelected = isAvailable && selectedModules.includes(key);

                  if (!isAvailable) {
                    return (
                      <div
                        key={`add-sub-mod-locked-${key}`}
                        className="flex items-center justify-between p-2 rounded-lg border border-dashed border-gray-200 dark:border-gray-800 bg-gray-100/60 dark:bg-gray-900/30 text-gray-400 opacity-60 cursor-not-allowed select-none"
                        title="Módulo no habilitado en tu granja. No puedes asignarlo."
                      >
                        <div className="flex items-center space-x-2 truncate">
                          <input
                            type="checkbox"
                            disabled
                            checked={false}
                            className="w-4 h-4 rounded opacity-40 cursor-not-allowed"
                          />
                          <span className="text-xs truncate text-gray-400">
                            {config.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 text-[10px] text-gray-400 shrink-0 font-medium bg-gray-200/60 dark:bg-gray-800 px-1.5 py-0.5 rounded">
                          <Lock className="w-3 h-3" />
                          <span>Bloqueado</span>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <label
                      key={`add-sub-mod-${key}`}
                      className={`flex items-center justify-between p-2 rounded-lg border text-xs cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-white dark:bg-[#18221F] border-[#4E9F3D] text-[#1E1E1E] dark:text-gray-100 font-semibold shadow-xs ring-1 ring-[#4E9F3D]/20'
                          : 'bg-white dark:bg-[#18221F]/50 border-gray-200 dark:border-[#263632] text-gray-600 dark:text-gray-300 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center space-x-2 truncate">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleModuleSelection(key)}
                          className="accent-[#1B4D3E] w-4 h-4 rounded cursor-pointer"
                        />
                        <span className="truncate">{config.name}</span>
                      </div>
                      <span className="text-[10px] text-[#4E9F3D] font-bold bg-[#4E9F3D]/10 px-1.5 py-0.5 rounded shrink-0">
                        Habilitado
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex justify-end space-x-2 pt-4 border-t border-gray-200 dark:border-[#263632]">
            <Button type="button" variant="outline" onClick={() => setIsAddModalOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="accent">
              Registrar Encargado
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Editar Encargado / Permisos */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title={`Editar Encargado: ${safeText(selectedSub?.name)}`}
        subtitle="Actualiza datos de contacto y permisos de módulos en campo."
        destroyOnClose={true}
      >
        <form onSubmit={handleEditSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#1E1E1E] dark:text-gray-300 mb-1">
                Nombre <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={subFirstName}
                onChange={(e) => setSubFirstName(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-[#F9F9F9] dark:bg-[#121816] border border-gray-200 dark:border-[#263632] rounded-xl text-xs focus:ring-2 focus:ring-[#1B4D3E] text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#1E1E1E] dark:text-gray-300 mb-1">
                Apellido
              </label>
              <input
                type="text"
                value={subLastName}
                onChange={(e) => setSubLastName(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-[#F9F9F9] dark:bg-[#121816] border border-gray-200 dark:border-[#263632] rounded-xl text-xs focus:ring-2 focus:ring-[#1B4D3E] text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#1E1E1E] dark:text-gray-300 mb-1">
                Correo Electrónico <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                required
                value={subEmail}
                onChange={(e) => setSubEmail(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-[#F9F9F9] dark:bg-[#121816] border border-gray-200 dark:border-[#263632] rounded-xl text-xs focus:ring-2 focus:ring-[#1B4D3E] text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#1E1E1E] dark:text-gray-300 mb-1">
                Teléfono
              </label>
              <input
                type="tel"
                value={subPhone}
                onChange={(e) => setSubPhone(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-[#F9F9F9] dark:bg-[#121816] border border-gray-200 dark:border-[#263632] rounded-xl text-xs focus:ring-2 focus:ring-[#1B4D3E] text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#1E1E1E] dark:text-gray-300 mb-1">
              Nueva Contraseña (Opcional)
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
              <input
                type="password"
                placeholder="Dejar en blanco para conservar la actual"
                value={subPassword}
                onChange={(e) => setSubPassword(e.target.value)}
                className="w-full pl-9 pr-3.5 py-2.5 bg-[#F9F9F9] dark:bg-[#121816] border border-gray-200 dark:border-[#263632] rounded-xl text-xs focus:ring-2 focus:ring-[#1B4D3E] text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
              />
            </div>
          </div>

          {/* Module selection for subordinate */}
          <div className="border-t border-gray-200 dark:border-[#263632] pt-3">
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-bold text-[#1B4D3E] dark:text-[#4E9F3D] uppercase tracking-wider">
                Módulos Permitidos para el Encargado
              </label>
              <span className="text-[10px] text-gray-500 font-semibold">
                {farmAvailableModules.length} de {Object.keys(SYSTEM_MODULES).length} activos en tu granja
              </span>
            </div>
            <p className="text-[11px] text-gray-500 mb-2.5">
              Solo puedes asignar módulos activos de tu granja. Los módulos no habilitados se muestran bloqueados.
            </p>

            {farmAvailableModules.length === 0 ? (
              <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl text-xs text-amber-800 dark:text-amber-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Tu granja no tiene módulos operativos habilitados actualmente. Solicita al Administrador Root que habilite módulos para poder asignarlos a tus encargados.</span>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-52 overflow-y-auto p-2 bg-[#F9F9F9] dark:bg-[#121816] rounded-xl border border-gray-200 dark:border-[#263632]">
                {Object.entries(SYSTEM_MODULES).map(([key, config]) => {
                  const isAvailable = farmAvailableModules.includes(key as ModuleId);
                  const isSelected = isAvailable && selectedModules.includes(key);

                  if (!isAvailable) {
                    return (
                      <div
                        key={`edit-sub-mod-locked-${key}`}
                        className="flex items-center justify-between p-2 rounded-lg border border-dashed border-gray-200 dark:border-gray-800 bg-gray-100/60 dark:bg-gray-900/30 text-gray-400 opacity-60 cursor-not-allowed select-none"
                        title="Módulo no habilitado en tu granja. No puedes asignarlo."
                      >
                        <div className="flex items-center space-x-2 truncate">
                          <input
                            type="checkbox"
                            disabled
                            checked={false}
                            className="w-4 h-4 rounded opacity-40 cursor-not-allowed"
                          />
                          <span className="text-xs truncate text-gray-400">
                            {config.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 text-[10px] text-gray-400 shrink-0 font-medium bg-gray-200/60 dark:bg-gray-800 px-1.5 py-0.5 rounded">
                          <Lock className="w-3 h-3" />
                          <span>Bloqueado</span>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <label
                      key={`edit-sub-mod-${key}`}
                      className={`flex items-center justify-between p-2 rounded-lg border text-xs cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-white dark:bg-[#18221F] border-[#4E9F3D] text-[#1E1E1E] dark:text-gray-100 font-semibold shadow-xs ring-1 ring-[#4E9F3D]/20'
                          : 'bg-white dark:bg-[#18221F]/50 border-gray-200 dark:border-[#263632] text-gray-600 dark:text-gray-300 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center space-x-2 truncate">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleModuleSelection(key)}
                          className="accent-[#1B4D3E] w-4 h-4 rounded cursor-pointer"
                        />
                        <span className="truncate">{config.name}</span>
                      </div>
                      <span className="text-[10px] text-[#4E9F3D] font-bold bg-[#4E9F3D]/10 px-1.5 py-0.5 rounded shrink-0">
                        Habilitado
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex justify-end space-x-2 pt-4 border-t border-gray-200 dark:border-[#263632]">
            <Button type="button" variant="outline" onClick={() => setIsEditModalOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="accent">
              Guardar Cambios
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Ver Detalles Encargado */}
      <Modal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        title={`Ficha de Encargado: ${safeText(selectedSub?.name)}`}
        destroyOnClose={true}
      >
        {selectedSub && (
          <div className="space-y-3 text-xs">
            <div className="p-3 bg-[#F9F9F9] dark:bg-[#121816] rounded-xl border border-gray-200 dark:border-[#263632] flex justify-between">
              <span className="font-bold text-gray-500">Nombre Completo:</span>
              <span className="font-bold text-[#1E1E1E] dark:text-gray-100">{safeText(selectedSub.name)}</span>
            </div>
            <div className="p-3 bg-[#F9F9F9] dark:bg-[#121816] rounded-xl border border-gray-200 dark:border-[#263632] flex justify-between">
              <span className="font-bold text-gray-500">Correo Electrónico:</span>
              <span className="text-[#1E1E1E] dark:text-gray-200">{safeText(selectedSub.email)}</span>
            </div>
            <div className="p-3 bg-[#F9F9F9] dark:bg-[#121816] rounded-xl border border-gray-200 dark:border-[#263632] flex justify-between">
              <span className="font-bold text-gray-500">Teléfono:</span>
              <span className="text-[#1E1E1E] dark:text-gray-200">{safeText(selectedSub.phone, 'No registrado')}</span>
            </div>
            <div className="p-3 bg-[#F9F9F9] dark:bg-[#121816] rounded-xl border border-gray-200 dark:border-[#263632] flex justify-between">
              <span className="font-bold text-gray-500">Granja Operativa:</span>
              <span className="font-bold text-[#1B4D3E] dark:text-[#4E9F3D]">
                {safeText(selectedSub.farmName || farmTitle)}
              </span>
            </div>
            <div className="p-3 bg-[#F9F9F9] dark:bg-[#121816] rounded-xl border border-gray-200 dark:border-[#263632] space-y-1.5">
              <span className="font-bold text-gray-500 block">Módulos Asignados:</span>
              <div className="flex flex-wrap gap-1">
                {(selectedSub.assignedModules || []).length === 0 ? (
                  <span className="text-gray-400 italic">Sin módulos habilitados</span>
                ) : (
                  (selectedSub.assignedModules || []).map((modItem: any) => {
                    const modCode = typeof modItem === 'string' ? modItem : modItem?.code || modItem?.id || '';
                    const modName = SYSTEM_MODULES[modCode as keyof typeof SYSTEM_MODULES]?.name || safeText(modItem?.name, modCode);
                    return (
                      <span
                        key={`sub-detail-tag-${modCode || Math.random()}`}
                        className="px-2 py-0.5 bg-emerald-50 dark:bg-emerald-950/40 text-[#1B4D3E] dark:text-[#4E9F3D] border border-emerald-200 dark:border-emerald-800 rounded text-[10px] font-semibold"
                      >
                        {safeText(modName)}
                      </span>
                    );
                  })
                )}
              </div>
            </div>
            <div className="p-3 bg-[#F9F9F9] dark:bg-[#121816] rounded-xl border border-gray-200 dark:border-[#263632] flex items-center justify-between">
              <span className="font-bold text-gray-500">Estado de Cuenta:</span>
              <StatusBadge isActive={selectedSub.is_active ?? selectedSub.status} gender="male" />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default AdminSubordinatesView;
