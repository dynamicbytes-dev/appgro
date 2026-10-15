import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { barnService, type BarnStats } from '../services/barnService';
import { speciesService } from '../services/speciesService';
import { farmService } from '../services/farmService';
import type { Barn, Species, Farm } from '../types/auth';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { StatusBadge, normalizeIsActive } from '../components/ui/StatusBadge';
import { Modal } from '../components/ui/Modal';
import { safeText } from '../utils/safeText';
import {
  Warehouse,
  Plus,
  Search,
  Eye,
  Edit2,
  Power,
  RotateCcw,
  RefreshCw,
  Layers,
  Building2,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Tag,
  Boxes,
  ChevronLeft,
  ChevronRight,
  Activity,
  Trash2,
} from 'lucide-react';

// Propósitos permitidos por sector pecuario oficial
const SECTOR_PURPOSES: Record<string, string[]> = {
  avicola: ['Carne', 'Huevos'],
  porcino: ['Carne', 'Reproducción'],
  cunicula: ['Carne', 'Reproducción'],
  bovino: ['Carne', 'Reproducción', 'Leche'],
  ovino: ['Carne', 'Leche', 'Reproducción', 'Lana'],
  caprino: ['Carne', 'Leche', 'Reproducción', 'Fibra'],
};

const normalizeSectorKey = (raw?: string | null): string | null => {
  const n = (raw || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
  if (!n) return null;
  if (n.startsWith('avic')) return 'avicola';
  if (n.startsWith('porcin')) return 'porcino';
  if (n.startsWith('cunic')) return 'cunicula';
  if (n.startsWith('bovin')) return 'bovino';
  if (n.startsWith('ovin')) return 'ovino';
  if (n.startsWith('caprin')) return 'caprino';
  return null;
};

const getPurposesForSector = (sector?: string | null): string[] => {
  const key = normalizeSectorKey(sector);
  return key ? SECTOR_PURPOSES[key] : [];
};

export const ShedsView: React.FC = () => {
  const { user, activeFarm, farms: authFarms } = useAuth();
  const { toastSuccess, toastError } = useToast();

  const roleUpper = (user?.role || '').toUpperCase();
  const isRoot = roleUpper === 'ROOT';

  // Data States
  const [barnsList, setBarnsList] = useState<Barn[]>([]);
  const [activeSpeciesList, setActiveSpeciesList] = useState<Species[]>([]);
  const [stats, setStats] = useState<BarnStats>({
    total_barns: 0,
    total_galpones: 0,
    active_barns: 0,
    active_galpones: 0,
    global_capacity: 0,
    capacidad_global: 0,
    associated_species: 0,
    especies_asociadas: 0,
  });
  const [farmsList, setFarmsList] = useState<Farm[]>(() =>
    Array.isArray(authFarms) ? authFarms : []
  );

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isLoadingSpecies, setIsLoadingSpecies] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [speciesFilter, setSpeciesFilter] = useState<string>('all');
  const [selectedRootFarmId, setSelectedRootFarmId] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 8;

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedBarn, setSelectedBarn] = useState<Barn | null>(null);

  // Form States
  const [formName, setFormName] = useState('');
  const [formSpeciesId, setFormSpeciesId] = useState<string>('');
  const [formSector, setFormSector] = useState('');
  const [formPurpose, setFormPurpose] = useState('');
  const [formMaxCapacity, setFormMaxCapacity] = useState<number | string>(100);
  const [formIsActive, setFormIsActive] = useState(true);
  const [formFarmId, setFormFarmId] = useState<string>('');

  // Current operational farm ID
  const effectiveFarmId = useMemo(() => {
    if (isRoot) {
      return selectedRootFarmId && selectedRootFarmId !== 'all' ? selectedRootFarmId : undefined;
    }
    return (
      activeFarm?.id ||
      user?.farm_id ||
      (user?.farm && user.farm.id) ||
      user?.farmId ||
      undefined
    );
  }, [isRoot, selectedRootFarmId, activeFarm, user]);

  // Load farms list for Root user
  useEffect(() => {
    if (isRoot) {
      farmService
        .getFarmsSelect()
        .then((data) => {
          if (Array.isArray(data) && data.length > 0) {
            setFarmsList(data);
          }
        })
        .catch(() => null);
    }
  }, [isRoot]);

  // Load Active Species belonging to current farm for modal select
  const loadActiveSpecies = useCallback(async (farmIdToQuery?: string | number) => {
    setIsLoadingSpecies(true);
    try {
      const response = await speciesService.getAll({
        farm_id: farmIdToQuery,
      });
      const allSp = Array.isArray(response?.data)
        ? response.data
        : Array.isArray(response)
        ? response
        : [];
      // Only keep strictly active species
      const activeOnly = allSp.filter((sp) => normalizeIsActive(sp.is_active));
      setActiveSpeciesList(activeOnly);
    } catch (err) {
      console.warn('Error al cargar especies activas para galpones:', err);
      setActiveSpeciesList([]);
    } finally {
      setIsLoadingSpecies(false);
    }
  }, []);

  // Load Barns & Stats from API
  const loadBarns = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    setErrorMessage(null);
    try {
      const [barnsRes, statsRes] = await Promise.all([
        barnService.getAll({
          farm_id: effectiveFarmId,
        }),
        barnService.getStats({ farm_id: effectiveFarmId }).catch(() => null),
      ]);

      const rows = Array.isArray(barnsRes?.data) ? barnsRes.data : [];
      setBarnsList(rows);

      if (statsRes) {
        setStats(statsRes);
      } else if (barnsRes?.stats) {
        setStats(barnsRes.stats);
      }
    } catch (err: any) {
      console.error('Error al cargar galpones:', err);
      const msg = err.response?.data?.message || 'Error al cargar los galpones de la granja.';
      setErrorMessage(msg);
      toastError('Error al Cargar', msg);
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, [effectiveFarmId, toastError]);

  // Initial and reactive fetch on farm scope change
  useEffect(() => {
    loadBarns();
    loadActiveSpecies(effectiveFarmId);
  }, [loadBarns, loadActiveSpecies, effectiveFarmId]);

  // Auto-fill sector/categoría pecuaria when species selection changes
  // y resetea el propósito para evitar combinaciones inválidas (ej. Avícola + Leche)
  const handleSpeciesChange = (speciesIdSelected: string) => {
    setFormSpeciesId(speciesIdSelected);
    setFormPurpose('');
    if (!speciesIdSelected) {
      setFormSector('');
      return;
    }
    const match =
      activeSpeciesList.find((s) => String(s.id) === String(speciesIdSelected)) ||
      (isEditModalOpen && selectedBarn?.species && String(selectedBarn.species.id) === String(speciesIdSelected)
        ? selectedBarn.species
        : undefined);
    setFormSector(match?.category || '');
  };

  // Opciones de propósito derivadas reactivamente del sector actual
  const allowedPurposes = useMemo(() => getPurposesForSector(formSector), [formSector]);

  // Cálculo reactivo garantizado de las métricas de galpones
  const computedBarnStats = useMemo(() => {
    const listTotal = barnsList.length;
    const listActive = barnsList.filter((b) => normalizeIsActive(b.is_active)).length;
    const listCapacity = barnsList.reduce((acc, b) => acc + (Number(b.max_capacity) || 0), 0);
    const listSpecies = new Set(
      barnsList.map((b) => b.species_id || b.species?.id).filter(Boolean)
    ).size;

    return {
      total: Math.max(Number(stats?.total_galpones || stats?.total_barns || 0), listTotal),
      active: Math.max(Number(stats?.active_galpones || stats?.active_barns || 0), listActive),
      capacity: Math.max(Number(stats?.global_capacity || stats?.capacidad_global || 0), listCapacity),
      associatedSpecies: Math.max(
        Number(stats?.associated_species || stats?.especies_asociadas || 0),
        listSpecies
      ),
    };
  }, [stats, barnsList]);

  // Filtered barns list in memory for instant feedback
  const filteredBarns = useMemo(() => {
    return barnsList.filter((barn) => {
      // 1. Search term
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const bName = (barn?.name || '').toLowerCase();
        const bPurpose = (barn?.purpose || '').toLowerCase();
        const bSpecies = (barn?.species?.name || '').toLowerCase();
        const bCategory = (barn?.category || barn?.sector || '').toLowerCase();
        if (
          !bName.includes(query) &&
          !bPurpose.includes(query) &&
          !bSpecies.includes(query) &&
          !bCategory.includes(query)
        ) {
          return false;
        }
      }

      // 2. Status filter
      const isActive = normalizeIsActive(barn.is_active);
      if (statusFilter === 'active' && !isActive) return false;
      if (statusFilter === 'inactive' && isActive) return false;

      // 3. Species filter
      if (speciesFilter !== 'all') {
        if (String(barn.species_id) !== String(speciesFilter)) {
          return false;
        }
      }

      return true;
    });
  }, [barnsList, searchTerm, statusFilter, speciesFilter]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredBarns.length / pageSize));
  const paginatedBarns = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredBarns.slice(startIndex, startIndex + pageSize);
  }, [filteredBarns, currentPage, pageSize]);

  // Evita quedarse en una página vacía tras eliminar registros
  useEffect(() => {
    if (
      currentPage > 1 &&
      filteredBarns.length > 0 &&
      paginatedBarns.length === 0
    ) {
      setCurrentPage((prev) => Math.max(1, prev - 1));
    }
  }, [currentPage, filteredBarns.length, paginatedBarns.length]);

  // Handlers for Modals
  const openCreateModal = () => {
    setFormName('');
    setFormSpeciesId('');
    setFormSector('');
    setFormPurpose('');
    setFormMaxCapacity(100);
    setFormIsActive(true);
    setFormFarmId(isRoot ? (selectedRootFarmId && selectedRootFarmId !== 'all' ? selectedRootFarmId : '') : '');
    setErrorMessage(null);
    setIsCreateModalOpen(true);
  };

  const openEditModal = (barn: Barn) => {
    setSelectedBarn(barn);
    setFormName(barn.name || '');
    setFormSpeciesId(barn.species_id ? String(barn.species_id) : '');
    setFormSector(barn.species?.category || barn.sector || barn.category || '');
    setFormPurpose(barn.purpose || '');

    setFormMaxCapacity(barn.max_capacity || 100);
    setFormIsActive(normalizeIsActive(barn.is_active));
    setFormFarmId(barn.farm_id ? String(barn.farm_id) : '');
    setErrorMessage(null);
    setIsEditModalOpen(true);
  };

  const openDetailModal = (barn: Barn) => {
    setSelectedBarn(barn);
    setIsDetailModalOpen(true);
  };

  const openConfirmToggle = (barn: Barn) => {
    setSelectedBarn(barn);
    setIsConfirmModalOpen(true);
  };

  const openDeleteModal = (barn: Barn) => {
    setSelectedBarn(barn);
    setIsDeleteModalOpen(true);
  };

  // Form Submit: Create Barn
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      setErrorMessage('El nombre del galpón es obligatorio.');
      return;
    }
    if (!formSpeciesId) {
      setErrorMessage('Debe seleccionar una especie activa asignada a este galpón.');
      return;
    }

    const finalPurpose = formPurpose.trim();
    if (!finalPurpose) {
      setErrorMessage('Debe especificar el propósito productivo del galpón.');
      return;
    }

    const capacityNum = Number(formMaxCapacity);
    if (isNaN(capacityNum) || capacityNum <= 0) {
      setErrorMessage('La capacidad máxima debe ser mayor a 0 animales.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const payloadFarmId = isRoot
        ? (formFarmId && formFarmId !== 'all'
            ? formFarmId
            : selectedRootFarmId && selectedRootFarmId !== 'all'
            ? selectedRootFarmId
            : undefined)
        : effectiveFarmId;

      const created = await barnService.create({
        name: formName.trim(),
        species_id: Number(formSpeciesId),
        category: formSector || undefined,
        sector: formSector || undefined,
        purpose: finalPurpose,
        max_capacity: capacityNum,
        is_active: formIsActive,
        farm_id: payloadFarmId,
      });

      setBarnsList((prev) => [created, ...prev]);

      // Actualización inmediata de métricas sin esperar recargas
      setStats((prev) => ({
        ...prev,
        total_galpones: (prev.total_galpones || prev.total_barns || barnsList.length) + 1,
        total_barns: (prev.total_galpones || prev.total_barns || barnsList.length) + 1,
        active_galpones: (prev.active_galpones || prev.active_barns || 0) + (formIsActive ? 1 : 0),
        active_barns: (prev.active_galpones || prev.active_barns || 0) + (formIsActive ? 1 : 0),
        global_capacity: (prev.global_capacity || prev.capacidad_global || 0) + capacityNum,
        capacidad_global: (prev.global_capacity || prev.capacidad_global || 0) + capacityNum,
      }));

      setIsCreateModalOpen(false);
      setSuccessMessage('Galpón registrado exitosamente.');
      toastSuccess('Registro Exitoso', `El galpón "${created.name}" fue creado correctamente.`);
      loadBarns(true);
    } catch (err: any) {
      console.error('Error al registrar galpón:', err);
      const msg =
        err.response?.data?.message ||
        err.response?.data?.errors?.name?.[0] ||
        err.response?.data?.errors?.species_id?.[0] ||
        'No se pudo registrar el galpón. Verifique los datos.';
      setErrorMessage(msg);
      toastError('Error al Guardar', msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Form Submit: Edit Barn
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBarn) return;

    if (!formName.trim()) {
      setErrorMessage('El nombre del galpón es obligatorio.');
      return;
    }
    if (!formSpeciesId) {
      setErrorMessage('Debe seleccionar una especie para el galpón.');
      return;
    }

    const finalPurpose = formPurpose.trim();
    if (!finalPurpose) {
      setErrorMessage('Debe especificar el propósito del galpón.');
      return;
    }

    const capacityNum = Number(formMaxCapacity);
    if (isNaN(capacityNum) || capacityNum <= 0) {
      setErrorMessage('La capacidad máxima debe ser mayor a 0 animales.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const updated = await barnService.update(selectedBarn.id, {
        name: formName.trim(),
        species_id: Number(formSpeciesId),
        category: formSector || undefined,
        sector: formSector || undefined,
        purpose: finalPurpose,
        max_capacity: capacityNum,
        is_active: formIsActive,
      });

      setBarnsList((prev) =>
        prev.map((b) => (b.id === selectedBarn.id ? { ...b, ...updated } : b))
      );
      setIsEditModalOpen(false);
      setSuccessMessage('Galpón actualizado exitosamente.');
      toastSuccess('Actualización Exitosa', `El galpón "${updated.name}" fue modificado correctamente.`);
      loadBarns(true);
    } catch (err: any) {
      console.error('Error al actualizar galpón:', err);
      const msg =
        err.response?.data?.message ||
        err.response?.data?.errors?.name?.[0] ||
        'No se pudo actualizar el galpón.';
      setErrorMessage(msg);
      toastError('Error al Actualizar', msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Toggle Barn Status (Habilitar / Inhabilitar)
  const handleToggleStatus = async () => {
    if (!selectedBarn) return;
    const currentIsActive = normalizeIsActive(selectedBarn.is_active);
    const newStatus = !currentIsActive;

    setIsSubmitting(true);
    try {
      await barnService.toggleStatus(selectedBarn.id, newStatus);
      setBarnsList((prev) =>
        prev.map((b) => (b.id === selectedBarn.id ? { ...b, is_active: newStatus } : b))
      );
      setIsConfirmModalOpen(false);
      const actionMsg = newStatus ? 'habilitado' : 'inhabilitado';
      toastSuccess('Estado Actualizado', `El galpón "${selectedBarn.name}" fue ${actionMsg} correctamente.`);
      loadBarns(true);
    } catch (err: any) {
      console.error('Error al cambiar estado del galpón:', err);
      toastError('Error de Operación', 'No se pudo cambiar el estado del galpón.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete Barn: confirma, ejecuta DELETE y filtra el estado local (optimista)
  const handleDelete = async () => {
    if (!selectedBarn) return;

    const barnToDelete = selectedBarn;
    setIsDeleting(true);
    try {
      await barnService.delete(barnToDelete.id);

      // Actualización optimista: el galpón desaparece de la tabla sin recargar
      setBarnsList((prev) => prev.filter((b) => b.id !== barnToDelete.id));

      // Ajuste inmediato de las métricas de galpones
      const wasActive = normalizeIsActive(barnToDelete.is_active);
      const capacity = Number(barnToDelete.max_capacity || 0);
      const speciesKey = barnToDelete.species_id || barnToDelete.species?.id;
      const speciesStillUsed = barnsList.some(
        (b) =>
          b.id !== barnToDelete.id &&
          !!speciesKey &&
          !!(b.species_id || b.species?.id) &&
          String(b.species_id || b.species?.id) === String(speciesKey)
      );
      setStats((prev) => ({
        ...prev,
        total_galpones: Math.max(
          0,
          (prev.total_galpones || prev.total_barns || 0) - 1
        ),
        total_barns: Math.max(
          0,
          (prev.total_barns || prev.total_galpones || 0) - 1
        ),
        active_galpones: Math.max(
          0,
          (prev.active_galpones || prev.active_barns || 0) - (wasActive ? 1 : 0)
        ),
        active_barns: Math.max(
          0,
          (prev.active_barns || prev.active_galpones || 0) - (wasActive ? 1 : 0)
        ),
        global_capacity: Math.max(
          0,
          (prev.global_capacity || prev.capacidad_global || 0) - capacity
        ),
        capacidad_global: Math.max(
          0,
          (prev.capacidad_global || prev.global_capacity || 0) - capacity
        ),
        associated_species: speciesStillUsed
          ? prev.associated_species
          : Math.max(0, (prev.associated_species || 0) - 1),
        especies_asociadas: speciesStillUsed
          ? prev.especies_asociadas
          : Math.max(0, (prev.especies_asociadas || 0) - 1),
      }));

      setIsDeleteModalOpen(false);
      setSelectedBarn(null);
      setSuccessMessage(
        `Galpón "${barnToDelete.name}" eliminado correctamente.`
      );
      toastSuccess(
        'Galpón Eliminado',
        `"${barnToDelete.name}" se eliminó de la granja.`
      );
      loadBarns(true);
    } catch (err: any) {
      console.error('Error al eliminar galpón:', err);
      const status = err?.response?.status;
      // Motivo exacto devuelto por la API (ej. 422 por lotes/registros operativos)
      const serverMsg = err?.response?.data?.message;
      const errs = err?.response?.data?.errors;
      const firstFieldError = errs ? Object.values(errs)[0] : null;
      const detail =
        serverMsg ||
        (Array.isArray(firstFieldError) ? firstFieldError[0] : firstFieldError) ||
        null;

      const msg = detail || 'No se pudo eliminar el galpón.';
      setErrorMessage(msg);
      if (status === 422) {
        toastError('Eliminación Bloqueada', msg);
      } else {
        toastError('Error al Eliminar', msg);
      }
    } finally {
      setIsDeleting(false);
    }
  };

  const handleResetFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setSpeciesFilter('all');
    setSelectedRootFarmId('');
    setCurrentPage(1);
  };

  return (
    <div className="space-y-6">
      {/* 1. Header with Title & Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-gray-200 dark:border-[#263632]">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#1B4D3E]/10 dark:bg-[#4E9F3D]/20 text-[#1B4D3E] dark:text-[#4E9F3D] flex items-center justify-center shrink-0">
              <Warehouse className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-black text-[#1E1E1E] dark:text-gray-100 flex items-center gap-2">
                Gestión de Galpones e Infraestructura
                {activeFarm?.name && !isRoot && (
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-[#263632] text-[#1B4D3E] dark:text-[#4E9F3D] font-bold border border-emerald-300 dark:border-emerald-700/50">
                    {safeText(activeFarm.name)}
                  </span>
                )}
              </h1>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Administración de capacidad, asignación de especies y finalidades productivas por galpón.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadBarns()}
            disabled={isLoading}
            icon={<RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />}
          >
            Actualizar
          </Button>
          <Button
            variant="accent"
            size="sm"
            onClick={openCreateModal}
            icon={<Plus className="w-4 h-4" />}
          >
            Nuevo Galpón
          </Button>
        </div>
      </div>

      {/* 2. Resumen Superior: 4 Tarjetas Métricas (KPI Targets) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Galpones Totales */}
        <Card key="target-total-barns" className="p-4 bg-white dark:bg-[#18221F] border border-gray-200 dark:border-[#263632]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Galpones Totales
              </p>
              <h3 className="text-2xl font-black text-[#1E1E1E] dark:text-gray-100 mt-0.5">
                {computedBarnStats.total}
              </h3>
              <p className="text-[10px] text-gray-400 mt-0.5">Estructuras registradas</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-[#1B4D3E]/10 dark:bg-[#4E9F3D]/20 text-[#1B4D3E] dark:text-[#4E9F3D] flex items-center justify-center shrink-0">
              <Warehouse className="w-5 h-5" />
            </div>
          </div>
        </Card>

        {/* Galpones Activos */}
        <Card key="target-active-barns" className="p-4 bg-white dark:bg-[#18221F] border border-gray-200 dark:border-[#263632]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                Galpones Activos
              </p>
              <h3 className="text-2xl font-black text-emerald-700 dark:text-emerald-300 mt-0.5">
                {computedBarnStats.active}
              </h3>
              <p className="text-[10px] text-gray-400 mt-0.5">Disponibles para ocupación</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <Activity className="w-5 h-5" />
            </div>
          </div>
        </Card>

        {/* Capacidad Máxima Global */}
        <Card key="target-global-capacity" className="p-4 bg-white dark:bg-[#18221F] border border-gray-200 dark:border-[#263632]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                Capacidad Máxima Global
              </p>
              <h3 className="text-2xl font-black text-blue-700 dark:text-blue-300 mt-0.5">
                {computedBarnStats.capacity.toLocaleString()}
              </h3>
              <p className="text-[10px] text-gray-400 mt-0.5">Alojamiento total de animales</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
              <Boxes className="w-5 h-5" />
            </div>
          </div>
        </Card>

        {/* Especies Asociadas */}
        <Card key="target-associated-species" className="p-4 bg-white dark:bg-[#18221F] border border-gray-200 dark:border-[#263632]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">
                Especies Asociadas
              </p>
              <h3 className="text-2xl font-black text-purple-700 dark:text-purple-300 mt-0.5">
                {computedBarnStats.associatedSpecies}
              </h3>
              <p className="text-[10px] text-gray-400 mt-0.5">Líneas productivas en uso</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
              <Layers className="w-5 h-5" />
            </div>
          </div>
        </Card>
      </div>

      {/* Alert Messages */}
      {errorMessage && (
        <div className="p-4 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 rounded-xl text-xs text-red-700 dark:text-red-300 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{safeText(errorMessage)}</span>
          </div>
          <button onClick={() => setErrorMessage(null)} className="font-bold text-xs text-red-600">
            ✕
          </button>
        </div>
      )}

      {successMessage && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs text-emerald-700 dark:text-emerald-300 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{safeText(successMessage)}</span>
          </div>
          <button onClick={() => setSuccessMessage(null)} className="font-bold text-xs text-emerald-600">
            ✕
          </button>
        </div>
      )}

      {/* 3. Filters and Search Bar */}
      <Card className="p-4 bg-white dark:bg-[#18221F] border border-gray-200 dark:border-[#263632]">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-center">
          {/* Search Input */}
          <div className={`relative col-span-12 ${isRoot ? 'lg:col-span-4' : 'lg:col-span-5'}`}>
            <Search className="w-4 h-4 absolute left-3.5 top-3 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por nombre, especie, sector o propósito..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-10 pr-4 py-2 bg-[#F9F9F9] dark:bg-[#121816] border border-gray-200 dark:border-[#263632] rounded-xl text-xs focus:ring-2 focus:ring-[#1B4D3E] text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
            />
          </div>

          {/* Root Farm Selector */}
          {isRoot && (
            <div className="col-span-12 sm:col-span-6 lg:col-span-3">
              <select
                value={selectedRootFarmId || ''}
                onChange={(e) => {
                  const rawVal = e.target.value;
                  const normalized = rawVal === 'all' || !rawVal ? '' : rawVal;
                  setSelectedRootFarmId(normalized);
                  setCurrentPage(1);
                }}
                className="w-full px-3 py-2 bg-[#F9F9F9] dark:bg-[#121816] border border-gray-200 dark:border-[#263632] rounded-xl text-xs focus:ring-2 focus:ring-[#1B4D3E] font-medium text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
              >
                <option value="">Todas las Granjas</option>
                {farmsList.map((farm) => (
                  <option key={`farm-select-${farm.id}`} value={farm.id}>
                    {farm.name} {farm.code ? `(${farm.code})` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Species Filter */}
          <div className="col-span-12 sm:col-span-6 lg:col-span-3">
            <select
              value={speciesFilter}
              onChange={(e) => {
                setSpeciesFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 bg-[#F9F9F9] dark:bg-[#121816] border border-gray-200 dark:border-[#263632] rounded-xl text-xs focus:ring-2 focus:ring-[#1B4D3E] text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
            >
              <option value="all">Todas las Especies</option>
              {activeSpeciesList.map((sp) => (
                <option key={`filter-sp-${sp.id}`} value={String(sp.id)}>
                  {sp.name} ({sp.category})
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div className="col-span-12 sm:col-span-6 lg:col-span-2">
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as any);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 bg-[#F9F9F9] dark:bg-[#121816] border border-gray-200 dark:border-[#263632] rounded-xl text-xs focus:ring-2 focus:ring-[#1B4D3E] text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
            >
              <option value="all">Todos los Estados</option>
              <option value="active">Activos</option>
              <option value="inactive">Inactivos</option>
            </select>
          </div>

          {/* Clear Filters */}
          {(searchTerm || statusFilter !== 'all' || speciesFilter !== 'all') && (
            <div className="col-span-12 lg:col-span-1 flex justify-end">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleResetFilters}
                className="w-full text-xs text-gray-500 hover:text-gray-700"
                icon={<RotateCcw className="w-3.5 h-3.5" />}
              >
                Limpiar
              </Button>
            </div>
          )}
        </div>
      </Card>

      {/* 4. Table of Barns */}
      <Card className="overflow-hidden bg-white dark:bg-[#18221F] border border-gray-200 dark:border-[#263632]">
        {isLoading ? (
          <div key="barns-loading-state" className="p-16 text-center text-xs text-gray-500">
            <RefreshCw className="w-7 h-7 animate-spin mx-auto text-[#1B4D3E] dark:text-[#4E9F3D] mb-3" />
            <p className="font-bold text-sm text-[#1E1E1E] dark:text-gray-200">
              Cargando galpones de la granja...
            </p>
            <p className="text-xs text-gray-400 mt-1">Consultando infraestructura y capacidades operativas.</p>
          </div>
        ) : (
          <div key="barns-table-wrapper" className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#F9F9F9] dark:bg-[#121816] border-b border-gray-200 dark:border-[#263632] text-[11px] font-bold uppercase text-[#1E1E1E] dark:text-gray-400 tracking-wider">
                  <th className="py-3.5 px-4">Nombre del Galpón</th>
                  <th className="py-3.5 px-4">Especie Asociada</th>
                  <th className="py-3.5 px-4">Sector Pecuario</th>
                  <th className="py-3.5 px-4">Propósito Operativo</th>
                  <th className="py-3.5 px-4 text-right">Capacidad Máxima</th>
                  <th className="py-3.5 px-4 text-center">Estado</th>
                  <th className="py-3.5 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-[#263632] text-xs">
                {paginatedBarns.length === 0 ? (
                  <tr key="barns-empty-row">
                    <td colSpan={7} className="py-12 text-center text-gray-500">
                      <div className="max-w-sm mx-auto text-center space-y-2">
                        <Warehouse className="w-8 h-8 mx-auto text-gray-300 dark:text-gray-600" />
                        <p className="font-bold text-sm text-[#1E1E1E] dark:text-gray-200">
                          No se encontraron galpones registrados
                        </p>
                        <p className="text-xs text-gray-400">
                          {searchTerm || statusFilter !== 'all' || speciesFilter !== 'all'
                            ? 'No hay registros que coincidan con los filtros aplicados.'
                            : 'Comienza creando la primera instalación de galpón para tu granja.'}
                        </p>
                        <Button
                          variant="accent"
                          size="sm"
                          onClick={openCreateModal}
                          className="mt-2"
                          icon={<Plus className="w-3.5 h-3.5" />}
                        >
                          Nuevo Galpón
                        </Button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedBarns.map((barn) => {
                    const bName = safeText(barn?.name, 'Galpón sin nombre');
                    const bInitial = (bName.charAt(0) || 'G').toUpperCase();
                    const speciesName = safeText(barn?.species?.name, 'Sin especie asignada');
                    const sectorLabel = safeText(
                      barn?.sector || barn?.category || barn?.species?.category,
                      'General'
                    );
                    const purposeText = safeText(barn?.purpose, 'Sin propósito definido');
                    const capacityVal = Number(barn?.max_capacity || 0);
                    const isActive = normalizeIsActive(barn.is_active);

                    return (
                      <tr
                        key={barn.id}
                        className="hover:bg-gray-50/60 dark:hover:bg-[#18221F]/60 transition-colors"
                      >
                        {/* 1. Nombre */}
                        <td className="py-3.5 px-4 font-bold text-[#1E1E1E] dark:text-gray-100">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-[#1B4D3E]/10 dark:bg-[#4E9F3D]/20 text-[#1B4D3E] dark:text-[#4E9F3D] flex items-center justify-center font-black text-xs shrink-0">
                              {bInitial}
                            </div>
                            <div>
                              <span className="block font-bold text-xs text-[#1E1E1E] dark:text-gray-100 leading-tight">
                                {bName}
                              </span>
                              {barn.farm?.name && (
                                <span className="text-[10px] text-gray-400 font-normal flex items-center gap-1 mt-0.5">
                                  <Building2 className="w-2.5 h-2.5 text-[#4E9F3D]" />
                                  {safeText(barn.farm.name)}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* 2. Especie Asociada */}
                        <td className="py-3.5 px-4 font-medium text-gray-700 dark:text-gray-300">
                          <div className="flex items-center gap-1.5">
                            <Layers className="w-3.5 h-3.5 text-[#4E9F3D] shrink-0" />
                            <span className="font-semibold text-xs text-[#1E1E1E] dark:text-gray-200">
                              {speciesName}
                            </span>
                          </div>
                        </td>

                        {/* 3. Sector Pecuario */}
                        <td className="py-3.5 px-4">
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-[#121816] border border-emerald-200/60 dark:border-[#263632] text-xs font-semibold text-[#1B4D3E] dark:text-[#4E9F3D]">
                            <Tag className="w-3 h-3 text-[#4E9F3D]" />
                            <span className="capitalize">{sectorLabel}</span>
                          </div>
                        </td>

                        {/* 4. Propósito Operativo */}
                        <td className="py-3.5 px-4 text-gray-600 dark:text-gray-300">
                          <span className="px-2 py-0.5 rounded-md bg-gray-100 dark:bg-[#263632] text-xs font-medium text-gray-700 dark:text-gray-300">
                            {purposeText}
                          </span>
                        </td>

                        {/* 5. Capacidad Máxima */}
                        <td className="py-3.5 px-4 text-right font-mono font-bold text-gray-800 dark:text-gray-200">
                          <span>{capacityVal.toLocaleString()}</span>
                          <span className="text-[10px] text-gray-400 ml-1 font-sans font-normal">
                            animales
                          </span>
                        </td>

                        {/* 6. Estado (StatusBadge Unificado) */}
                        <td className="py-3.5 px-4 text-center">
                          <StatusBadge isActive={barn.is_active} gender="male" />
                        </td>

                        {/* 7. Acciones (Ver, Editar, Inhabilitar, Eliminar) */}
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Ver detalle */}
                            <button
                              type="button"
                              onClick={() => openDetailModal(barn)}
                              title="Ver ficha técnica"
                              className="p-1.5 text-gray-400 hover:text-[#1B4D3E] dark:hover:text-[#4E9F3D] hover:bg-gray-100 dark:hover:bg-[#263632] rounded-lg transition-colors cursor-pointer"
                            >
                              <Eye className="w-4 h-4" />
                            </button>

                            {/* Editar */}
                            <button
                              type="button"
                              onClick={() => openEditModal(barn)}
                              title="Editar galpón"
                              className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-[#263632] rounded-lg transition-colors cursor-pointer"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>

                            {/* Inhabilitar / Habilitar */}
                            <button
                              type="button"
                              onClick={() => openConfirmToggle(barn)}
                              title={isActive ? 'Inhabilitar galpón' : 'Habilitar galpón'}
                              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                                isActive
                                  ? 'text-gray-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-[#263632]'
                                  : 'text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-[#263632]'
                              }`}
                            >
                              <Power className="w-4 h-4" />
                            </button>

                            {/* Eliminar */}
                            <button
                              type="button"
                              onClick={() => openDeleteModal(barn)}
                              title="Eliminar galpón"
                              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-[#263632] rounded-lg transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* 5. Pagination Footer */}
        <div className="p-4 bg-[#F9F9F9] dark:bg-[#121816] border-t border-gray-200 dark:border-[#263632] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-500">
          <div>
            Mostrando{' '}
            <span className="font-bold text-[#1E1E1E] dark:text-gray-200">
              {paginatedBarns.length}
            </span>{' '}
            de{' '}
            <span className="font-bold text-[#1E1E1E] dark:text-gray-200">
              {filteredBarns.length}
            </span>{' '}
            galpones
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              icon={<ChevronLeft className="w-4 h-4" />}
            >
              Anterior
            </Button>
            <span className="px-2 text-xs font-medium">
              Página {currentPage} de {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              icon={<ChevronRight className="w-4 h-4" />}
            >
              Siguiente
            </Button>
          </div>
        </div>
      </Card>

      {/* 6. Modal: Registrar Nuevo Galpón */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Registrar Nuevo Galpón"
        maxWidth="xl"
      >
        <form onSubmit={handleCreateSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          {/* Nombre */}
          <div>
            <label className="block text-[11px] font-bold text-[#1E1E1E] dark:text-gray-200 uppercase mb-1">
              Nombre del Galpón <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              placeholder="Ej. Galpón 01 - Cerdas Gestantes, Corral Norte 2..."
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              required
              className="w-full px-3.5 py-2.5 bg-[#F9F9F9] dark:bg-[#121816] border border-gray-200 dark:border-[#263632] rounded-xl text-xs focus:ring-2 focus:ring-[#1B4D3E] text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
            />
            <p className="text-[10px] text-gray-400 mt-1">
              Identificador único de la nave o instalación física dentro de la granja.
            </p>
          </div>

          {/* Especie Selector (Únicamente especies activas) */}
          <div>
            <label className="block text-[11px] font-bold text-[#1E1E1E] dark:text-gray-200 uppercase mb-1">
              Especie Pecuaria <span className="text-red-500">*</span>
            </label>
            <select
              value={formSpeciesId}
              onChange={(e) => handleSpeciesChange(e.target.value)}
              required
              disabled={isLoadingSpecies}
              className="w-full px-3.5 py-2.5 bg-[#F9F9F9] dark:bg-[#121816] border border-gray-200 dark:border-[#263632] rounded-xl text-xs focus:ring-2 focus:ring-[#1B4D3E] cursor-pointer text-gray-700 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500"
            >
              <option value="" disabled>
                {isLoadingSpecies
                  ? 'Consultando especies activas...'
                  : activeSpeciesList.length === 0
                  ? 'No hay especies activas registradas en la granja'
                  : 'Selecciona una especie activa...'}
              </option>
              {activeSpeciesList.map((sp) => (
                <option key={`create-select-sp-${sp.id}`} value={sp.id}>
                  {sp.name} — Sector: {sp.category}
                </option>
              ))}
            </select>
            <p className="text-[10px] text-gray-400 mt-1">
              Solo se listan especies activas pertenecientes a la granja actual.
            </p>
          </div>

          {/* Sector Pecuario (Autocompletado) */}
          <div>
            <label className="block text-[11px] font-bold text-[#1E1E1E] dark:text-gray-200 uppercase mb-1 flex items-center justify-between">
              <span>Sector Pecuario</span>
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold normal-case">
                Autocompletado automático
              </span>
            </label>
            <div className="relative">
              <input
                type="text"
                readOnly
                value={formSector ? formSector.toUpperCase() : 'SELECCIONA UNA ESPECIE ARRIBA'}
                placeholder="Autocompletado según la especie..."
                className="w-full px-3.5 py-2.5 bg-gray-100 dark:bg-[#121816]/70 border border-gray-200 dark:border-[#263632] rounded-xl text-xs font-semibold cursor-not-allowed select-none text-gray-700 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500"
              />
              <Tag className="w-4 h-4 absolute right-3.5 top-2.5 text-gray-400" />
            </div>
            <p className="text-[10px] text-gray-400 mt-1">
              Sincronizado directamente con la categoría de la especie: bovina, porcina, avícola, ovina, caprina o cunícola.
            </p>
          </div>

          {/* Propósito Operativo */}
          <div>
            <label className="block text-[11px] font-bold text-[#1E1E1E] dark:text-gray-200 uppercase mb-1">
              Propósito Operativo <span className="text-red-500">*</span>
            </label>
            <select
              id="create-barn-purpose"
              value={formPurpose}
              onChange={(e) => setFormPurpose(e.target.value)}
              required
              disabled={allowedPurposes.length === 0}
              className="w-full px-3.5 py-2.5 bg-[#F9F9F9] dark:bg-[#121816] border border-gray-200 dark:border-[#263632] rounded-xl text-xs focus:ring-2 focus:ring-[#1B4D3E] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed text-gray-700 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500"
            >
              <option value="" disabled>
                {formSector ? 'Selecciona el propósito...' : 'Primero selecciona una especie...'}
              </option>
              {allowedPurposes.map((p) => (
                <option key={`create-purpose-${normalizeSectorKey(formSector)}-${p}`} value={p}>
                  {p}
                </option>
              ))}
            </select>
            <p className="text-[10px] text-gray-400 mt-1">
              {allowedPurposes.length > 0
                ? `Propósitos permitidos para el sector ${formSector}: ${allowedPurposes.join(', ')}.`
                : formSector
                ? `El sector "${formSector}" no tiene propósitos oficiales configurados.`
                : 'Las opciones dependen del sector pecuario de la especie seleccionada.'}
            </p>
          </div>

          {/* Capacidad Máxima */}
          <div>
            <label className="block text-[11px] font-bold text-[#1E1E1E] dark:text-gray-200 uppercase mb-1">
              Capacidad Máxima (Animales) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              min="1"
              step="1"
              placeholder="Ej. 1200"
              value={formMaxCapacity}
              onChange={(e) => setFormMaxCapacity(e.target.value)}
              required
              className="w-full px-3.5 py-2.5 bg-[#F9F9F9] dark:bg-[#121816] border border-gray-200 dark:border-[#263632] rounded-xl text-xs focus:ring-2 focus:ring-[#1B4D3E] text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
            />
            <p className="text-[10px] text-gray-400 mt-1">
              Límite de ocupación física para validación de densidad animal y asignación de lotes.
            </p>
          </div>

          {/* Granja Asignada para ROOT */}
          {isRoot && farmsList.length > 0 && (
            <div>
              <label className="block text-[11px] font-bold text-[#1E1E1E] dark:text-gray-200 uppercase mb-1">
                Granja Asignada <span className="text-red-500">*</span>
              </label>
              <select
                value={formFarmId}
                onChange={(e) => {
                  setFormFarmId(e.target.value);
                  loadActiveSpecies(e.target.value);
                }}
                required
                className="w-full px-3.5 py-2.5 bg-[#F9F9F9] dark:bg-[#121816] border border-gray-200 dark:border-[#263632] rounded-xl text-xs focus:ring-2 focus:ring-[#1B4D3E] text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
              >
                <option value="">Selecciona una granja...</option>
                {farmsList.map((f) => (
                  <option key={`farm-assign-${f.id}`} value={String(f.id)}>
                    {f.name} {f.code ? `(${f.code})` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Estado Activo */}
          <div className="col-span-1 md:col-span-2 p-3 bg-gray-50 dark:bg-[#121816] rounded-xl border border-gray-200 dark:border-[#263632] flex items-center justify-between">
            <div>
              <span className="font-bold text-xs text-[#1E1E1E] dark:text-gray-200 block">
                Galpón Habilitado
              </span>
              <span className="text-[10px] text-gray-400">
                Estará disponible inmediatamente para recibir lotes y animales.
              </span>
            </div>
            <input
              type="checkbox"
              checked={formIsActive}
              onChange={(e) => setFormIsActive(e.target.checked)}
              className="w-4 h-4 text-[#1B4D3E] focus:ring-[#1B4D3E] rounded border-gray-300 cursor-pointer"
            />
          </div>

          {/* Botones de acción */}
          <div className="col-span-1 md:col-span-2 pt-3 border-t border-gray-100 dark:border-[#263632] flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsCreateModalOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="accent"
              size="sm"
              disabled={isSubmitting}
              icon={<CheckCircle2 className="w-4 h-4" />}
            >
              {isSubmitting ? 'Guardando...' : 'Registrar Galpón'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* 7. Modal: Editar Galpón */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Editar Galpón"
        maxWidth="xl"
      >
        <form onSubmit={handleEditSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="block text-[11px] font-bold text-[#1E1E1E] dark:text-gray-200 uppercase mb-1">
              Nombre del Galpón <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              required
              className="w-full px-3.5 py-2.5 bg-[#F9F9F9] dark:bg-[#121816] border border-gray-200 dark:border-[#263632] rounded-xl text-xs focus:ring-2 focus:ring-[#1B4D3E] text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-[#1E1E1E] dark:text-gray-200 uppercase mb-1">
              Especie Pecuaria <span className="text-red-500">*</span>
            </label>
            <select
              value={formSpeciesId}
              onChange={(e) => handleSpeciesChange(e.target.value)}
              required
              className="w-full px-3.5 py-2.5 bg-[#F9F9F9] dark:bg-[#121816] border border-gray-200 dark:border-[#263632] rounded-xl text-xs focus:ring-2 focus:ring-[#1B4D3E] cursor-pointer text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
            >
              <option value="" disabled>
                Selecciona una especie...
              </option>
              {activeSpeciesList.map((sp) => (
                <option key={`edit-select-sp-${sp.id}`} value={sp.id}>
                  {sp.name} — Sector: {sp.category}
                </option>
              ))}
              {/* Preservar especie actual si no está en la lista de activas */}
              {selectedBarn?.species &&
                !activeSpeciesList.some((s) => s.id === selectedBarn.species?.id) && (
                  <option value={selectedBarn.species.id}>
                    {selectedBarn.species.name} (Especie asignada)
                  </option>
                )}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-[#1E1E1E] dark:text-gray-200 uppercase mb-1 flex items-center justify-between">
              <span>Sector Pecuario</span>
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold normal-case">
                Autocompletado automático
              </span>
            </label>
            <input
              type="text"
              readOnly
              value={formSector ? formSector.toUpperCase() : ''}
              className="w-full px-3.5 py-2.5 bg-gray-100 dark:bg-[#121816]/70 border border-gray-200 dark:border-[#263632] rounded-xl text-xs font-semibold cursor-not-allowed text-gray-700 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-[#1E1E1E] dark:text-gray-200 uppercase mb-1">
              Propósito Operativo <span className="text-red-500">*</span>
            </label>
            <select
              id="edit-barn-purpose"
              value={formPurpose}
              onChange={(e) => setFormPurpose(e.target.value)}
              required
              disabled={allowedPurposes.length === 0 && !formPurpose}
              className="w-full px-3.5 py-2.5 bg-[#F9F9F9] dark:bg-[#121816] border border-gray-200 dark:border-[#263632] rounded-xl text-xs focus:ring-2 focus:ring-[#1B4D3E] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed text-gray-700 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500"
            >
              <option value="" disabled>
                {formSector ? 'Selecciona el propósito...' : 'Primero selecciona una especie...'}
              </option>
              {allowedPurposes.map((p) => (
                <option key={`edit-purpose-${normalizeSectorKey(formSector)}-${p}`} value={p}>
                  {p}
                </option>
              ))}
              {/* Propósito histórico fuera del catálogo: visible sólo hasta que se cambie la especie */}
              {formPurpose && !allowedPurposes.includes(formPurpose) && (
                <option key="edit-purpose-legacy" value={formPurpose}>
                  {formPurpose} (valor actual)
                </option>
              )}
            </select>
            <p className="text-[10px] text-gray-400 mt-1">
              {allowedPurposes.length > 0
                ? `Propósitos permitidos para el sector ${formSector}: ${allowedPurposes.join(', ')}.`
                : 'Las opciones dependen del sector pecuario de la especie seleccionada.'}
            </p>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-[#1E1E1E] dark:text-gray-200 uppercase mb-1">
              Capacidad Máxima (Animales) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              min="1"
              step="1"
              value={formMaxCapacity}
              onChange={(e) => setFormMaxCapacity(e.target.value)}
              required
              className="w-full px-3.5 py-2.5 bg-[#F9F9F9] dark:bg-[#121816] border border-gray-200 dark:border-[#263632] rounded-xl text-xs focus:ring-2 focus:ring-[#1B4D3E] text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
            />
          </div>

          <div className="col-span-1 md:col-span-2 p-3 bg-gray-50 dark:bg-[#121816] rounded-xl border border-gray-200 dark:border-[#263632] flex items-center justify-between">
            <div>
              <span className="font-bold text-xs text-[#1E1E1E] dark:text-gray-200 block">
                Galpón Habilitado
              </span>
              <span className="text-[10px] text-gray-400">
                Al inhabilitarlo, no podrá recibir nuevos lotes ni movimientos de animales.
              </span>
            </div>
            <input
              type="checkbox"
              checked={formIsActive}
              onChange={(e) => setFormIsActive(e.target.checked)}
              className="w-4 h-4 text-[#1B4D3E] focus:ring-[#1B4D3E] rounded border-gray-300 cursor-pointer"
            />
          </div>

          <div className="col-span-1 md:col-span-2 pt-3 border-t border-gray-100 dark:border-[#263632] flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsEditModalOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="accent"
              size="sm"
              disabled={isSubmitting}
              icon={<CheckCircle2 className="w-4 h-4" />}
            >
              {isSubmitting ? 'Guardando...' : 'Actualizar Galpón'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* 8. Modal: Detalle de Galpón (Ficha Técnica) */}
      <Modal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        title="Ficha Técnica del Galpón"
      >
        {selectedBarn && (
          <div className="space-y-4 text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-[#263632]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#1B4D3E]/10 dark:bg-[#4E9F3D]/20 text-[#1B4D3E] dark:text-[#4E9F3D] flex items-center justify-center font-black text-sm">
                  <Warehouse className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-sm text-[#1E1E1E] dark:text-gray-100">
                    {safeText(selectedBarn.name)}
                  </h3>
                  <p className="text-[11px] text-gray-400">
                    ID Registro: #{selectedBarn.id}
                  </p>
                </div>
              </div>
              <StatusBadge isActive={selectedBarn.is_active} gender="male" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-gray-50 dark:bg-[#121816] rounded-xl border border-gray-200/60 dark:border-[#263632]">
                <span className="text-[10px] text-gray-400 uppercase font-bold block mb-0.5">
                  Especie Asignada
                </span>
                <span className="font-bold text-xs text-[#1E1E1E] dark:text-gray-200 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-[#4E9F3D]" />
                  {safeText(selectedBarn.species?.name, 'Sin especie')}
                </span>
              </div>

              <div className="p-3 bg-gray-50 dark:bg-[#121816] rounded-xl border border-gray-200/60 dark:border-[#263632]">
                <span className="text-[10px] text-gray-400 uppercase font-bold block mb-0.5">
                  Sector Pecuario
                </span>
                <span className="font-bold text-xs text-[#1B4D3E] dark:text-[#4E9F3D] capitalize flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5" />
                  {safeText(selectedBarn.sector || selectedBarn.category || selectedBarn.species?.category, 'General')}
                </span>
              </div>

              <div className="p-3 bg-gray-50 dark:bg-[#121816] rounded-xl border border-gray-200/60 dark:border-[#263632]">
                <span className="text-[10px] text-gray-400 uppercase font-bold block mb-0.5">
                  Propósito Operativo
                </span>
                <span className="font-bold text-xs text-gray-800 dark:text-gray-200">
                  {safeText(selectedBarn.purpose)}
                </span>
              </div>

              <div className="p-3 bg-gray-50 dark:bg-[#121816] rounded-xl border border-gray-200/60 dark:border-[#263632]">
                <span className="text-[10px] text-gray-400 uppercase font-bold block mb-0.5">
                  Capacidad Máxima
                </span>
                <span className="font-black text-sm text-[#1E1E1E] dark:text-gray-100 font-mono">
                  {Number(selectedBarn.max_capacity || 0).toLocaleString()} animales
                </span>
              </div>
            </div>

            {selectedBarn.farm && (
              <div className="p-3 bg-emerald-50/50 dark:bg-[#121816] rounded-xl border border-emerald-200/60 dark:border-[#263632] flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-gray-400 uppercase font-bold block">
                    Granja Propietaria
                  </span>
                  <span className="font-bold text-xs text-[#1B4D3E] dark:text-[#4E9F3D]">
                    {safeText(selectedBarn.farm.name)}
                  </span>
                </div>
                {selectedBarn.farm.code && (
                  <span className="text-[10px] px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 font-bold rounded-md font-mono">
                    {selectedBarn.farm.code}
                  </span>
                )}
              </div>
            )}

            <div className="pt-3 border-t border-gray-100 dark:border-[#263632] flex justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsDetailModalOpen(false)}
              >
                Cerrar
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* 9. Modal: Confirmación de Habilitar / Inhabilitar */}
      <Modal
        isOpen={isConfirmModalOpen}
        onClose={() => setIsConfirmModalOpen(false)}
        title={
          normalizeIsActive(selectedBarn?.is_active)
            ? 'Inhabilitar Galpón'
            : 'Habilitar Galpón'
        }
      >
        {selectedBarn && (
          <div className="space-y-4 text-xs">
            <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
              ¿Estás seguro de que deseas{' '}
              {normalizeIsActive(selectedBarn.is_active) ? 'inhabilitar' : 'habilitar'}{' '}
              el galpón{' '}
              <strong className="text-[#1E1E1E] dark:text-gray-100">
                "{safeText(selectedBarn.name)}"
              </strong>
              ?
              {normalizeIsActive(selectedBarn.is_active)
                ? ' Al inhabilitarlo, no podrá seleccionarse para nuevos lotes ni albergar animales.'
                : ' El galpón volverá a estar disponible inmediatamente para la asignación de lotes.'}
            </p>

            <div className="pt-3 border-t border-gray-100 dark:border-[#263632] flex items-center justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsConfirmModalOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                variant={
                  normalizeIsActive(selectedBarn.is_active) ? 'danger' : 'accent'
                }
                size="sm"
                disabled={isSubmitting}
                onClick={handleToggleStatus}
              >
                {isSubmitting
                  ? 'Actualizando...'
                  : normalizeIsActive(selectedBarn.is_active)
                  ? 'Confirmar Inhabilitación'
                  : 'Confirmar Habilitación'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
      {/* 10. Modal: Confirmación de Eliminación de Galpón */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Eliminar Galpón"
      >
        {selectedBarn && (
          <div className="space-y-4 text-xs">
            <div className="p-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-red-800 dark:text-red-200">
                  ¿Estás seguro de que deseas eliminar este galpón?
                </p>
                <p className="text-red-700 dark:text-red-300 mt-1 leading-relaxed">
                  Esta acción es <strong>irreversible</strong>. El galpón{' '}
                  <strong>"{safeText(selectedBarn.name)}"</strong> se eliminará
                  de forma permanente de la infraestructura de la granja.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsDeleteModalOpen(false)}
                disabled={isDeleting}
              >
                Cancelar
              </Button>
              <Button
                variant="danger"
                size="sm"
                disabled={isDeleting}
                onClick={handleDelete}
                icon={<Trash2 className="w-3.5 h-3.5" />}
              >
                {isDeleting ? 'Eliminando...' : 'Sí, Eliminar'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default ShedsView;
