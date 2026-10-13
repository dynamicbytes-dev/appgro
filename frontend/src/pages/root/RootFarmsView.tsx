import React, { useState, useEffect } from 'react';
import { farmService } from '../../services/farmService';
import type { Farm, SystemModule } from '../../types/auth';
import { SYSTEM_MODULES, normalizeModuleCode, isModuleItemEnabled, CODE_TO_MODULE_ID } from '../../config/modules';
import { useToast } from '../../context/ToastContext';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { SkeletonLoader } from '../../components/ui/SkeletonLoader';
import {
  Building2,
  Plus,
  Edit2,
  Layers,
  Search,
  CheckCircle2,
  Eye,
  RefreshCw,
  AlertCircle,
  MapPin,
  Compass,
} from 'lucide-react';

import { safeText } from '../../utils/safeText';

export const SECTOR_OPTIONS = [
  { value: 'avicola', label: 'Avícola (Aves)' },
  { value: 'porcino', label: 'Porcino (Cerdos)' },
  { value: 'bovino', label: 'Bovino (Ganado)' },
  { value: 'ovino_caprino', label: 'Ovino / Caprino' },
  { value: 'acuicola', label: 'Acuícola' },
  { value: 'mixto', label: 'Agrícola / Mixto' },
];

export const getSectorLabel = (val?: any): string => {
  if (!val) return 'Sin especificar';
  let strVal = '';
  if (typeof val === 'string') {
    strVal = val;
  } else if (typeof val === 'object' && val !== null) {
    strVal = val.name || val.label || val.value || val.slug || '';
  } else {
    strVal = String(val);
  }
  const clean = strVal.trim().toLowerCase();
  const opt = SECTOR_OPTIONS.find((o) => o.value.toLowerCase() === clean);
  return opt ? opt.label : (strVal || 'Sin especificar');
};

export const OFFICIAL_FARM_MODULES: SystemModule[] = [
  { id: 2, code: 'species', name: 'Especies', description: 'Gestión de especies y tipos de animales de la granja', is_enabled: true },
  { id: 3, code: 'barns', name: 'Galpones', description: 'Control de galpones, corrales e infraestructura', is_enabled: true },
  { id: 4, code: 'lots', name: 'Lotes', description: 'Gestión de lotes de producción y capacidad de alojamiento', is_enabled: true },
  { id: 5, code: 'activities', name: 'Actividades', description: 'Registro de tareas de campo, alimentación y controles sanitarios', is_enabled: true },
  { id: 6, code: 'analytics', name: 'Analítica', description: 'Reportes, estadísticas e indicadores de rendimiento KPI', is_enabled: true },
  { id: 7, code: 'history', name: 'Historial', description: 'Registro de auditoría, trazabilidad y actividades del sistema', is_enabled: true },
];

interface FarmModuleItemProps {
  module: SystemModule;
  isToggling: boolean;
  onToggle: (moduleId: number, currentStatus: boolean) => void;
}

