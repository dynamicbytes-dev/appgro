import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { adminService } from '../../services/adminService';
import { farmService } from '../../services/farmService';
import { getSectorLabel } from './RootFarmsView';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { Modal } from '../../components/ui/Modal';
import { SkeletonLoader } from '../../components/ui/SkeletonLoader';
import { SYSTEM_MODULES, normalizeModuleCode, isModuleItemEnabled, CODE_TO_MODULE_ID } from '../../config/modules';
import type { User, Farm } from '../../types/auth';
import {
  Users,
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
  Compass,
  CheckCircle2,
} from 'lucide-react';

import { safeText } from '../../utils/safeText';

export const RootAdminsView: React.FC = () => {
  const { farms } = useAuth();
  const { toastSuccess, toastError } = useToast();

  const [farmsList, setFarmsList] = useState<Farm[]>(() => (Array.isArray(farms) ? farms : []));
  const [isLoadingFarms, setIsLoadingFarms] = useState<boolean>(false);

  const [admins, setAdmins] = useState<User[]>(() => [
    {
      id: 'admin-1',
      name: 'Carlos Mendoza',
      email: 'admin@elporvenir.com',
      phone: '+58 414 1234567',
      role: 'ADMIN',
      farmId: 'farm-1',
      farmName: 'Granja El Porvenir',
      enabledModules: ['especies', 'galpones', 'lotes', 'actividades', 'analitica'],
      status: 'active',
      createdAt: '2026-01-15',
    },
    {
      id: 'admin-2',
      name: 'Elena Rostova',
      email: 'admin@santalucia.com',
      phone: '+58 424 9876543',
      role: 'ADMIN',
      farmId: 'farm-2',
      farmName: 'Avícola Santa Lucía',
      enabledModules: ['especies', 'galpones', 'lotes', 'actividades', 'analitica'],
      status: 'active',
      createdAt: '2026-02-10',
    },
    {
      id: 'admin-3',
      name: 'Roberto Silva',
      email: 'admin@laesperanza.com',
      phone: '+58 412 5554321',
      role: 'ADMIN',
      farmId: 'farm-3',
      farmName: 'Hacienda La Esperanza',
      enabledModules: ['especies', 'galpones', 'lotes', 'actividades', 'analitica'],
      status: 'active',
      createdAt: '2026-03-01',
    },
  ]);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [togglingAdminId, setTogglingAdminId] = useState<number | string | null>(null);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 5;

  // Modals
  const [isAddAdminOpen, setIsAddAdminOpen] = useState(false);
  const [isEditAdminOpen, setIsEditAdminOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedAdmin, setSelectedAdmin] = useState<User | null>(null);

  // Form Fields
  const [adminFirstName, setAdminFirstName] = useState('');
  const [adminLastName, setAdminLastName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPhone, setAdminPhone] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [selectedFarmId, setSelectedFarmId] = useState('');
  const [selectedModules, setSelectedModules] = useState<string[]>([
    'especies',
    'galpones',
    'lotes',
    'actividades',
    'analitica',
    'historial',
  ]);

  // Load admins from Backend API via Axios (JWT Interceptor attached)
  const loadAdmins = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const rawData = await adminService.getAllAdmins();
      const list = Array.isArray(rawData) ? rawData : Array.isArray(rawData?.data) ? rawData.data : [];
      const mapped = list.map((a: any) => {
        const rawModules = a.enabled_modules || a.enabledModules || a.modules || a.farm?.modules || ["especies", "galpones", "lotes", "actividades", "analitica"];
        const cleanModules = Array.isArray(rawModules)
          ? rawModules.map((m: any) => {
              if (typeof m === 'string') return normalizeModuleCode(m) || m;
              if (m?.pivot) {
                if (!m.pivot.is_enabled) return null;
                return normalizeModuleCode(m.code || m.id) || m.code;
              }
              if (m?.is_enabled !== undefined && !m.is_enabled) return null;
              return normalizeModuleCode(m?.code || m?.slug || m?.id) || m?.code || m?.id || '';
            }).filter(Boolean)
          : ["especies", "galpones", "lotes", "actividades", "analitica"];

        const resolvedFarmName =
          typeof a.farm === 'string'
            ? a.farm
            : typeof a.farm?.name === 'string'
            ? a.farm.name
            : typeof a.farmName === 'string'
            ? a.farmName
            : typeof a.farm_name === 'string'
            ? a.farm_name
            : typeof a.farmName?.name === 'string'
            ? a.farmName.name
            : "Sin Granja";

        return {
          id: a.id,
          name: a.lastname ? `${safeText(a.name)} ${safeText(a.lastname)}` : safeText(a.name, 'Admin'),
          firstName: safeText(a.name),
          lastName: safeText(a.lastname),
          email: safeText(a.email),
          phone: safeText(a.phone, '+58 400 0000000'),
          role: safeText(a.role, 'admin'),
          farmId: a.farm_id || a.farmId || (a.farm && a.farm.id),
          farmName: resolvedFarmName,
          enabledModules: cleanModules,
          status: a.is_active !== undefined ? (a.is_active ? "active" : "inactive") : (a.status || "active"),
          is_active: a.is_active !== undefined ? Boolean(a.is_active) : true,
          createdAt: safeText(a.created_at || a.createdAt),
        };
      });
      setAdmins(mapped);
    } catch (err: any) {
      setErrorMessage(
        err.response?.data?.message || 'Error al conectar con la API de Administradores.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Load all registered farms from general endpoint to guarantee complete listing
  const loadFarms = async () => {
    setIsLoadingFarms(true);
    try {
      const list = await farmService.getAllFarms();
      if (Array.isArray(list) && list.length > 0) {
        setFarmsList(list);
      } else if (Array.isArray(farms) && farms.length > 0) {
        setFarmsList(farms);
      }
    } catch (err) {
      console.error('Error al cargar la lista completa de granjas para administradores:', err);
      if (Array.isArray(farms) && farms.length > 0) {
        setFarmsList(farms);
      }
    } finally {
      setIsLoadingFarms(false);
    }
  };

  useEffect(() => {
    loadAdmins();
    loadFarms();
  }, []);

  const filteredAdmins = admins.filter((a) => {
    const query = searchTerm.toLowerCase();
    const matchesSearch =
      a.name.toLowerCase().includes(query) ||
      a.email.toLowerCase().includes(query) ||
      (a.phone && a.phone.includes(searchTerm)) ||
      (a.farmName && a.farmName.toLowerCase().includes(query));
    const matchesStatus = statusFilter === 'all' || a.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Pagination calculation
  const totalPages = Math.max(1, Math.ceil(filteredAdmins.length / pageSize));
  const activePage = Math.min(currentPage, totalPages);
  const startIndex = (activePage - 1) * pageSize;
  const paginatedAdmins = filteredAdmins.slice(startIndex, startIndex + pageSize);

  const resetForm = () => {
    setAdminFirstName('');
    setAdminLastName('');
    setAdminEmail('');
    setAdminPhone('');
    setAdminPassword('');
    setSelectedFarmId(String(farmsList[0]?.id || farms[0]?.id || ''));
    setSelectedModules(['especies', 'galpones', 'lotes', 'actividades', 'analitica']);
  };

  const openAddModal = () => {
    resetForm();
    loadFarms();
    setIsAddAdminOpen(true);
  };

  const toggleModuleSelection = (moduleId: string) => {
    setSelectedModules((prev) =>
      prev.includes(moduleId) ? prev.filter((m) => m !== moduleId) : [...prev, moduleId]
    );
  };

  const validateForm = (): boolean => {
    if (!adminFirstName.trim()) {
      toastError('Campo Requerido', 'Por favor ingresa el nombre del Administrador.');
      return false;
    }
    if (!adminLastName.trim()) {
      toastError('Campo Requerido', 'Por favor ingresa el apellido del Administrador.');
      return false;
    }
    if (!adminEmail.trim() || !adminEmail.includes('@')) {
      toastError('Correo Inválido', 'Ingresa una dirección de correo electrónico válida.');
      return false;
    }
    if (!selectedFarmId) {
      toastError('Granja Requerida', 'Debes seleccionar una granja para asignar al Administrador.');
      return false;
    }
    if (selectedModules.length === 0) {
      toastError('Módulos Requeridos', 'Selecciona al menos un módulo habilitado para el Administrador.');
      return false;
    }
    return true;
  };

  const handleCreateAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!validateForm()) return;
    if (!adminPassword || adminPassword.length < 6) {
      toastError('Contraseña Corta', 'La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    const assignedFarm = farmsList.find((f) => String(f.id) === String(selectedFarmId)) || farms.find((f) => String(f.id) === String(selectedFarmId));
    const fullName = `${adminFirstName.trim()} ${adminLastName.trim()}`;

    const moduleIds = selectedModules
      .map((m) => CODE_TO_MODULE_ID[m] || CODE_TO_MODULE_ID[normalizeModuleCode(m) || ''])
      .filter(Boolean);

    try {
      await adminService.createAdmin({
        name: adminFirstName.trim(),
        lastname: adminLastName.trim(),
        email: adminEmail.trim(),
        phone: adminPhone.trim() || undefined,
        password: adminPassword,
        farm_id: selectedFarmId,
        is_active: true,
        modules: selectedModules,
        module_ids: moduleIds,
      });

      // Synchronize farm modules table directly
      if (selectedFarmId) {
        const farmModulePayload = [
          { module_id: 2, is_enabled: selectedModules.includes('especies') },
          { module_id: 3, is_enabled: selectedModules.includes('galpones') },
          { module_id: 4, is_enabled: selectedModules.includes('lotes') },
          { module_id: 5, is_enabled: selectedModules.includes('actividades') },
          { module_id: 6, is_enabled: selectedModules.includes('analitica') },
          { module_id: 7, is_enabled: selectedModules.includes('historial') },
        ];
        await farmService.updateFarmModules(selectedFarmId, farmModulePayload).catch(() => null);
      }

      setSuccessMessage(`Administrador ${fullName} registrado correctamente con ${selectedModules.length} módulos.`);
      toastSuccess('¡Administrador Registrado!', `Asignado a ${assignedFarm?.name || 'la granja'}.`);
      setIsAddAdminOpen(false);
      resetForm();
      loadAdmins();
    } catch (err: any) {
      // Fallback local update if API is unreachable
      const newAdmin: User = {
        id: `admin-${Date.now()}`,
        name: fullName,
        email: adminEmail.trim(),
        phone: adminPhone.trim() || '+58 400 0000000',
        role: 'ADMIN',
        farmId: selectedFarmId,
        farmName: assignedFarm?.name || 'Granja Asignada',
        enabledModules: selectedModules,
        status: 'active',
        createdAt: new Date().toISOString().split('T')[0],
      };
      setAdmins((prev) => [newAdmin, ...prev]);
      toastSuccess('Administrador Creado (Local)', `Registrado ${fullName}.`);
      setIsAddAdminOpen(false);
      resetForm();
    }
  };

  const handleEditAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAdmin || !validateForm()) return;

    const assignedFarm = farmsList.find((f) => String(f.id) === String(selectedFarmId)) || farms.find((f) => String(f.id) === String(selectedFarmId));
    const fullName = `${adminFirstName.trim()} ${adminLastName.trim()}`;

    const moduleIds = selectedModules
      .map((m) => CODE_TO_MODULE_ID[m] || CODE_TO_MODULE_ID[normalizeModuleCode(m) || ''])
      .filter(Boolean);

    try {
      await adminService.updateAdmin(selectedAdmin.id, {
        name: adminFirstName.trim(),
        lastname: adminLastName.trim(),
        email: adminEmail.trim(),
        phone: adminPhone.trim() || undefined,
        farm_id: selectedFarmId,
        modules: selectedModules,
        module_ids: moduleIds,
      });

      // Synchronize farm modules table directly to ensure persistence across sessions
      if (selectedFarmId) {
        const farmModulePayload = [
          { module_id: 2, is_enabled: selectedModules.includes('especies') },
          { module_id: 3, is_enabled: selectedModules.includes('galpones') },
          { module_id: 4, is_enabled: selectedModules.includes('lotes') },
          { module_id: 5, is_enabled: selectedModules.includes('actividades') },
          { module_id: 6, is_enabled: selectedModules.includes('analitica') },
          { module_id: 7, is_enabled: selectedModules.includes('historial') },
        ];
        await farmService.updateFarmModules(selectedFarmId, farmModulePayload).catch(() => null);
      }

      setAdmins((prev) =>
        prev.map((a) => {
          if (a.id === selectedAdmin.id) {
            return {
              ...a,
              name: fullName,
              firstName: adminFirstName.trim(),
              lastName: adminLastName.trim(),
              email: adminEmail.trim(),
              phone: adminPhone.trim(),
              farmId: selectedFarmId,
              farmName: assignedFarm?.name || a.farmName,
              enabledModules: selectedModules,
            };
          }
          return a;
        })
      );

      setSuccessMessage(`Administrador ${fullName} actualizado correctamente con ${selectedModules.length} módulos habilitados.`);
      toastSuccess('Administrador Actualizado', `Perfil y módulos de ${fullName} actualizados.`);
      setIsEditAdminOpen(false);
      loadAdmins();
    } catch (err: any) {
      setAdmins((prev) =>
        prev.map((a) => {
          if (a.id === selectedAdmin.id) {
            return {
              ...a,
              name: fullName,
              firstName: adminFirstName.trim(),
              lastName: adminLastName.trim(),
              email: adminEmail.trim(),
              phone: adminPhone.trim(),
              farmId: selectedFarmId,
              farmName: assignedFarm?.name || a.farmName,
              enabledModules: selectedModules,
            };
          }
          return a;
        })
      );
      toastSuccess('Administrador Actualizado (Local)', `Perfil y módulos de ${fullName} modificados.`);
      setIsEditAdminOpen(false);
    }
  };

  const handleToggleAdminStatus = async (admin: User) => {
    const adminId = admin.id;
    const isCurrentlyActive = Boolean(admin.status === 'active' || admin.is_active);
    const newIsActive = !isCurrentlyActive;
    const newStatus = newIsActive ? 'active' : 'inactive';

    setTogglingAdminId(adminId);

    // 1. Optimistic UI update: immediately switch StatusBadge and button color in React
    setAdmins((prev) =>
      prev.map((adm) =>
        adm.id === adminId || String(adm.id) === String(adminId)
          ? { ...adm, is_active: newIsActive, status: newStatus }
          : adm
      )
    );

    try {
      // 2. HTTP request (PATCH/PUT) to the status toggle endpoint (e.g. /api/admin-users/${adminId}/toggle-status)
      const response = await adminService.toggleStatus(adminId, newIsActive);

      // Extract confirmed is_active value from API response
      const serverIsActive =
        typeof response?.data?.is_active === 'boolean'
          ? response.data.is_active
          : typeof response?.data?.data?.is_active === 'boolean'
          ? response.data.data.is_active
          : typeof response?.is_active === 'boolean'
          ? response.is_active
          : newIsActive;

      // 3. Local state mapping with confirmed API response without full page reload or unmounting table
      setAdmins((prev) =>
        prev.map((adm) =>
          adm.id === adminId || String(adm.id) === String(adminId)
            ? { ...adm, is_active: serverIsActive, status: serverIsActive ? 'active' : 'inactive' }
            : adm
        )
      );

      toastSuccess(
        'Estado Actualizado',
        `Acceso del administrador ${admin.name} cambiado a ${serverIsActive ? 'Activo' : 'Inactivo'}.`
      );
    } catch (err: any) {
      console.error('Error al cambiar estado del administrador:', err);

      // Fallback: intentar actualizar directamente el modelo mediante updateAdmin
      try {
        await adminService.updateAdmin(adminId, { is_active: newIsActive });
        setAdmins((prev) =>
          prev.map((adm) =>
            adm.id === adminId || String(adm.id) === String(adminId)
              ? { ...adm, is_active: newIsActive, status: newStatus }
              : adm
          )
        );
        toastSuccess(
          'Estado Actualizado',
          `Acceso del administrador ${admin.name} cambiado a ${newStatus === 'active' ? 'Activo' : 'Inactivo'}.`
        );
      } catch (updateErr: any) {
        // Revert on error
        setAdmins((prev) =>
          prev.map((adm) =>
            adm.id === adminId || String(adm.id) === String(adminId)
              ? { ...adm, is_active: isCurrentlyActive, status: isCurrentlyActive ? 'active' : 'inactive' }
              : adm
          )
        );
        toastError(
          'Error al cambiar estado',
          err?.response?.data?.message || updateErr?.response?.data?.message || 'No se pudo actualizar el estado del administrador en la base de datos.'
        );
      }
    } finally {
      setTogglingAdminId(null);
    }
  };

  const openDetailModal = (admin: User) => {
    setSelectedAdmin(admin);
    setIsDetailOpen(true);
  };

  const openEditModal = async (admin: User) => {
    loadFarms();
    setSelectedAdmin(admin);
    const nameParts = (admin.name || '').trim().split(' ');
    setAdminFirstName((admin as any).firstName || nameParts[0] || '');
    setAdminLastName((admin as any).lastName || nameParts.slice(1).join(' ') || '');
    setAdminEmail(admin.email || '');
    setAdminPhone(admin.phone || '');
    const farmId = String(admin.farmId || admin.farm_id || (admin.farm && (admin.farm as any).id) || '');
    setSelectedFarmId(farmId);

    // Normalize any existing enabled modules
    let currentModules: string[] = [];
    if (Array.isArray(admin.enabledModules) && admin.enabledModules.length > 0) {
      currentModules = admin.enabledModules
        .map((m: any) => normalizeModuleCode(typeof m === 'string' ? m : m?.code || m?.slug || m?.id))
        .filter(Boolean) as string[];
    }

    // If admin has no modules loaded, fetch active farm modules directly from API
    if (currentModules.length === 0 && farmId) {
      try {
        const farmModRes = await farmService.getFarmModules(farmId);
        const modsList = Array.isArray(farmModRes) ? farmModRes : (farmModRes?.data || farmModRes?.modules || []);
        if (Array.isArray(modsList)) {
          currentModules = modsList
            .filter((m: any) => isModuleItemEnabled(m?.pivot?.is_enabled ?? m?.is_enabled))
            .map((m: any) => normalizeModuleCode(m?.code || m?.module?.code || m?.module_id || m?.id))
            .filter(Boolean) as string[];
        }
      } catch (e) {
        console.warn('No se pudieron consultar los módulos de la granja en openEditModal:', e);
      }
    }

    if (currentModules.length === 0) {
      currentModules = ['especies', 'galpones', 'lotes', 'actividades', 'analitica'];
    }

    setSelectedModules(Array.from(new Set(currentModules)));
    setIsEditAdminOpen(true);
  };

  if (isLoading && (!admins || admins.length === 0)) {
    return <SkeletonLoader type="table" />;
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-[#18221F] p-6 rounded-2xl border border-gray-200 dark:border-[#263632] shadow-sm">
        <div>
          <h1 className="text-xl font-black text-[#1E1E1E] dark:text-gray-100 flex items-center gap-2">
            <Users className="w-6 h-6 text-[#1B4D3E] dark:text-[#4E9F3D]" />
            Gestión de Administradores de Granja
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Conectado a la API PostgreSQL mediante token JWT para administración de cuentas y granjas.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => { loadAdmins(); loadFarms(); }} icon={<RefreshCw className="w-3.5 h-3.5" />}>
            Actualizar API
          </Button>
          <Button
            variant="accent"
            size="sm"
            onClick={openAddModal}
            icon={<UserPlus className="w-4 h-4" />}
          >
            Registrar Administrador
          </Button>
        </div>
      </div>

      {/* Banners */}
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

      {/* Filters & Actions */}
      <Card className="p-4">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="relative w-full md:w-96">
            <Search className="w-4 h-4 absolute left-3.5 top-3 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por nombre, correo, teléfono o granja..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-10 pr-4 py-2 bg-[#F9F9F9] dark:bg-[#121816] border border-gray-200 dark:border-[#263632] rounded-xl text-xs text-[#1E1E1E] dark:text-gray-200 focus:ring-2 focus:ring-[#1B4D3E]"
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
              className="px-3 py-1.5 bg-[#F9F9F9] dark:bg-[#121816] border border-gray-200 dark:border-[#263632] rounded-xl text-xs text-[#1E1E1E] dark:text-gray-300 focus:ring-2 focus:ring-[#1B4D3E]"
            >
              <option value="all">Todos los estados</option>
              <option value="active">Activos</option>
              <option value="inactive">Inactivos</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Admins Table */}
      <Card className="overflow-hidden">
        {isLoading ? (
          <div key="admins-loading-state" className="p-12 text-center text-xs text-gray-500">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto text-[#1B4D3E] mb-2" />
            <p className="mt-2 text-xs text-gray-500">Cargando lista de administradores desde la API...</p>
          </div>
        ) : (
          <div key="admins-table-wrapper" className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#F9F9F9] dark:bg-[#121816] border-b border-gray-200 dark:border-[#263632] text-[11px] font-bold uppercase text-[#1E1E1E] dark:text-gray-400 tracking-wider">
                  <th className="py-3.5 px-4">Nombre y Apellido</th>
                  <th className="py-3.5 px-4">Correo Electrónico</th>
                  <th className="py-3.5 px-4">Teléfono</th>
                  <th className="py-3.5 px-4">Granja & Sector Pecuario</th>
                  <th className="py-3.5 px-4 text-center">Estado</th>
                  <th className="py-3.5 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-[#263632] text-xs">
                {paginatedAdmins.length === 0 ? (
                  <tr key="admins-empty-state-row">
                    <td colSpan={6} className="py-8 text-center text-gray-500">
                      <p className="text-xs text-gray-500">No se encontraron administradores registrados.</p>
                    </td>
                  </tr>
                ) : (
                  paginatedAdmins.map((admin) => {
                    const farmObj = farmsList.find(
                      (f) => String(f.id) === String(admin.farmId || admin.farm_id)
                    ) || farms.find(
                      (f) => String(f.id) === String(admin.farmId || admin.farm_id)
                    );
                    const sectorLabel = getSectorLabel(farmObj?.sector || admin.farm?.sector);
                    const adminName = typeof admin?.name === 'string' ? admin.name : safeText(admin?.name, 'Administrador');
                    const adminInitial = (adminName.charAt(0) || 'A').toUpperCase();
                    const adminEmail = typeof admin?.email === 'string' ? admin.email : safeText(admin?.email, 'Sin correo');
                    const adminPhone = typeof admin?.phone === 'string' ? admin.phone : safeText(admin?.phone, '+58 400 0000000');
                    const resolvedFarm = typeof admin?.farmName === 'string'
                      ? admin.farmName
                      : (typeof admin?.farm === 'object' && admin?.farm !== null && 'name' in admin.farm ? String((admin.farm as any).name) : (farmObj?.name || 'Sin Granja'));
                    const resolvedSector = typeof sectorLabel === 'string' ? sectorLabel : 'Sin especificar';
                    const isAccountActive = Boolean(admin.status === 'active' || admin.is_active);

                    return (
                      <tr key={admin.id} className="hover:bg-gray-50/50 dark:hover:bg-[#18221F]/50 transition-colors">
                        <td className="py-3.5 px-4 font-bold text-[#1E1E1E] dark:text-gray-100">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-[#1B4D3E]/10 dark:bg-[#4E9F3D]/20 text-[#1B4D3E] dark:text-[#4E9F3D] flex items-center justify-center font-black text-xs">
                              {adminInitial}
                            </div>
                            <div>
                              <span>{adminName}</span>
                              <span className="block text-[10px] text-gray-400 font-normal">
                                Admin de Granja
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-gray-600 dark:text-gray-300">
                          <div className="flex items-center gap-1.5">
                            <Mail className="w-3.5 h-3.5 text-gray-400" />
                            <span>{adminEmail}</span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-gray-600 dark:text-gray-300">
                          <div className="flex items-center gap-1.5 font-mono text-[11px]">
                            <Phone className="w-3 h-3 text-[#4E9F3D]" />
                            <span>{adminPhone}</span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-[#1B4D3E] dark:text-[#4E9F3D] flex items-center gap-1">
                            <Building2 className="w-3.5 h-3.5" />
                            <span>{resolvedFarm}</span>
                          </div>
                          <div className="text-[11px] text-gray-500 flex items-center gap-1 mt-0.5">
                            <Compass className="w-3 h-3 text-[#4E9F3D]" />
                            <span>{resolvedSector}</span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <StatusBadge isActive={admin.is_active ?? admin.status} gender="male" />
                        </td>
                        <td className="py-3.5 px-4 text-right space-x-1">
                          <button
                            onClick={() => openDetailModal(admin)}
                            className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors cursor-pointer"
                            title="Ver detalles"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => openEditModal(admin)}
                            className="p-1.5 rounded-lg text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40 transition-colors cursor-pointer"
                            title="Editar Administrador"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>

                          <button
                            type="button"
                            disabled={togglingAdminId === admin.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleAdminStatus(admin);
                            }}
                            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                              togglingAdminId === admin.id
                                ? 'opacity-60 cursor-not-allowed text-gray-400'
                                : isAccountActive
                                ? 'text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40'
                                : 'text-[#4E9F3D] hover:bg-emerald-50 dark:hover:bg-emerald-950/40'
                            }`}
                            title={
                              togglingAdminId === admin.id
                                ? 'Actualizando estado...'
                                : isAccountActive
                                ? 'Desactivar Cuenta'
                                : 'Activar Cuenta'
                            }
                          >
                            {togglingAdminId === admin.id ? (
                              <RefreshCw className="w-4 h-4 animate-spin text-[#1B4D3E] dark:text-[#4E9F3D]" />
                            ) : (
                              <Power className="w-4 h-4" />
                            )}
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

        {/* Pagination Controls */}
        <div key="admins-pagination-bar" className="p-4 bg-[#F9F9F9] dark:bg-[#121816] border-t border-gray-200 dark:border-[#263632] flex items-center justify-between text-xs">
          <span className="text-gray-500">
            {`Mostrando ${filteredAdmins.length === 0 ? 0 : startIndex + 1} a ${Math.min(startIndex + pageSize, filteredAdmins.length)} de ${filteredAdmins.length} Administradores`}
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

      {/* Modal: Registrar Administrador */}
      <Modal
        isOpen={isAddAdminOpen}
        onClose={() => setIsAddAdminOpen(false)}
        title="Registrar Nuevo Administrador"
        subtitle="Formulario completo de registro con asignación de granja y selección de módulos."
        destroyOnClose={true}
      >
        <form onSubmit={handleCreateAdminSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#1E1E1E] dark:text-gray-300 mb-1">
                Nombre <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="Ej: Juan"
                value={adminFirstName}
                onChange={(e) => setAdminFirstName(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-[#F9F9F9] dark:bg-[#121816] border border-gray-200 dark:border-[#263632] rounded-xl text-xs text-[#1E1E1E] dark:text-gray-200 focus:ring-2 focus:ring-[#1B4D3E]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#1E1E1E] dark:text-gray-300 mb-1">
                Apellido <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="Ej: Pérez"
                value={adminLastName}
                onChange={(e) => setAdminLastName(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-[#F9F9F9] dark:bg-[#121816] border border-gray-200 dark:border-[#263632] rounded-xl text-xs text-[#1E1E1E] dark:text-gray-200 focus:ring-2 focus:ring-[#1B4D3E]"
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
                placeholder="admin@granja.com"
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-[#F9F9F9] dark:bg-[#121816] border border-gray-200 dark:border-[#263632] rounded-xl text-xs text-[#1E1E1E] dark:text-gray-200 focus:ring-2 focus:ring-[#1B4D3E]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#1E1E1E] dark:text-gray-300 mb-1">
                Teléfono de Contacto
              </label>
              <input
                type="text"
                placeholder="+58 414 1234567"
                value={adminPhone}
                onChange={(e) => setAdminPhone(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-[#F9F9F9] dark:bg-[#121816] border border-gray-200 dark:border-[#263632] rounded-xl text-xs text-[#1E1E1E] dark:text-gray-200 focus:ring-2 focus:ring-[#1B4D3E]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#1E1E1E] dark:text-gray-300 mb-1">
                Contraseña Temporal <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[#F9F9F9] dark:bg-[#121816] border border-gray-200 dark:border-[#263632] rounded-xl text-xs text-[#1E1E1E] dark:text-gray-200 focus:ring-2 focus:ring-[#1B4D3E]"
                />
                <Lock className="w-3.5 h-3.5 absolute right-3.5 top-3 text-gray-400" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#1E1E1E] dark:text-gray-300 mb-1">
                Selector de Granja <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={selectedFarmId}
                onChange={(e) => setSelectedFarmId(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-[#F9F9F9] dark:bg-[#121816] border border-gray-200 dark:border-[#263632] rounded-xl text-xs text-[#1E1E1E] dark:text-gray-200 focus:ring-2 focus:ring-[#1B4D3E]"
              >
                <option value="">
                  {isLoadingFarms ? 'Cargando granjas del sistema...' : 'Seleccione una granja...'}
                </option>
                {(farmsList || []).map((f) => (
                  <option key={`farm-opt-${f.id}`} value={String(f.id)}>
                    {f.name} — Sector: {getSectorLabel(f.sector)} {f.code ? `(${f.code})` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Interruptores / Checkboxes de Módulos */}
          <div className="border-t border-gray-200 dark:border-[#263632] pt-3">
            <label className="block text-xs font-bold text-[#1B4D3E] dark:text-[#4E9F3D] uppercase tracking-wider mb-2">
              Módulos Habilitados para el Administrador
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto p-2 bg-[#F9F9F9] dark:bg-[#121816] rounded-xl border border-gray-200 dark:border-[#263632]">
              {Object.entries(SYSTEM_MODULES).map(([key, config]) => {
                const isSelected = selectedModules.includes(key);
                return (
                  <label
                    key={key}
                    className={`flex items-center space-x-2 p-2 rounded-lg border text-xs cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-white dark:bg-[#18221F] border-[#4E9F3D] text-[#1E1E1E] dark:text-gray-100 font-semibold shadow-xs'
                        : 'bg-transparent border-transparent text-gray-500 opacity-70'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleModuleSelection(key)}
                      className="accent-[#1B4D3E] w-4 h-4 rounded"
                    />
                    <span className="truncate">{config.name}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end space-x-2 pt-4 border-t border-gray-200 dark:border-[#263632]">
            <Button type="button" variant="outline" onClick={() => setIsAddAdminOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="accent">
              Registrar Administrador
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Editar Administrador */}
      <Modal
        isOpen={isEditAdminOpen}
        onClose={() => setIsEditAdminOpen(false)}
        title={`Editar Administrador: ${selectedAdmin?.name || ''}`}
        subtitle="Actualiza la información personal, granja asignada o permisos de módulos."
        destroyOnClose={true}
      >
        <form onSubmit={handleEditAdminSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#1E1E1E] dark:text-gray-300 mb-1">
                Nombre <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={adminFirstName}
                onChange={(e) => setAdminFirstName(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-[#F9F9F9] dark:bg-[#121816] border border-gray-200 dark:border-[#263632] rounded-xl text-xs text-[#1E1E1E] dark:text-gray-200 focus:ring-2 focus:ring-[#1B4D3E]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#1E1E1E] dark:text-gray-300 mb-1">
                Apellido <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={adminLastName}
                onChange={(e) => setAdminLastName(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-[#F9F9F9] dark:bg-[#121816] border border-gray-200 dark:border-[#263632] rounded-xl text-xs text-[#1E1E1E] dark:text-gray-200 focus:ring-2 focus:ring-[#1B4D3E]"
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
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-[#F9F9F9] dark:bg-[#121816] border border-gray-200 dark:border-[#263632] rounded-xl text-xs text-[#1E1E1E] dark:text-gray-200 focus:ring-2 focus:ring-[#1B4D3E]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#1E1E1E] dark:text-gray-300 mb-1">
                Teléfono de Contacto
              </label>
              <input
                type="text"
                value={adminPhone}
                onChange={(e) => setAdminPhone(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-[#F9F9F9] dark:bg-[#121816] border border-gray-200 dark:border-[#263632] rounded-xl text-xs text-[#1E1E1E] dark:text-gray-200 focus:ring-2 focus:ring-[#1B4D3E]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#1E1E1E] dark:text-gray-300 mb-1">
              Selector de Granja Asignada <span className="text-red-500">*</span>
            </label>
            <select
              required
              value={selectedFarmId}
              onChange={(e) => setSelectedFarmId(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-[#F9F9F9] dark:bg-[#121816] border border-gray-200 dark:border-[#263632] rounded-xl text-xs text-[#1E1E1E] dark:text-gray-200 focus:ring-2 focus:ring-[#1B4D3E]"
            >
              <option value="">
                {isLoadingFarms ? 'Cargando granjas del sistema...' : 'Seleccione una granja...'}
              </option>
              {(farmsList || []).map((f) => (
                <option key={`edit-farm-opt-${f.id}`} value={String(f.id)}>
                  {f.name} — Sector: {getSectorLabel(f.sector)} {f.code ? `(${f.code})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Interruptores / Checkboxes de Módulos */}
          <div className="border-t border-gray-200 dark:border-[#263632] pt-3">
            <label className="block text-xs font-bold text-[#1B4D3E] dark:text-[#4E9F3D] uppercase tracking-wider mb-2">
              Módulos Habilitados para el Administrador
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto p-2 bg-[#F9F9F9] dark:bg-[#121816] rounded-xl border border-gray-200 dark:border-[#263632]">
              {Object.entries(SYSTEM_MODULES).map(([key, config]) => {
                const isSelected = selectedModules.includes(key);
                return (
                  <label
                    key={`edit-mod-${key}`}
                    className={`flex items-center space-x-2 p-2 rounded-lg border text-xs cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-white dark:bg-[#18221F] border-[#4E9F3D] text-[#1E1E1E] dark:text-gray-100 font-semibold shadow-xs'
                        : 'bg-transparent border-transparent text-gray-500 opacity-70'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleModuleSelection(key)}
                      className="accent-[#1B4D3E] w-4 h-4 rounded"
                    />
                    <span className="truncate">{config.name}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end space-x-2 pt-4 border-t border-gray-200 dark:border-[#263632]">
            <Button type="button" variant="outline" onClick={() => setIsEditAdminOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="accent">
              Actualizar Administrador
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Ver Detalles Administrador */}
      <Modal
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        title={`Ficha de Administrador: ${safeText(selectedAdmin?.name)}`}
        destroyOnClose={true}
      >
        {selectedAdmin && (
          <div className="space-y-3 text-xs">
            <div className="p-3 bg-[#F9F9F9] dark:bg-[#121816] rounded-xl border border-gray-200 dark:border-[#263632] flex justify-between">
              <span className="font-bold text-gray-500">Nombre Completo:</span>
              <span className="font-bold text-[#1E1E1E] dark:text-gray-100">{safeText(selectedAdmin.name)}</span>
            </div>
            <div className="p-3 bg-[#F9F9F9] dark:bg-[#121816] rounded-xl border border-gray-200 dark:border-[#263632] flex justify-between">
              <span className="font-bold text-gray-500">Correo Electrónico:</span>
              <span className="text-[#1E1E1E] dark:text-gray-200">{safeText(selectedAdmin.email)}</span>
            </div>
            <div className="p-3 bg-[#F9F9F9] dark:bg-[#121816] rounded-xl border border-gray-200 dark:border-[#263632] flex justify-between">
              <span className="font-bold text-gray-500">Teléfono:</span>
              <span className="text-[#1E1E1E] dark:text-gray-200">{safeText(selectedAdmin.phone, 'No registrado')}</span>
            </div>
            <div className="p-3 bg-[#F9F9F9] dark:bg-[#121816] rounded-xl border border-gray-200 dark:border-[#263632] flex justify-between">
              <span className="font-bold text-gray-500">Granja Asignada:</span>
              <span className="font-bold text-[#1B4D3E] dark:text-[#4E9F3D]">
                {safeText(selectedAdmin.farmName || (selectedAdmin.farm && (selectedAdmin.farm as any).name), 'Sin Granja')}
              </span>
            </div>
            <div className="p-3 bg-[#F9F9F9] dark:bg-[#121816] rounded-xl border border-gray-200 dark:border-[#263632] space-y-1.5">
              <span className="font-bold text-gray-500 block">Módulos Asignados:</span>
              <div className="flex flex-wrap gap-1">
                {(selectedAdmin.enabledModules || []).map((modItem: any) => {
                  const modCode = typeof modItem === 'string' ? modItem : modItem?.code || modItem?.id || '';
                  const modName = SYSTEM_MODULES[modCode as keyof typeof SYSTEM_MODULES]?.name || safeText(modItem?.name, modCode);
                  if (!modCode && !modName) return null;
                  return (
                    <span
                      key={`detail-mod-${modCode || Math.random()}`}
                      className="px-2 py-0.5 bg-emerald-50 dark:bg-emerald-950/40 text-[#1B4D3E] dark:text-[#4E9F3D] border border-emerald-200 dark:border-emerald-800 rounded text-[10px] font-semibold"
                    >
                      {safeText(modName)}
                    </span>
                  );
                })}
              </div>
            </div>
            <div className="p-3 bg-[#F9F9F9] dark:bg-[#121816] rounded-xl border border-gray-200 dark:border-[#263632] flex items-center justify-between">
              <span className="font-bold text-gray-500">Estado de Cuenta:</span>
              <StatusBadge isActive={selectedAdmin.is_active ?? selectedAdmin.status} gender="male" />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