const FarmModuleItem: React.FC<FarmModuleItemProps> = React.memo(({ module, isToggling, onToggle }) => {
  const isEnabled = !!module.is_enabled;

  return (
    <div
      className={`p-3.5 rounded-xl border flex items-center justify-between transition-all ${
        isEnabled
          ? 'bg-white dark:bg-[#18221F] border-[#4E9F3D] shadow-xs'
          : 'bg-[#F9F9F9] dark:bg-[#121816] border-gray-200 dark:border-[#263632] opacity-70'
      }`}
    >
      <div className="pr-4">
        <div className="font-bold text-xs text-[#1E1E1E] dark:text-gray-100 flex items-center gap-2">
          <span>{module.name}</span>
          <span className="text-[10px] text-gray-400 font-mono">({module.code})</span>
        </div>
        <p className="text-[11px] text-gray-500 mt-0.5 line-clamp-1">{module.description}</p>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold">
          {isToggling && <RefreshCw className="w-3 h-3 animate-spin text-[#1B4D3E] dark:text-[#4E9F3D]" />}
          <span className={isEnabled ? 'text-[#1B4D3E] dark:text-[#4E9F3D]' : 'text-gray-400'}>
            {isToggling ? 'Actualizando...' : isEnabled ? 'Habilitado' : 'Desactivado'}
          </span>
        </span>

        {/* Switch con jerarquía de DOM estática para prevenir colisiones removeChild */}
        <button
          type="button"
          role="switch"
          aria-checked={isEnabled}
          disabled={isToggling}
          onClick={() => onToggle(module.id, isEnabled)}
          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
            isEnabled ? 'bg-[#1B4D3E]' : 'bg-gray-300 dark:bg-gray-700'
          } ${isToggling ? 'opacity-50 cursor-wait' : ''}`}
          title={isEnabled ? `Desactivar módulo ${module.name}` : `Habilitar módulo ${module.name}`}
        >
          <span className="sr-only">Alternar {module.name}</span>
          <span
            aria-hidden="true"
            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
              isEnabled ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
      </div>
    </div>
  );
});

export const RootFarmsView: React.FC = () => {
  const { toastSuccess, toastError } = useToast();
  const [farms, setFarms] = useState<Farm[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  // Modal states
  const [isAddFarmOpen, setIsAddFarmOpen] = useState(false);
  const [isEditFarmOpen, setIsEditFarmOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isModuleModalOpen, setIsModuleModalOpen] = useState(false);

  // Form states - Strictly: Nombre, Sector Pecuario (Selector), Ubicación
  const [selectedFarm, setSelectedFarm] = useState<Farm | null>(null);
  const [farmName, setFarmName] = useState('');
  const [farmSector, setFarmSector] = useState('');
  const [farmLocation, setFarmLocation] = useState('');
  const [farmIsActive, setFarmIsActive] = useState(true);

  // Farm Modules states
  const [farmModules, setFarmModules] = useState<SystemModule[]>([]);
  const [isModulesLoading, setIsModulesLoading] = useState(false);
  const [togglingModuleId, setTogglingModuleId] = useState<number | null>(null);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const loadFarms = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const data = await farmService.getAllFarms();
      setFarms(data);
    } catch (err: any) {
      setErrorMessage(err.response?.data?.message || 'Error al cargar la lista de granjas.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadFarms();
  }, []);

  const resetForm = () => {
    setFarmName('');
    setFarmSector('');
    setFarmLocation('');
    setFarmIsActive(true);
  };

  // Auto-generate code from name and timestamp/random number
  const generateFarmCode = (name: string): string => {
    const prefix = name
      .trim()
      .replaceAll(/[^a-zA-Z0-9]/g, '')
      .slice(0, 4)
      .toUpperCase() || 'FARM';
    const randomDigits = Math.floor(1000 + Math.random() * 9000);
    return `${prefix}-${randomDigits}`;
  };

  const handleCreateFarm = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!farmName.trim()) {
      setErrorMessage('El nombre de la granja es obligatorio.');
      return;
    }

    if (!farmSector) {
      setErrorMessage('Debes seleccionar un Sector Pecuario.');
      return;
    }

    const autoCode = generateFarmCode(farmName);

    try {
      await farmService.createFarm({
        name: farmName.trim(),
        code: autoCode,
        sector: farmSector,
        location: farmLocation.trim() || 'No especificada',
        is_active: farmIsActive,
      });

      setSuccessMessage(`Granja "${farmName}" registrada con código [${autoCode}].`);
      setIsAddFarmOpen(false);
      resetForm();
      loadFarms();
    } catch (err: any) {
      setErrorMessage(err.response?.data?.message || 'Error al registrar la granja.');
    }
  };

  const handleEditFarmClick = (farm: Farm) => {
    setSelectedFarm(farm);
    setFarmName(farm.name || '');
    setFarmSector(farm.sector || '');
    setFarmLocation(farm.location || '');
    setFarmIsActive(farm.is_active ?? true);
    setIsEditFarmOpen(true);
  };

  const handleUpdateFarm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFarm) return;
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!farmSector) {
      setErrorMessage('Debes seleccionar un Sector Pecuario.');
      return;
    }

    try {
      await farmService.updateFarm(selectedFarm.id, {
        name: farmName.trim(),
        sector: farmSector,
        location: farmLocation.trim() || undefined,
        is_active: farmIsActive,
      });

      setSuccessMessage('Información de la granja actualizada correctamente.');
      setIsEditFarmOpen(false);
      loadFarms();
    } catch (err: any) {
      setErrorMessage(err.response?.data?.message || 'Error al actualizar la granja.');
    }
  };

  const handleViewModulesClick = async (farm: Farm) => {
    setSelectedFarm(farm);
    setIsModuleModalOpen(true);
    setIsModulesLoading(true);
    try {
      const data = await farmService.getFarmModules(farm.id);
      let apiModules: any[] = [];
      if (Array.isArray(data?.data?.modules)) apiModules = data.data.modules;
      else if (Array.isArray(data?.modules)) apiModules = data.modules;
      else if (Array.isArray(data?.data)) apiModules = data.data;
      else if (Array.isArray(data)) apiModules = data;

      if (apiModules.length > 0) {
        // Recorrer dinámicamente todos los módulos que devuelve la API (incluyendo 'history')
        const normalized = apiModules.map((apiMod: any) => {
          const rawCode = String(apiMod.code || apiMod.slug || '').trim().toLowerCase();
          const canonicalKey = normalizeModuleCode(rawCode || apiMod.id);
          const sysConfig = canonicalKey ? SYSTEM_MODULES[canonicalKey] : null;

          const resolvedId = Number(
            apiMod.module_id ||
            apiMod.id ||
            CODE_TO_MODULE_ID[rawCode] ||
            (canonicalKey ? CODE_TO_MODULE_ID[canonicalKey] : 0)
          );

          const finalCode = apiMod.code || (rawCode === 'history' || canonicalKey === 'historial' ? 'history' : rawCode);

          return {
            id: resolvedId,
            module_id: resolvedId,
            code: finalCode,
            name: apiMod.name || sysConfig?.name || 'Módulo',
            description: apiMod.description || sysConfig?.description || '',
            is_enabled: isModuleItemEnabled(apiMod),
          };
        });

        // Ordenamiento estable por ID
        normalized.sort((a, b) => a.id - b.id);
        setFarmModules(normalized);
      } else {
        setFarmModules(OFFICIAL_FARM_MODULES);
      }
    } catch (err: any) {
      console.warn('Error al consultar módulos de la granja:', err);
      setFarmModules(OFFICIAL_FARM_MODULES);
    } finally {
      setIsModulesLoading(false);
    }
  };

  const handleToggleModuleStatus = async (moduleId: number, currentStatus: boolean) => {
    if (!selectedFarm || togglingModuleId !== null) return;
    setTogglingModuleId(moduleId);

    const nextStatus = !currentStatus;

    // Identificar el módulo específico garantizando que posea 'code: history' o su id numérico
    const targetMod = farmModules.find((m) => m.id === moduleId || (m as any).module_id === moduleId);
    const resolvedModuleId = Number(
      targetMod?.id ||
      (targetMod as any)?.module_id ||
      (targetMod?.code === 'history' || targetMod?.code === 'historial' ? 7 : moduleId)
    );
    const resolvedCode = targetMod?.code || (resolvedModuleId === 7 ? 'history' : 'module');

    // Construir payload completo con IDs numéricos válidos en el backend
    const fullPayload = farmModules.map((m) => {
      const isTarget = m.id === moduleId || (m as any).module_id === moduleId || m.code === targetMod?.code;
      const mId = Number(m.id || (m as any).module_id || (m.code === 'history' ? 7 : 0));
      return {
        module_id: mId,
        id: mId,
        code: m.code,
        is_enabled: isTarget ? nextStatus : !!m.is_enabled,
      };
    });

    try {
      // 1. Enviar payload con identificador único preciso (module_id y code)
      try {
        await farmService.updateFarmModules(selectedFarm.id, {
          module_id: resolvedModuleId,
          code: resolvedCode,
          is_enabled: nextStatus,
          farm_id: selectedFarm.id,
        });
      } catch (singleErr) {
        // 2. Respaldo: enviar el arreglo completo preservando cada módulo
        await farmService.updateFarmModules(selectedFarm.id, fullPayload);
      }

      // Actualizar localmente el estado reactivo del módulo
      setFarmModules((prev) =>
        prev.map((m) => {
          const isTarget = m.id === moduleId || (m as any).module_id === moduleId || m.code === targetMod?.code;
          return isTarget ? { ...m, is_enabled: nextStatus } : m;
        })
      );

      toastSuccess(
        `Módulo ${nextStatus ? 'habilitado' : 'desactivado'}`,
        `Se guardó "${targetMod?.name || resolvedCode}" para ${selectedFarm.name}.`
      );
    } catch (err: any) {
      console.error('Error al actualizar módulo de la granja:', err);
      toastError(
        'Error al actualizar módulo',
        err.response?.data?.message || 'No se pudo actualizar el estado del módulo.'
      );
    } finally {
      setTogglingModuleId(null);
    }
  };

  const filteredFarms = farms.filter((f) => {
    const query = searchQuery.toLowerCase();
    const sectorLabel = getSectorLabel(f.sector).toLowerCase();
    const matchesSearch =
      f.name.toLowerCase().includes(query) ||
      (f.code && f.code.toLowerCase().includes(query)) ||
      (f.sector && f.sector.toLowerCase().includes(query)) ||
      sectorLabel.includes(query) ||
      (f.location && f.location.toLowerCase().includes(query));

    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'active' && f.is_active) ||
      (statusFilter === 'inactive' && !f.is_active);
    return matchesSearch && matchesStatus;
  });

  if (isLoading && (!farms || farms.length === 0)) {
    return <SkeletonLoader type="table" />;
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-[#18221F] p-6 rounded-2xl border border-gray-200 dark:border-[#263632] shadow-sm">
        <div>
          <h1 className="text-xl font-black text-[#1E1E1E] dark:text-gray-100 flex items-center gap-2">
            <Building2 className="w-6 h-6 text-[#1B4D3E] dark:text-[#4E9F3D]" />
            Gestión de Granjas
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Administración simplificada: Selector de Sector Pecuario, Ubicación y código automático.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadFarms} icon={<RefreshCw className="w-3.5 h-3.5" />}>
            Actualizar
          </Button>
          <Button
            variant="accent"
            size="sm"
            onClick={() => {
              resetForm();
              setIsAddFarmOpen(true);
            }}
            icon={<Plus className="w-4 h-4" />}
          >
            Nueva Granja
          </Button>
        </div>
      </div>

      {/* Banners */}
      {successMessage && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs text-emerald-800 dark:text-emerald-300 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#4E9F3D] shrink-0" />
            <span>{successMessage}</span>
          </div>
          <button onClick={() => setSuccessMessage(null)} className="font-bold text-xs">✕</button>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 rounded-xl text-xs text-red-700 dark:text-red-300 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage(null)} className="font-bold text-xs">✕</button>
        </div>
      )}

      {/* Filters & Controls */}
      <Card className="p-4">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="relative w-full md:w-96">
            <Search className="w-4 h-4 absolute left-3.5 top-3 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por granja, código, sector o ubicación..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-[#F9F9F9] dark:bg-[#121816] border border-gray-200 dark:border-[#263632] rounded-xl text-xs text-[#1E1E1E] dark:text-gray-200 focus:ring-2 focus:ring-[#1B4D3E]"
            />
          </div>

          <div className="flex items-center space-x-2 w-full md:w-auto">
            <span className="text-xs text-[#1E1E1E] dark:text-gray-300 font-medium">Estado:</span>
            <select
              value={statusFilter}
              onChange={(e: any) => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 bg-[#F9F9F9] dark:bg-[#121816] border border-gray-200 dark:border-[#263632] rounded-xl text-xs text-[#1E1E1E] dark:text-gray-300 focus:ring-2 focus:ring-[#1B4D3E]"
            >
              <option value="all">Todas las granjas</option>
              <option value="active">Activas</option>
              <option value="inactive">Inactivas</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Farms Table */}
      <Card className="overflow-hidden">
        {isLoading ? (
          <div key="farms-loading-state" className="p-12 text-center text-xs text-gray-500">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto text-[#1B4D3E] mb-2" />
            <p className="mt-2 text-xs text-gray-500">Cargando granjas...</p>
          </div>
        ) : filteredFarms.length === 0 ? (
          <div key="farms-empty-state" className="p-12 text-center text-xs text-gray-500">
            <p className="text-xs text-gray-500">No se encontraron granjas registradas.</p>
          </div>
        ) : (
          <div key="farms-table-wrapper" className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#F9F9F9] dark:bg-[#121816] border-b border-gray-200 dark:border-[#263632] text-[11px] font-bold uppercase text-[#1E1E1E] dark:text-gray-400 tracking-wider">
                  <th className="py-3.5 px-4">Código (Auto)</th>
                  <th className="py-3.5 px-4">Nombre de la Granja</th>
                  <th className="py-3.5 px-4">Sector Pecuario</th>
                  <th className="py-3.5 px-4">Ubicación</th>
                  <th className="py-3.5 px-4 text-center">Estado</th>
                  <th className="py-3.5 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-[#263632] text-xs">
                {(filteredFarms || [])?.map((farm) => (
                  <tr key={farm.id} className="hover:bg-gray-50/50 dark:hover:bg-[#18221F]/50 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-[#1B4D3E] dark:text-[#4E9F3D]">
                      {safeText(farm.code, `FARM-${farm.id}`)}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-bold text-[#1E1E1E] dark:text-gray-100 flex items-center gap-1.5">
                        <Building2 className="w-4 h-4 text-[#1B4D3E] dark:text-[#4E9F3D]" />
                        {safeText(farm.name)}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-gray-700 dark:text-gray-300">
                      <div className="flex items-center gap-1.5">
                        <Compass className="w-3.5 h-3.5 text-[#4E9F3D]" />
                        <span className="font-semibold text-[#1B4D3E] dark:text-[#4E9F3D]">
                          {getSectorLabel(farm.sector)}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-gray-600 dark:text-gray-400">
                      <div className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-gray-400" />
                        <span>{safeText(farm.location, 'Sin ubicación registrada')}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <StatusBadge isActive={farm.is_active} gender="female" />
                    </td>
                    <td className="py-3 px-4 text-right space-x-1">
                      <button
                        onClick={() => {
                          setSelectedFarm(farm);
                          setIsDetailOpen(true);
                        }}
                        className="p-1.5 rounded-lg text-gray-600 hover:bg-gray-100 dark:hover:bg-[#263632] transition-colors"
                        title="Ver detalles de granja"
                      >
                        <Eye className="w-4 h-4 text-blue-500" />
                      </button>

                      <button
                        onClick={() => handleViewModulesClick(farm)}
                        className="p-1.5 rounded-lg text-[#1B4D3E] hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-colors"
                        title="Gestionar Módulos de Granja"
                      >
                        <Layers className="w-4 h-4 text-[#4E9F3D]" />
                      </button>

                      <button
                        onClick={() => handleEditFarmClick(farm)}
                        className="p-1.5 rounded-lg text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40 transition-colors"
                        title="Editar Granja"
                      >
                        <Edit2 className="w-4 h-4 text-amber-500" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Modal: Crear Nueva Granja (Selector de Sector Pecuario) */}
      <Modal
        isOpen={isAddFarmOpen}
        onClose={() => setIsAddFarmOpen(false)}
        title="Crear Nueva Granja"
        subtitle="Selecciona el Sector Pecuario, asigna Nombre y Ubicación. El código se genera automáticamente."
        destroyOnClose={true}
      >
        <form onSubmit={handleCreateFarm} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#1E1E1E] dark:text-gray-300 mb-1">
              Nombre de la Granja <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="Ej: Granja Porcina Santa María"
              value={farmName}
              onChange={(e) => setFarmName(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-[#F9F9F9] dark:bg-[#121816] border border-gray-200 dark:border-[#263632] rounded-xl text-xs text-[#1E1E1E] dark:text-gray-200 focus:ring-2 focus:ring-[#1B4D3E]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#1E1E1E] dark:text-gray-300 mb-1">
              Sector Pecuario <span className="text-red-500">*</span>
            </label>
            <select
              required
              value={farmSector}
              onChange={(e) => setFarmSector(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-[#F9F9F9] dark:bg-[#121816] border border-gray-200 dark:border-[#263632] rounded-xl text-xs text-[#1E1E1E] dark:text-gray-200 focus:ring-2 focus:ring-[#1B4D3E]"
            >
              <option value="">Seleccione un sector pecuario...</option>
              {(SECTOR_OPTIONS || []).map((opt) => (
                <option key={`sector-opt-${opt.value}`} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#1E1E1E] dark:text-gray-300 mb-1">
              Ubicación <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="Ej: Sector Valles del Tuy, Edo. Miranda"
              value={farmLocation}
              onChange={(e) => setFarmLocation(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-[#F9F9F9] dark:bg-[#121816] border border-gray-200 dark:border-[#263632] rounded-xl text-xs text-[#1E1E1E] dark:text-gray-200 focus:ring-2 focus:ring-[#1B4D3E]"
            />
          </div>

          <div className="p-3 bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900 rounded-xl text-xs text-[#1B4D3E] dark:text-[#4E9F3D] flex items-center justify-between">
            <span className="font-semibold">Código Generado Automáticamente:</span>
            <span className="font-mono font-bold text-xs bg-white dark:bg-[#121816] px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
              {farmName ? generateFarmCode(farmName) : 'GRAN-0000'}
            </span>
          </div>

          <div className="flex justify-end space-x-2 pt-4 border-t border-gray-200 dark:border-[#263632]">
            <Button type="button" variant="outline" onClick={() => setIsAddFarmOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="accent">
              Registrar Granja
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Editar Granja (Selector de Sector Pecuario) */}
      <Modal
        isOpen={isEditFarmOpen}
        onClose={() => setIsEditFarmOpen(false)}
        title={`Editar Granja: ${selectedFarm?.name || ''}`}
        subtitle="Modifica el nombre, el sector pecuario, la ubicación o cambia el estado."
        destroyOnClose={true}
      >
        <form onSubmit={handleUpdateFarm} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#1E1E1E] dark:text-gray-300 mb-1">
              Nombre de la Granja <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={farmName}
              onChange={(e) => setFarmName(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-[#F9F9F9] dark:bg-[#121816] border border-gray-200 dark:border-[#263632] rounded-xl text-xs text-[#1E1E1E] dark:text-gray-200 focus:ring-2 focus:ring-[#1B4D3E]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#1E1E1E] dark:text-gray-300 mb-1">
              Sector Pecuario <span className="text-red-500">*</span>
            </label>
            <select
              required
              value={farmSector}
              onChange={(e) => setFarmSector(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-[#F9F9F9] dark:bg-[#121816] border border-gray-200 dark:border-[#263632] rounded-xl text-xs text-[#1E1E1E] dark:text-gray-200 focus:ring-2 focus:ring-[#1B4D3E]"
            >
              <option value="">Seleccione un sector pecuario...</option>
              {(SECTOR_OPTIONS || []).map((opt) => (
                <option key={`edit-sector-opt-${opt.value}`} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#1E1E1E] dark:text-gray-300 mb-1">
              Ubicación
            </label>
            <input
              type="text"
              value={farmLocation}
              onChange={(e) => setFarmLocation(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-[#F9F9F9] dark:bg-[#121816] border border-gray-200 dark:border-[#263632] rounded-xl text-xs text-[#1E1E1E] dark:text-gray-200 focus:ring-2 focus:ring-[#1B4D3E]"
            />
          </div>

          <div>
            <label className="flex items-center space-x-2 text-xs font-semibold text-[#1E1E1E] dark:text-gray-300 cursor-pointer pt-2">
              <input
                type="checkbox"
                checked={farmIsActive}
                onChange={(e) => setFarmIsActive(e.target.checked)}
                className="accent-[#1B4D3E] w-4 h-4"
              />
              <span>Granja Activa (Acceso de usuarios habilitado)</span>
            </label>
          </div>

          <div className="flex justify-end space-x-2 pt-4 border-t border-gray-200 dark:border-[#263632]">
            <Button type="button" variant="outline" onClick={() => setIsEditFarmOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="accent">
              Actualizar Cambios
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Ver Detalles Granja */}
      <Modal
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        title={`Detalles de Granja: ${safeText(selectedFarm?.name)}`}
        destroyOnClose={true}
      >
        {selectedFarm && (
          <div className="space-y-3 text-xs">
            <div className="p-3 bg-[#F9F9F9] dark:bg-[#121816] rounded-xl border border-gray-200 dark:border-[#263632] flex justify-between">
              <span className="font-bold text-gray-500">Código de Granja:</span>
              <span className="font-mono font-bold text-[#1B4D3E] dark:text-[#4E9F3D]">
                {safeText(selectedFarm.code, `FARM-${selectedFarm.id}`)}
              </span>
            </div>
            <div className="p-3 bg-[#F9F9F9] dark:bg-[#121816] rounded-xl border border-gray-200 dark:border-[#263632] flex justify-between">
              <span className="font-bold text-gray-500">Nombre:</span>
              <span className="font-bold text-[#1E1E1E] dark:text-gray-100">{safeText(selectedFarm.name)}</span>
            </div>
            <div className="p-3 bg-[#F9F9F9] dark:bg-[#121816] rounded-xl border border-gray-200 dark:border-[#263632] flex justify-between">
              <span className="font-bold text-gray-500">Sector Pecuario:</span>
              <span className="font-bold text-[#1B4D3E] dark:text-[#4E9F3D]">
                {getSectorLabel(selectedFarm.sector)}
              </span>
            </div>
            <div className="p-3 bg-[#F9F9F9] dark:bg-[#121816] rounded-xl border border-gray-200 dark:border-[#263632] flex justify-between">
              <span className="font-bold text-gray-500">Ubicación:</span>
              <span className="text-[#1E1E1E] dark:text-gray-200">
                {safeText(selectedFarm.location, 'No registrada')}
              </span>
            </div>
            <div className="p-3 bg-[#F9F9F9] dark:bg-[#121816] rounded-xl border border-gray-200 dark:border-[#263632] flex items-center justify-between">
              <span className="font-bold text-gray-500">Estado:</span>
              <StatusBadge isActive={selectedFarm.is_active} gender="female" />
            </div>
          </div>
        )}
      </Modal>

      {/* Modal: Gestión de Módulos Habilitados */}
      <Modal
        isOpen={isModuleModalOpen}
        onClose={() => setIsModuleModalOpen(false)}
        title={`Módulos Habilitados: ${safeText(selectedFarm?.name)}`}
        subtitle="Activa o desactiva los módulos del sistema autorizados para esta granja."
        destroyOnClose={true}
      >
        {isModulesLoading ? (
          <div className="p-8 text-center text-xs text-gray-500">
            <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-[#1B4D3E]" />
            <span>Cargando módulos...</span>
          </div>
        ) : (
          <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
            {(farmModules || []).map((mod) => (
              <FarmModuleItem
                key={`farm-module-${mod.code || mod.id}`}
                module={mod}
                isToggling={togglingModuleId === mod.id}
                onToggle={handleToggleModuleStatus}
              />
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
};
