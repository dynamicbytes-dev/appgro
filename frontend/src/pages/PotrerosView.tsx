import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { potreroService, type PotreroStats } from '../services/potreroService';
import { pastureService } from '../services/pastureService';
import { speciesService } from '../services/speciesService';
import { farmService } from '../services/farmService';
import type {
  Potrero,
  Species,
  Farm,
  PotreroManagement,
  PotreroGeometry,
  PotreroFeature,
  RotationHistoryEntry,
} from '../types/auth';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { PageHeader } from '../components/ui/PageHeader';
import { normalizeIsActive } from '../components/ui/StatusBadge';
import { Modal } from '../components/ui/Modal';
import { NumberInput } from '../components/ui/NumberInput';
import { ExportKpiPdfButton } from '../components/common/ExportKpiPdfButton';
import { PotreroCroquis } from '../components/potreros/PotreroCroquis';
import { PotreroMapEditor } from '../components/potreros/PotreroMapEditor';
import { safeText } from '../utils/safeText';
import {
  Fence,
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
  Sprout,
  Droplets,
  Calendar,
  Clock,
  Map as MapIcon,
  List as ListIcon,
  Pencil,
  History,
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

// Sectores pecuarios habilitados para el módulo de Potreros.
// Solo Bovino, Ovino y Caprino. Las demás especies se gestionan en "Galpones".
const POTRERO_ALLOWED_SECTORS = ['bovino', 'ovino', 'caprino'];

const isPotreroSectorAllowed = (category?: string | null): boolean => {
  const key = normalizeSectorKey(category);
  return !!key && POTRERO_ALLOWED_SECTORS.includes(key);
};

// Extrae el mensaje más específico posible de un error de API.
// En errores 422 de Laravel prioriza el primer error de campo (purpose, code,
// geometry, etc.) por encima del mensaje genérico "Error de validación de datos.".
const extractApiErrorMessage = (err: any, fallback: string): string => {
  const data = err?.response?.data;
  const fieldErrors = data?.errors;
  if (fieldErrors && typeof fieldErrors === 'object') {
    const firstKey = Object.keys(fieldErrors)[0];
    const firstValue = firstKey ? (fieldErrors as Record<string, unknown>)[firstKey] : null;
    const firstMessage = Array.isArray(firstValue) ? firstValue[0] : firstValue;
    if (firstMessage) return String(firstMessage);
  }
  return data?.message || err?.message || fallback;
};

// Fase 1: catálogos de características físicas y manejo del potrero.
const OPERATIONAL_STATUS_OPTIONS = [
  { value: 'disponible', label: 'Disponible' },
  { value: 'descanso', label: 'En Descanso' },
  { value: 'mantenimiento', label: 'En Mantenimiento / Renovación' },
];

const TOPOGRAFIA_OPTIONS = [
  { value: 'plano', label: 'Plano' },
  { value: 'ondulado', label: 'Ondulado' },
  { value: 'quebrado', label: 'Quebrado / Pendiente' },
];

const FUENTE_AGUA_OPTIONS = [
  'Bebedero automático',
  'Jagüey / Estanque',
  'Caño natural',
  'Pozo / Molino',
  'Ninguna (requiere callejón)',
];

const OPERATIONAL_STATE_META: Record<string, { label: string; className: string }> = {
  inactivo: {
    label: 'Inactivo',
    className: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300',
  },
  ocupado: {
    label: 'Ocupado',
    className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  },
  disponible: {
    label: 'Disponible',
    className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  },
  descanso: {
    label: 'En Descanso',
    className: 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300',
  },
  mantenimiento: {
    label: 'En Mantenimiento',
    className: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300',
  },
};

// Fase 2: catálogos de manejo agronómico.
const TREATMENT_TYPE_OPTIONS = [
  { value: 'fertilizacion', label: 'Fertilización' },
  { value: 'control_malezas', label: 'Control de Malezas' },
  { value: 'resiembra', label: 'Resiembra' },
  { value: 'riego', label: 'Riego' },
  { value: 'encalado', label: 'Encalado' },
  { value: 'otro', label: 'Otro' },
];

const TREATMENT_TYPE_LABELS: Record<string, string> = TREATMENT_TYPE_OPTIONS.reduce(
  (acc, option) => ({ ...acc, [option.value]: option.label }),
  {}
);

const DOSE_UNIT_OPTIONS = ['kg/ha', 'L/ha', 't/ha', 'g/ha', 'unidades'];

const todayIsoDate = (): string => {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  return new Date(now.getTime() - offset * 60 * 1000).toISOString().slice(0, 10);
};

const formatShortDate = (value?: string | null): string => {
  if (!value) return '—';
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString('es-VE', { day: '2-digit', month: 'short', year: 'numeric' });
};

// Centroide aproximado (promedio de vértices) de una geometría GeoJSON.
const geometryCentroid = (geometry: PotreroGeometry): [number, number] | null => {
  const geo = geometry as unknown as {
    type?: string;
    coordinates?: unknown;
  } | null;
  if (!geo) return null;

  const ring =
    geo.type === 'Polygon'
      ? (geo.coordinates as number[][][])?.[0]
      : (geo.coordinates as number[][][][])?.[0]?.[0];

  if (!Array.isArray(ring) || ring.length === 0) return null;

  const first = ring[0];
  const last = ring[ring.length - 1];
  const isClosed = ring.length > 1 && first[0] === last[0] && first[1] === last[1];
  const points = isClosed ? ring.slice(0, -1) : ring;

  const lng = points.reduce((acc, point) => acc + Number(point[0]), 0) / points.length;
  const lat = points.reduce((acc, point) => acc + Number(point[1]), 0) / points.length;

  return [Number(lng.toFixed(7)), Number(lat.toFixed(7))];
};

export const PotrerosView: React.FC = () => {
  const { user, activeFarm, farms: authFarms } = useAuth();
  const { toastSuccess, toastError } = useToast();

  const roleUpper = (user?.role || '').toUpperCase();
  const isRoot = roleUpper === 'ROOT';

  // Data States
  const [potrerosList, setPotrerosList] = useState<Potrero[]>([]);
  const [activeSpeciesList, setActiveSpeciesList] = useState<Species[]>([]);
  const [stats, setStats] = useState<PotreroStats>({
    total_potreros: 0,
    active_potreros: 0,
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
  const [selectedPotrero, setSelectedPotrero] = useState<Potrero | null>(null);

  // Form States
  const [formName, setFormName] = useState('');
  const [formSpeciesId, setFormSpeciesId] = useState<string>('');
  const [formSector, setFormSector] = useState('');
  const [formPurpose, setFormPurpose] = useState('');
  const [formMaxCapacity, setFormMaxCapacity] = useState<number | string>(100);
  const [formIsActive, setFormIsActive] = useState(true);
  const [formFarmId, setFormFarmId] = useState<string>('');
  // Fase 1: identificación y características físicas
  const [formCode, setFormCode] = useState<string>('');
  const [formSuperficieHa, setFormSuperficieHa] = useState<string>('');
  const [formCapacidadUa, setFormCapacidadUa] = useState<string>('');
  const [formOperationalStatus, setFormOperationalStatus] = useState<string>('disponible');
  const [formTipoPastura, setFormTipoPastura] = useState<string>('');
  const [formTopografia, setFormTopografia] = useState<string>('');
  const [formTipoCercado, setFormTipoCercado] = useState<string>('');
  const [formFuenteAgua, setFormFuenteAgua] = useState<string[]>([]);
  const [formNotes, setFormNotes] = useState<string>('');
  // Fase 3: croquis GeoJSON del potrero.
  const [formGeometry, setFormGeometry] = useState<PotreroGeometry | null>(null);

  // Fase 3: vista de croquis (mapa esquemático SVG).
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [geojsonFeatures, setGeojsonFeatures] = useState<PotreroFeature[]>([]);
  const [isLoadingGeojson, setIsLoadingGeojson] = useState(false);

  // Fase 2: manejo agronómico
  const [managementData, setManagementData] = useState<PotreroManagement | null>(null);
  const [isLoadingManagement, setIsLoadingManagement] = useState(false);
  const [isTreatmentModalOpen, setIsTreatmentModalOpen] = useState(false);
  const [isSurveyModalOpen, setIsSurveyModalOpen] = useState(false);
  const [isSubmittingManagement, setIsSubmittingManagement] = useState(false);
  const [managementDeleteTarget, setManagementDeleteTarget] = useState<{
    kind: 'treatment' | 'survey';
    id: number;
  } | null>(null);

  // Formulario de tratamiento
  const [treatmentType, setTreatmentType] = useState('fertilizacion');
  const [treatmentProduct, setTreatmentProduct] = useState('');
  const [treatmentDose, setTreatmentDose] = useState('');
  const [treatmentDoseUnit, setTreatmentDoseUnit] = useState(DOSE_UNIT_OPTIONS[0]);
  const [treatmentAppliedAt, setTreatmentAppliedAt] = useState(todayIsoDate());
  const [treatmentCost, setTreatmentCost] = useState('');
  const [treatmentNotes, setTreatmentNotes] = useState('');

  // Formulario de aforo
  const [surveyDate, setSurveyDate] = useState(todayIsoDate());
  const [surveyEntryHeight, setSurveyEntryHeight] = useState('');
  const [surveyExitHeight, setSurveyExitHeight] = useState('');
  const [surveyBiomass, setSurveyBiomass] = useState('');
  const [surveyNotes, setSurveyNotes] = useState('');

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
      console.warn('Error al cargar especies activas para potreros:', err);
      setActiveSpeciesList([]);
    } finally {
      setIsLoadingSpecies(false);
    }
  }, []);

  // Load Potreros & Stats from API
  const loadPotreros = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    setErrorMessage(null);
    try {
      const [potrerosRes, statsRes] = await Promise.all([
        potreroService.getAll({
          farm_id: effectiveFarmId,
        }),
        potreroService.getStats({ farm_id: effectiveFarmId }).catch(() => null),
      ]);

      const rows = Array.isArray(potrerosRes?.data) ? potrerosRes.data : [];
      setPotrerosList(rows);

      if (statsRes) {
        setStats(statsRes);
      } else if (potrerosRes?.stats) {
        setStats(potrerosRes.stats);
      }
    } catch (err: any) {
      console.error('Error al cargar potreros:', err);
      const msg = err.response?.data?.message || 'Error al cargar los potreros de la granja.';
      setErrorMessage(msg);
      toastError('Error al Cargar', msg);
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, [effectiveFarmId, toastError]);

  // Fase 3: carga la capa GeoJSON de potreros para el croquis.
  const loadGeojsonCroquis = useCallback(async () => {
    setIsLoadingGeojson(true);
    try {
      const collection = await potreroService.getGeojson({ farm_id: effectiveFarmId });
      setGeojsonFeatures(Array.isArray(collection?.features) ? collection.features : []);
    } catch (err) {
      console.warn('Error al cargar la capa GeoJSON de potreros:', err);
      setGeojsonFeatures([]);
    } finally {
      setIsLoadingGeojson(false);
    }
  }, [effectiveFarmId]);

  // Initial and reactive fetch on farm scope change
  useEffect(() => {
    loadPotreros();
    loadActiveSpecies(effectiveFarmId);
  }, [loadPotreros, loadActiveSpecies, effectiveFarmId]);

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
      (isEditModalOpen && selectedPotrero?.species && String(selectedPotrero.species.id) === String(speciesIdSelected)
        ? selectedPotrero.species
        : undefined);
    setFormSector(match?.category || '');
    // Las especies personalizadas ("Otro") solo admiten el propósito Carne.
    if ((match as { is_custom?: boolean } | undefined)?.is_custom) {
      setFormPurpose('Carne');
    }
  };

  // Especie seleccionada en el formulario (crear o editar): permite saber
  // si es personalizada ("Otro") para restringir sus propósitos.
  const selectedFormSpecies = useMemo<{ is_custom?: boolean } | null>(() => {
    const found = activeSpeciesList.find((sp) => String(sp.id) === String(formSpeciesId));
    if (found) return found;
    if (isEditModalOpen && selectedPotrero?.species && String(selectedPotrero.species.id) === String(formSpeciesId)) {
      return selectedPotrero.species as { is_custom?: boolean };
    }
    return null;
  }, [activeSpeciesList, formSpeciesId, isEditModalOpen, selectedPotrero]);
  const formSpeciesIsCustom = !!selectedFormSpecies?.is_custom;

  // Opciones de propósito derivadas reactivamente del sector actual.
  // Las especies personalizadas ("Otro") solo admiten el propósito "Carne".
  const allowedPurposes = useMemo(
    () => (formSpeciesIsCustom ? ['Carne'] : getPurposesForSector(formSector)),
    [formSpeciesIsCustom, formSector]
  );

  // Especies seleccionables para un potrero: solo Bovino, Ovino y Caprino.
  // (Avícola, Porcino y Cunícola se gestionan en el módulo "Galpones").
  const allowedSpeciesOptions = useMemo(
    () => activeSpeciesList.filter((sp) => isPotreroSectorAllowed(sp.category)),
    [activeSpeciesList]
  );

  // Cálculo reactivo garantizado de las métricas de potreros
  const computedPotreroStats = useMemo(() => {
    const listTotal = potrerosList.length;
    const listActive = potrerosList.filter((b) => normalizeIsActive(b.is_active)).length;
    const listCapacity = potrerosList.reduce((acc, b) => acc + (Number(b.max_capacity) || 0), 0);
    const listSpecies = new Set(
      potrerosList.map((b) => b.species_id || b.species?.id).filter(Boolean)
    ).size;

    return {
      total: Math.max(Number(stats?.total_potreros || 0), listTotal),
      active: Math.max(Number(stats?.active_potreros || 0), listActive),
      capacity: Math.max(Number(stats?.global_capacity || stats?.capacidad_global || 0), listCapacity),
      associatedSpecies: Math.max(
        Number(stats?.associated_species || stats?.especies_asociadas || 0),
        listSpecies
      ),
    };
  }, [stats, potrerosList]);

  // Filtered potreros list in memory for instant feedback
  const filteredPotreros = useMemo(() => {
    return potrerosList.filter((potrero) => {
      // 1. Search term
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const bName = (potrero?.name || '').toLowerCase();
        const bPurpose = (potrero?.purpose || '').toLowerCase();
        const bSpecies = (potrero?.species?.name || '').toLowerCase();
        const bCategory = (potrero?.category || potrero?.sector || '').toLowerCase();
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
      const isActive = normalizeIsActive(potrero.is_active);
      if (statusFilter === 'active' && !isActive) return false;
      if (statusFilter === 'inactive' && isActive) return false;

      // 3. Species filter
      if (speciesFilter !== 'all') {
        if (String(potrero.species_id) !== String(speciesFilter)) {
          return false;
        }
      }

      return true;
    });
  }, [potrerosList, searchTerm, statusFilter, speciesFilter]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredPotreros.length / pageSize));
  const paginatedPotreros = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredPotreros.slice(startIndex, startIndex + pageSize);
  }, [filteredPotreros, currentPage, pageSize]);

  // Evita quedarse en una página vacía tras eliminar registros
  useEffect(() => {
    if (
      currentPage > 1 &&
      filteredPotreros.length > 0 &&
      paginatedPotreros.length === 0
    ) {
      setCurrentPage((prev) => Math.max(1, prev - 1));
    }
  }, [currentPage, filteredPotreros.length, paginatedPotreros.length]);

  // Handlers for Modals
  const openCreateModal = () => {
    setFormName('');
    setFormSpeciesId('');
    setFormSector('');
    setFormPurpose('');
    setFormMaxCapacity(100);
    setFormIsActive(true);
    setFormFarmId(isRoot ? (selectedRootFarmId && selectedRootFarmId !== 'all' ? selectedRootFarmId : '') : '');
    setFormCode('');
    setFormSuperficieHa('');
    setFormCapacidadUa('');
    setFormOperationalStatus('disponible');
    setFormTipoPastura('');
    setFormTopografia('');
    setFormTipoCercado('');
    setFormFuenteAgua([]);
    setFormNotes('');
    setFormGeometry(null);
    setErrorMessage(null);
    setIsCreateModalOpen(true);
  };

  const openEditModal = (potrero: Potrero) => {
    setSelectedPotrero(potrero);
    setFormName(potrero.name || '');
    setFormSpeciesId(potrero.species_id ? String(potrero.species_id) : '');
    setFormSector(potrero.species?.category || potrero.sector || potrero.category || '');
    setFormPurpose(potrero.purpose || '');

    setFormMaxCapacity(potrero.max_capacity || 100);
    setFormIsActive(normalizeIsActive(potrero.is_active));
    setFormFarmId(potrero.farm_id ? String(potrero.farm_id) : '');
    setFormCode(potrero.code || '');
    setFormSuperficieHa(
      potrero.superficie_ha !== null && potrero.superficie_ha !== undefined ? String(potrero.superficie_ha) : ''
    );
    setFormCapacidadUa(
      potrero.capacidad_ua !== null && potrero.capacidad_ua !== undefined ? String(potrero.capacidad_ua) : ''
    );
    setFormOperationalStatus(potrero.operational_status || 'disponible');
    setFormTipoPastura(potrero.tipo_pastura || '');
    setFormTopografia(potrero.topografia || '');
    setFormTipoCercado(potrero.tipo_cercado || '');
    setFormFuenteAgua(Array.isArray(potrero.fuente_agua) ? potrero.fuente_agua : []);
    setFormNotes(potrero.notes || '');
    setFormGeometry(potrero.geometry ?? null);
    setErrorMessage(null);
    setIsEditModalOpen(true);
  };

  // Fase 2: ficha de manejo (métricas derivadas + historiales).
  const loadManagement = useCallback(async (potreroId: number) => {
    setIsLoadingManagement(true);
    try {
      const data = await pastureService.getManagement(potreroId);
      setManagementData(data);
    } catch {
      setManagementData(null);
    } finally {
      setIsLoadingManagement(false);
    }
  }, []);

  const openDetailModal = (potrero: Potrero) => {
    setSelectedPotrero(potrero);
    setManagementData(null);
    setIsDetailModalOpen(true);
    void loadManagement(potrero.id);
  };

  const openTreatmentModal = () => {
    setTreatmentType('fertilizacion');
    setTreatmentProduct('');
    setTreatmentDose('');
    setTreatmentDoseUnit(DOSE_UNIT_OPTIONS[0]);
    setTreatmentAppliedAt(todayIsoDate());
    setTreatmentCost('');
    setTreatmentNotes('');
    setIsTreatmentModalOpen(true);
  };

  const openSurveyModal = () => {
    setSurveyDate(todayIsoDate());
    setSurveyEntryHeight('');
    setSurveyExitHeight('');
    setSurveyBiomass('');
    setSurveyNotes('');
    setIsSurveyModalOpen(true);
  };

  const handleTreatmentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPotrero) return;

    if (!treatmentAppliedAt) {
      toastError('Datos incompletos', 'Indique la fecha de aplicación.');
      return;
    }

    setIsSubmittingManagement(true);
    try {
      await pastureService.createTreatment(selectedPotrero.id, {
        type: treatmentType,
        product: treatmentProduct.trim() || null,
        dose: toNumberOrNull(treatmentDose),
        dose_unit: treatmentDoseUnit || null,
        applied_at: treatmentAppliedAt,
        cost: toNumberOrNull(treatmentCost),
        notes: treatmentNotes.trim() || null,
      });
      toastSuccess('Tratamiento Registrado', 'El tratamiento fue registrado correctamente.');
      setIsTreatmentModalOpen(false);
      await loadManagement(selectedPotrero.id);
    } catch (err: any) {
      const msg =
        err?.response?.data?.message || 'No se pudo registrar el tratamiento. Verifique los datos.';
      toastError('Error al Guardar', msg);
    } finally {
      setIsSubmittingManagement(false);
    }
  };

  const handleSurveySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPotrero) return;

    if (!surveyDate) {
      toastError('Datos incompletos', 'Indique la fecha del aforo.');
      return;
    }

    setIsSubmittingManagement(true);
    try {
      await pastureService.createBiomassSurvey(selectedPotrero.id, {
        surveyed_at: surveyDate,
        entry_height_cm: toNumberOrNull(surveyEntryHeight),
        exit_height_cm: toNumberOrNull(surveyExitHeight),
        biomass_kg_dm_ha: toNumberOrNull(surveyBiomass),
        notes: surveyNotes.trim() || null,
      });
      toastSuccess('Aforo Registrado', 'El aforo de forraje fue registrado correctamente.');
      setIsSurveyModalOpen(false);
      await loadManagement(selectedPotrero.id);
    } catch (err: any) {
      const msg =
        err?.response?.data?.message || 'No se pudo registrar el aforo. Verifique los datos.';
      toastError('Error al Guardar', msg);
    } finally {
      setIsSubmittingManagement(false);
    }
  };

  const handleConfirmManagementDelete = async () => {
    if (!selectedPotrero || !managementDeleteTarget) return;

    setIsSubmittingManagement(true);
    try {
      if (managementDeleteTarget.kind === 'treatment') {
        await pastureService.deleteTreatment(selectedPotrero.id, managementDeleteTarget.id);
        toastSuccess('Tratamiento Eliminado', 'El registro de manejo fue eliminado.');
      } else {
        await pastureService.deleteBiomassSurvey(selectedPotrero.id, managementDeleteTarget.id);
        toastSuccess('Aforo Eliminado', 'El registro de aforo fue eliminado.');
      }
      setManagementDeleteTarget(null);
      await loadManagement(selectedPotrero.id);
    } catch {
      toastError('Error al Eliminar', 'No se pudo eliminar el registro.');
    } finally {
      setIsSubmittingManagement(false);
    }
  };

  const openConfirmToggle = (potrero: Potrero) => {
    setSelectedPotrero(potrero);
    setIsConfirmModalOpen(true);
  };

  // ---- Helpers Fase 1: identificación y características físicas ----
  const toNumberOrNull = (value: string): number | null => {
    if (value.trim() === '') return null;
    const parsed = Number(value);
    return Number.isNaN(parsed) ? null : parsed;
  };

  const toggleFuenteAgua = (value: string) => {
    setFormFuenteAgua((prev) =>
      prev.includes(value) ? prev.filter((item) => item !== value) : [...prev, value]
    );
  };

  const computedUaPerHa = (() => {
    const surface = toNumberOrNull(formSuperficieHa);
    const capacity = toNumberOrNull(formCapacidadUa);
    if (surface && surface > 0 && capacity !== null) {
      return (capacity / surface).toFixed(2);
    }
    return null;
  })();

  const buildManagementPayload = () => {
    const centroid = formGeometry ? geometryCentroid(formGeometry) : null;
    return {
      code: formCode.trim() || undefined,
      superficie_ha: toNumberOrNull(formSuperficieHa),
      capacidad_ua: toNumberOrNull(formCapacidadUa),
      operational_status: formOperationalStatus || 'disponible',
      tipo_pastura: formTipoPastura.trim() || null,
      topografia: formTopografia || null,
      tipo_cercado: formTipoCercado.trim() || null,
      fuente_agua: formFuenteAgua.length > 0 ? formFuenteAgua : null,
      notes: formNotes.trim() || null,
      geometry: formGeometry,
      centroid_lat: centroid ? centroid[1] : null,
      centroid_lng: centroid ? centroid[0] : null,
    };
  };

  // Estado mostrado (híbrido): usa el derivado del backend o lo recalcula.
  const getOperationalStateKey = (potrero: Potrero): string => {
    if (potrero.operational_state) return potrero.operational_state;
    if (!normalizeIsActive(potrero.is_active)) return 'inactivo';
    return potrero.operational_status || 'disponible';
  };

  const getUaPerHa = (potrero: Potrero): number | null => {
    if (potrero.ua_per_ha !== null && potrero.ua_per_ha !== undefined) return potrero.ua_per_ha;
    const surface = Number(potrero.superficie_ha || 0);
    if (
      surface > 0 &&
      potrero.capacidad_ua !== null &&
      potrero.capacidad_ua !== undefined
    ) {
      return Number((Number(potrero.capacidad_ua) / surface).toFixed(2));
    }
    return null;
  };

  const renderManagementFields = (mode: 'create' | 'edit') => {
    const textInputClass =
      'w-full px-3.5 py-2.5 bg-[#F9F9F9] dark:bg-[#121816] border border-gray-200 dark:border-[#263632] rounded-xl text-xs focus:ring-2 focus:ring-[#1B4D3E] text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500';

    return (
      <>
        <div className="col-span-1 md:col-span-2 mt-1 pt-4 border-t border-gray-100 dark:border-[#263632]">
          <span className="text-[11px] font-bold text-[#1E1E1E] dark:text-gray-200 uppercase tracking-wider">
            Características del Potrero
          </span>
          <p className="text-[10px] text-gray-400 mt-0.5">
            Datos agronómicos y de infraestructura. Todos son opcionales.
          </p>
        </div>

        {/* Código interno */}
        <div>
          <label className="block text-[11px] font-bold text-[#1E1E1E] dark:text-gray-200 uppercase mb-1">
            Código Interno
          </label>
          <input
            type="text"
            value={formCode}
            onChange={(e) => setFormCode(e.target.value)}
            placeholder="POT-0001 (autogenerado)"
            className={textInputClass}
          />
          <p className="text-[10px] text-gray-400 mt-1">
            Único por granja. Si se deja vacío, se genera automáticamente.
          </p>
        </div>

        {/* Superficie */}
        <div>
          <label className="block text-[11px] font-bold text-[#1E1E1E] dark:text-gray-200 uppercase mb-1">
            Superficie (ha)
          </label>
          <NumberInput
            min="0"
            step="0.01"
            value={formSuperficieHa}
            onChange={(e) => setFormSuperficieHa(e.target.value)}
            placeholder="Ej. 12.5"
            className={textInputClass}
          />
          <p className="text-[10px] text-gray-400 mt-1">Área total del potrero en hectáreas.</p>
        </div>

        {/* Capacidad UA */}
        <div>
          <label className="block text-[11px] font-bold text-[#1E1E1E] dark:text-gray-200 uppercase mb-1">
            Capacidad de Carga (UA)
          </label>
          <NumberInput
            min="0"
            step="0.01"
            value={formCapacidadUa}
            onChange={(e) => setFormCapacidadUa(e.target.value)}
            placeholder="Ej. 20"
            className={textInputClass}
          />
          <p className="text-[10px] text-gray-400 mt-1">
            {computedUaPerHa
              ? `Equivale a ${computedUaPerHa} UA/ha.`
              : 'Unidades Animales (UA) soportadas sin degradar la pastura.'}
          </p>
        </div>

        {/* Estado operativo */}
        <div>
          <label className="block text-[11px] font-bold text-[#1E1E1E] dark:text-gray-200 uppercase mb-1">
            Estado Operativo
          </label>
          <select
            value={formOperationalStatus}
            onChange={(e) => setFormOperationalStatus(e.target.value)}
            className={`${textInputClass} cursor-pointer`}
          >
            {OPERATIONAL_STATUS_OPTIONS.map((option) => (
              <option key={`${mode}-op-${option.value}`} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <p className="text-[10px] text-gray-400 mt-1">
            El estado "Ocupado" se calcula automáticamente según los lotes activos.
          </p>
        </div>

        {/* Tipo de pastura */}
        <div>
          <label className="block text-[11px] font-bold text-[#1E1E1E] dark:text-gray-200 uppercase mb-1">
            Tipo de Pastura
          </label>
          <input
            type="text"
            value={formTipoPastura}
            onChange={(e) => setFormTipoPastura(e.target.value)}
            placeholder="Ej. Brachiaria brizantha"
            className={textInputClass}
          />
        </div>

        {/* Topografía */}
        <div>
          <label className="block text-[11px] font-bold text-[#1E1E1E] dark:text-gray-200 uppercase mb-1">
            Topografía
          </label>
          <select
            value={formTopografia}
            onChange={(e) => setFormTopografia(e.target.value)}
            className={`${textInputClass} cursor-pointer`}
          >
            <option value="">Sin especificar</option>
            {TOPOGRAFIA_OPTIONS.map((option) => (
              <option key={`${mode}-topo-${option.value}`} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {/* Tipo de cercado */}
        <div>
          <label className="block text-[11px] font-bold text-[#1E1E1E] dark:text-gray-200 uppercase mb-1">
            Tipo de Cercado
          </label>
          <input
            type="text"
            value={formTipoCercado}
            onChange={(e) => setFormTipoCercado(e.target.value)}
            placeholder="Ej. Cerca eléctrica"
            className={textInputClass}
          />
        </div>

        {/* Fuentes de agua */}
        <div className="col-span-1 md:col-span-2">
          <label className="block text-[11px] font-bold text-[#1E1E1E] dark:text-gray-200 uppercase mb-1">
            Fuentes de Agua
          </label>
          <div className="flex flex-wrap gap-2">
            {FUENTE_AGUA_OPTIONS.map((source) => {
              const active = formFuenteAgua.includes(source);
              return (
                <button
                  key={`${mode}-water-${source}`}
                  type="button"
                  onClick={() => toggleFuenteAgua(source)}
                  className={`px-2.5 py-1 rounded-lg border text-[11px] font-medium transition-colors cursor-pointer ${
                    active
                      ? 'bg-[#1B4D3E] border-[#1B4D3E] text-white'
                      : 'bg-[#F9F9F9] dark:bg-[#121816] border-gray-200 dark:border-[#263632] text-gray-600 dark:text-gray-300 hover:border-[#1B4D3E]/60'
                  }`}
                >
                  {source}
                </button>
              );
            })}
          </div>
        </div>

        {/* Notas */}
        <div className="col-span-1 md:col-span-2">
          <label className="block text-[11px] font-bold text-[#1E1E1E] dark:text-gray-200 uppercase mb-1">
            Notas
          </label>
          <textarea
            rows={2}
            value={formNotes}
            onChange={(e) => setFormNotes(e.target.value)}
            placeholder="Observaciones del potrero..."
            className={`${textInputClass} resize-none`}
          />
        </div>

        {/* Fase 3: croquis del potrero */}
        <div className="col-span-1 md:col-span-2 mt-1 pt-4 border-t border-gray-100 dark:border-[#263632]">
          <span className="text-[11px] font-bold text-[#1E1E1E] dark:text-gray-200 uppercase tracking-wider flex items-center gap-1.5">
            <Pencil className="w-3.5 h-3.5 text-[#4E9F3D]" />
            Croquis del Potrero (Opcional)
          </span>
          <p className="text-[10px] text-gray-400 mt-0.5 mb-2">
            Dibuja el contorno del potrero sobre el mapa satelital. Se guarda como GeoJSON con
            coordenadas geográficas reales.
          </p>
          <PotreroMapEditor value={formGeometry} onChange={setFormGeometry} />
        </div>
      </>
    );
  };

  const openDeleteModal = (potrero: Potrero) => {
    setSelectedPotrero(potrero);
    setIsDeleteModalOpen(true);
  };

  // Errores de validación: se muestran dentro de la modal (banner) y como toast,
  // porque el banner global de la página queda oculto tras la modal.
  const notifyValidationError = (msg: string) => {
    setErrorMessage(msg);
    toastError('Datos incompletos', msg);
  };

  // Form Submit: Create Potrero
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      notifyValidationError('El nombre del potrero es obligatorio.');
      return;
    }
    if (!formSpeciesId) {
      notifyValidationError('Debe seleccionar una especie activa asignada a este potrero.');
      return;
    }

    const finalPurpose = formPurpose.trim();
    if (!finalPurpose) {
      notifyValidationError('Debe especificar el propósito productivo del potrero.');
      return;
    }

    const capacityNum = Number(formMaxCapacity);
    if (isNaN(capacityNum) || capacityNum <= 0) {
      notifyValidationError('La capacidad máxima debe ser mayor a 0 animales.');
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

      const created = await potreroService.create({
        name: formName.trim(),
        species_id: Number(formSpeciesId),
        category: formSector || undefined,
        sector: formSector || undefined,
        purpose: finalPurpose,
        max_capacity: capacityNum,
        is_active: formIsActive,
        farm_id: payloadFarmId,
        ...buildManagementPayload(),
      });

      setPotrerosList((prev) => [created, ...prev]);

      // Actualización inmediata de métricas sin esperar recargas
      setStats((prev) => ({
        ...prev,
        total_potreros: (prev.total_potreros || potrerosList.length) + 1,
        active_potreros: (prev.active_potreros || 0) + (formIsActive ? 1 : 0),
        global_capacity: (prev.global_capacity || prev.capacidad_global || 0) + capacityNum,
        capacidad_global: (prev.global_capacity || prev.capacidad_global || 0) + capacityNum,
      }));

      setIsCreateModalOpen(false);
      setSuccessMessage('Potrero registrado exitosamente.');
      toastSuccess('Registro Exitoso', `El potrero "${created.name}" fue creado correctamente.`);
      loadPotreros(true);
      if (viewMode === 'map') void loadGeojsonCroquis();
    } catch (err: any) {
      console.error('Error al registrar potrero:', err);
      const msg = extractApiErrorMessage(
        err,
        'No se pudo registrar el potrero. Verifique los datos.'
      );
      setErrorMessage(msg);
      toastError('Error al Guardar', msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Form Submit: Edit Potrero
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPotrero) return;

    if (!formName.trim()) {
      notifyValidationError('El nombre del potrero es obligatorio.');
      return;
    }
    if (!formSpeciesId) {
      notifyValidationError('Debe seleccionar una especie para el potrero.');
      return;
    }

    const finalPurpose = formPurpose.trim();
    if (!finalPurpose) {
      notifyValidationError('Debe especificar el propósito del potrero.');
      return;
    }

    const capacityNum = Number(formMaxCapacity);
    if (isNaN(capacityNum) || capacityNum <= 0) {
      notifyValidationError('La capacidad máxima debe ser mayor a 0 animales.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const updated = await potreroService.update(selectedPotrero.id, {
        name: formName.trim(),
        species_id: Number(formSpeciesId),
        category: formSector || undefined,
        sector: formSector || undefined,
        purpose: finalPurpose,
        max_capacity: capacityNum,
        is_active: formIsActive,
        ...buildManagementPayload(),
      });

      setPotrerosList((prev) =>
        prev.map((b) => (b.id === selectedPotrero.id ? { ...b, ...updated } : b))
      );
      setIsEditModalOpen(false);
      setSuccessMessage('Potrero actualizado exitosamente.');
      toastSuccess('Actualización Exitosa', `El potrero "${updated.name}" fue modificado correctamente.`);
      loadPotreros(true);
      if (viewMode === 'map') void loadGeojsonCroquis();
    } catch (err: any) {
      console.error('Error al actualizar potrero:', err);
      const msg = extractApiErrorMessage(err, 'No se pudo actualizar el potrero.');
      setErrorMessage(msg);
      toastError('Error al Actualizar', msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Toggle Potrero Status (Habilitar / Inhabilitar)
  const handleToggleStatus = async () => {
    if (!selectedPotrero) return;
    const currentIsActive = normalizeIsActive(selectedPotrero.is_active);
    const newStatus = !currentIsActive;

    setIsSubmitting(true);
    try {
      await potreroService.toggleStatus(selectedPotrero.id, newStatus);
      setPotrerosList((prev) =>
        prev.map((b) => (b.id === selectedPotrero.id ? { ...b, is_active: newStatus } : b))
      );
      setIsConfirmModalOpen(false);
      const actionMsg = newStatus ? 'habilitado' : 'inhabilitado';
      toastSuccess('Estado Actualizado', `El potrero "${selectedPotrero.name}" fue ${actionMsg} correctamente.`);
      loadPotreros(true);
      if (viewMode === 'map') void loadGeojsonCroquis();
    } catch (err: any) {
      console.error('Error al cambiar estado del potrero:', err);
      toastError('Error de Operación', 'No se pudo cambiar el estado del potrero.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete Potrero: confirma, ejecuta DELETE y filtra el estado local (optimista)
  const handleDelete = async () => {
    if (!selectedPotrero) return;

    const potreroToDelete = selectedPotrero;
    setIsDeleting(true);
    try {
      await potreroService.delete(potreroToDelete.id);

      // Actualización optimista: el potrero desaparece de la tabla sin recargar
      setPotrerosList((prev) => prev.filter((b) => b.id !== potreroToDelete.id));

      // Ajuste inmediato de las métricas de potreros
      const wasActive = normalizeIsActive(potreroToDelete.is_active);
      const capacity = Number(potreroToDelete.max_capacity || 0);
      const speciesKey = potreroToDelete.species_id || potreroToDelete.species?.id;
      const speciesStillUsed = potrerosList.some(
        (b) =>
          b.id !== potreroToDelete.id &&
          !!speciesKey &&
          !!(b.species_id || b.species?.id) &&
          String(b.species_id || b.species?.id) === String(speciesKey)
      );
      setStats((prev) => ({
        ...prev,
        total_potreros: Math.max(
          0,
          (prev.total_potreros || 0) - 1
        ),
        active_potreros: Math.max(
          0,
          (prev.active_potreros || 0) - (wasActive ? 1 : 0)
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
      setSelectedPotrero(null);
      setSuccessMessage(
        `Potrero "${potreroToDelete.name}" eliminado correctamente.`
      );
      toastSuccess(
        'Potrero Eliminado',
        `"${potreroToDelete.name}" se eliminó de la granja.`
      );
      loadPotreros(true);
      if (viewMode === 'map') void loadGeojsonCroquis();
    } catch (err: any) {
      console.error('Error al eliminar potrero:', err);
      const status = err?.response?.status;
      // Motivo exacto devuelto por la API (ej. 422 por lotes/registros operativos)
      const serverMsg = err?.response?.data?.message;
      const errs = err?.response?.data?.errors;
      const firstFieldError = errs ? Object.values(errs)[0] : null;
      const detail =
        serverMsg ||
        (Array.isArray(firstFieldError) ? firstFieldError[0] : firstFieldError) ||
        null;

      const msg = detail || 'No se pudo eliminar el potrero.';
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
      <PageHeader
        icon={<Fence className="w-5 h-5" />}
        badge={activeFarm?.name && !isRoot ? safeText(activeFarm.name) : undefined}
        title="Gestión de Potreros e Infraestructura"
        subtitle="Administración de capacidad, asignación de especies y finalidades productivas por potrero."
      >
          <div className="inline-flex items-center rounded-xl border border-gray-200 dark:border-[#263632] overflow-hidden bg-[#F9F9F9] dark:bg-[#121816]">
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`inline-flex items-center gap-1.5 px-3 py-2 text-[11px] font-bold transition-colors cursor-pointer ${
                viewMode === 'list'
                  ? 'bg-[#1B4D3E] text-white'
                  : 'text-gray-500 dark:text-gray-400 hover:text-[#1B4D3E] dark:hover:text-[#4E9F3D]'
              }`}
            >
              <ListIcon className="w-3.5 h-3.5" /> Lista
            </button>
            <button
              type="button"
              onClick={() => {
                setViewMode('map');
                void loadGeojsonCroquis();
              }}
              className={`inline-flex items-center gap-1.5 px-3 py-2 text-[11px] font-bold transition-colors cursor-pointer ${
                viewMode === 'map'
                  ? 'bg-[#1B4D3E] text-white'
                  : 'text-gray-500 dark:text-gray-400 hover:text-[#1B4D3E] dark:hover:text-[#4E9F3D]'
              }`}
            >
              <MapIcon className="w-3.5 h-3.5" /> Croquis
            </button>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadPotreros()}
            disabled={isLoading}
            icon={<RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />}
          >
            Actualizar
          </Button>
          {(() => {
            const totalOccupied = potrerosList.reduce(
              (acc, b) => acc + (Number((b as any).occupied_capacity) || 0),
              0
            );
            const occupancyPct =
              stats.global_capacity > 0
                ? ((totalOccupied / stats.global_capacity) * 100).toFixed(1) + '%'
                : '0%';
            return (
              <ExportKpiPdfButton
                moduleTitle="Módulo de Potreros e Infraestructura Pecuaria"
                moduleSlug="potreros"
                kpis={[
                  {
                    title: 'Potreros Totales',
                    value: stats.total_potreros,
                    subtitle: 'Estructuras registradas',
                    tone: 'slate',
                  },
                  {
                    title: 'Potreros Activos',
                    value: stats.active_potreros,
                    subtitle: 'En servicio operativo',
                    tone: 'emerald',
                  },
                  {
                    title: 'Capacidad Instalada',
                    value: `${stats.global_capacity.toLocaleString()} plazas`,
                    subtitle: 'Capacidad zootécnica máx.',
                    tone: 'slate',
                  },
                  {
                    title: 'Ocupación Real',
                    value: `${occupancyPct} (${totalOccupied.toLocaleString()} animales)`,
                    subtitle: 'Animales alojados activos',
                    tone:
                      totalOccupied > stats.global_capacity
                        ? 'red'
                        : totalOccupied > stats.global_capacity * 0.9
                        ? 'amber'
                        : 'emerald',
                  },
                ]}
                diagnosis={`Capacidad instalada global de ${stats.global_capacity.toLocaleString()} plazas con una tasa de ocupación real del ${occupancyPct} (${totalOccupied.toLocaleString()} animales alojados) en ${stats.active_potreros} potreros operativos.`}
                columns={[
                  'ID',
                  'Nombre Potrero',
                  'Sector Pecuario',
                  'Propósito',
                  'Capacidad Máx',
                  'Ocupación Real',
                  '% Ocupación',
                  'Estado',
                ]}
                rows={potrerosList.map((b) => {
                  const occ = Number((b as any).occupied_capacity) || 0;
                  const pct =
                    b.max_capacity > 0 ? ((occ / b.max_capacity) * 100).toFixed(0) + '%' : '0%';
                  return [
                    `POT-${b.id}`,
                    b.name,
                    safeText(b.species?.name, b.sector || 'General'),
                    safeText(b.purpose, 'Producción'),
                    String(b.max_capacity),
                    String(occ),
                    pct,
                    normalizeIsActive(b.is_active) ? 'Activo' : 'Inactivo',
                  ];
                })}
              />
            );
          })()}
          <Button
            variant="accent"
            size="sm"
            onClick={openCreateModal}
            icon={<Plus className="w-4 h-4" />}
          >
            Nuevo Potrero
          </Button>
      </PageHeader>

      {/* 2. Resumen Superior: 4 Tarjetas Métricas (KPI Targets) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Potreros Totales */}
        <Card key="target-total-potreros" className="p-4 bg-white dark:bg-[#18221F] border border-gray-200 dark:border-[#263632]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Potreros Totales
              </p>
              <h3 className="text-2xl font-black text-[#1E1E1E] dark:text-gray-100 mt-0.5">
                {computedPotreroStats.total}
              </h3>
              <p className="text-[10px] text-gray-400 mt-0.5">Estructuras registradas</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-[#1B4D3E]/10 dark:bg-[#4E9F3D]/20 text-[#1B4D3E] dark:text-[#4E9F3D] flex items-center justify-center shrink-0">
              <Fence className="w-5 h-5" />
            </div>
          </div>
        </Card>

        {/* Potreros Activos */}
        <Card key="target-active-potreros" className="p-4 bg-white dark:bg-[#18221F] border border-gray-200 dark:border-[#263632]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                Potreros Activos
              </p>
              <h3 className="text-2xl font-black text-emerald-700 dark:text-emerald-300 mt-0.5">
                {computedPotreroStats.active}
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
                {computedPotreroStats.capacity.toLocaleString()}
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
                {computedPotreroStats.associatedSpecies}
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
      {viewMode === 'list' && (
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
              {allowedSpeciesOptions.map((sp) => (
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
      )}

      {/* 4. Table of Potreros */}
      {viewMode === 'list' && (
      <Card className="overflow-hidden bg-white dark:bg-[#18221F] border border-gray-200 dark:border-[#263632]">
        {isLoading ? (
          <div key="potreros-loading-state" className="p-16 text-center text-xs text-gray-500">
            <RefreshCw className="w-7 h-7 animate-spin mx-auto text-[#1B4D3E] dark:text-[#4E9F3D] mb-3" />
            <p className="font-bold text-sm text-[#1E1E1E] dark:text-gray-200">
              Cargando potreros de la granja...
            </p>
            <p className="text-xs text-gray-400 mt-1">Consultando infraestructura y capacidades operativas.</p>
          </div>
        ) : (
          <div key="potreros-table-wrapper" className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#F9F9F9] dark:bg-[#121816] border-b border-gray-200 dark:border-[#263632] text-[11px] font-bold uppercase text-[#1E1E1E] dark:text-gray-400 tracking-wider">
                  <th className="py-3.5 px-4">Nombre del Potrero</th>
                  <th className="py-3.5 px-4">Especie Asociada</th>
                  <th className="py-3.5 px-4">Sector Pecuario</th>
                  <th className="py-3.5 px-4">Propósito Operativo</th>
                  <th className="py-3.5 px-4 text-right">Capacidad Máxima</th>
                  <th className="py-3.5 px-4 text-right">Superficie</th>
                  <th className="py-3.5 px-4 text-center">Estado</th>
                  <th className="py-3.5 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-[#263632] text-xs">
                {paginatedPotreros.length === 0 ? (
                  <tr key="potreros-empty-row">
                    <td colSpan={8} className="py-12 text-center text-gray-500">
                      <div className="max-w-sm mx-auto text-center space-y-2">
                        <Fence className="w-8 h-8 mx-auto text-gray-300 dark:text-gray-600" />
                        <p className="font-bold text-sm text-[#1E1E1E] dark:text-gray-200">
                          No se encontraron potreros registrados
                        </p>
                        <p className="text-xs text-gray-400">
                          {searchTerm || statusFilter !== 'all' || speciesFilter !== 'all'
                            ? 'No hay registros que coincidan con los filtros aplicados.'
                            : 'Comienza creando la primera instalación de potrero para tu granja.'}
                        </p>
                        <Button
                          variant="accent"
                          size="sm"
                          onClick={openCreateModal}
                          className="mt-2"
                          icon={<Plus className="w-3.5 h-3.5" />}
                        >
                          Nuevo Potrero
                        </Button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedPotreros.map((potrero) => {
                    const bName = safeText(potrero?.name, 'Potrero sin nombre');
                    const bInitial = (bName.charAt(0) || 'G').toUpperCase();
                    const speciesName = safeText(potrero?.species?.name, 'Sin especie asignada');
                    const sectorLabel = safeText(
                      potrero?.sector || potrero?.category || potrero?.species?.category,
                      'General'
                    );
                    const purposeText = safeText(potrero?.purpose, 'Sin propósito definido');
                    const capacityVal = Number(potrero?.max_capacity || 0);
                    const isActive = normalizeIsActive(potrero.is_active);

                    return (
                      <tr
                        key={potrero.id}
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
                              {potrero.code && (
                                <span className="text-[10px] text-gray-400 font-mono font-normal block mt-0.5">
                                  {potrero.code}
                                </span>
                              )}
                              {potrero.farm?.name && (
                                <span className="text-[10px] text-gray-400 font-normal flex items-center gap-1 mt-0.5">
                                  <Building2 className="w-2.5 h-2.5 text-[#4E9F3D]" />
                                  {safeText(potrero.farm.name)}
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

                        {/* 5b. Superficie */}
                        <td className="py-3.5 px-4 text-right font-mono font-bold text-gray-800 dark:text-gray-200">
                          {potrero.superficie_ha !== null && potrero.superficie_ha !== undefined ? (
                            <>
                              <span>{Number(potrero.superficie_ha).toLocaleString()}</span>
                              <span className="text-[10px] text-gray-400 ml-1 font-sans font-normal">ha</span>
                            </>
                          ) : (
                            <span className="text-gray-400 font-sans font-normal text-[10px]">—</span>
                          )}
                        </td>

                        {/* 6. Estado (derivado) */}
                        <td className="py-3.5 px-4 text-center">
                          {(() => {
                            const meta =
                              OPERATIONAL_STATE_META[getOperationalStateKey(potrero)] ||
                              OPERATIONAL_STATE_META.disponible;
                            return (
                              <span
                                className={`inline-flex px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase ${meta.className}`}
                              >
                                {meta.label}
                              </span>
                            );
                          })()}
                        </td>

                        {/* 7. Acciones (Ver, Editar, Inhabilitar, Eliminar) */}
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Ver detalle */}
                            <button
                              type="button"
                              onClick={() => openDetailModal(potrero)}
                              title="Ver ficha técnica"
                              className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors cursor-pointer"
                            >
                              <Eye className="w-4 h-4" />
                            </button>

                            {/* Editar */}
                            <button
                              type="button"
                              onClick={() => openEditModal(potrero)}
                              title="Editar potrero"
                              className="p-1.5 rounded-lg text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40 transition-colors cursor-pointer"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>

                            {/* Inhabilitar / Habilitar */}
                            <button
                              type="button"
                              onClick={() => openConfirmToggle(potrero)}
                              title={isActive ? 'Inhabilitar potrero' : 'Habilitar potrero'}
                              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                                isActive
                                  ? 'text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40'
                                  : 'text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40'
                              }`}
                            >
                              <Power className="w-4 h-4" />
                            </button>

                            {/* Eliminar */}
                            <button
                              type="button"
                              onClick={() => openDeleteModal(potrero)}
                              title="Eliminar potrero"
                              className="p-1.5 rounded-lg text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors cursor-pointer"
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
              {paginatedPotreros.length}
            </span>{' '}
            de{' '}
            <span className="font-bold text-[#1E1E1E] dark:text-gray-200">
              {filteredPotreros.length}
            </span>{' '}
            potreros
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
      )}

      {/* 4b. Croquis esquemático de potreros (Fase 3) */}
      {viewMode === 'map' && (
        <Card className="p-4 sm:p-5 bg-white dark:bg-[#18221F] border border-gray-200 dark:border-[#263632]">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#1E1E1E] dark:text-gray-200 flex items-center gap-1.5">
                <MapIcon className="w-3.5 h-3.5 text-[#4E9F3D]" />
                Croquis de la Granja
              </span>
              <p className="text-[10px] text-gray-400 mt-0.5">
                Mapa satelital de la granja: haz clic en un potrero para ver su ficha técnica.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => loadGeojsonCroquis()}
              disabled={isLoadingGeojson}
              icon={
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingGeojson ? 'animate-spin' : ''}`} />
              }
            >
              Actualizar
            </Button>
          </div>

          <PotreroCroquis
            features={geojsonFeatures}
            isLoading={isLoadingGeojson}
            selectedId={selectedPotrero?.id ?? null}
            onSelect={(id) => {
              const match = potrerosList.find((p) => p.id === id);
              if (match) openDetailModal(match);
            }}
          />
        </Card>
      )}

      {/* 6. Modal: Registrar Nuevo Potrero */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Registrar Nuevo Potrero"
        maxWidth="4xl"
      >
        <form onSubmit={handleCreateSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          {errorMessage && (
            <div className="col-span-1 md:col-span-2 p-3 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 rounded-xl text-xs text-red-700 dark:text-red-300 flex items-start justify-between gap-2">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <span>{safeText(errorMessage)}</span>
              </div>
              <button
                type="button"
                onClick={() => setErrorMessage(null)}
                className="font-bold text-xs text-red-600 shrink-0"
              >
                ✕
              </button>
            </div>
          )}
          {!isLoadingSpecies && allowedSpeciesOptions.length === 0 && (
            <div className="col-span-1 md:col-span-2 p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl text-xs text-amber-700 dark:text-amber-300 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span>
                No hay especies activas de Bovino, Ovino o Caprino en esta granja. Registra o
                activa una especie en el módulo de Especies antes de crear potreros.
              </span>
            </div>
          )}
          {/* Nombre */}
          <div>
            <label className="block text-[11px] font-bold text-[#1E1E1E] dark:text-gray-200 uppercase mb-1">
              Nombre del Potrero <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              placeholder="Ej. Potrero 01 - Cerdas Gestantes, Corral Norte 2..."
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
                  : allowedSpeciesOptions.length === 0
                  ? 'No hay especies activas de Bovino, Ovino o Caprino'
                  : 'Selecciona una especie activa...'}
              </option>
              {allowedSpeciesOptions.map((sp) => (
                <option key={`create-select-sp-${sp.id}`} value={sp.id}>
                  {sp.name} — Sector: {sp.category}
                </option>
              ))}
            </select>
            <p className="text-[10px] text-gray-400 mt-1">
              Solo se permiten especies de los sectores Bovino, Ovino y Caprino. Las demás se gestionan en el módulo Galpones.
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
              id="create-potrero-purpose"
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
              {formSpeciesIsCustom
                ? 'Especie personalizada: solo se permite el propósito Carne.'
                : allowedPurposes.length > 0
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
            <NumberInput
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

          {renderManagementFields('create')}

          {/* Estado Activo */}
          <div className="col-span-1 md:col-span-2 p-3 bg-gray-50 dark:bg-[#121816] rounded-xl border border-gray-200 dark:border-[#263632] flex items-center justify-between">
            <div>
              <span className="font-bold text-xs text-[#1E1E1E] dark:text-gray-200 block">
                Potrero Habilitado
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
              {isSubmitting ? 'Guardando...' : 'Registrar Potrero'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* 7. Modal: Editar Potrero */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Editar Potrero"
        maxWidth="4xl"
      >
        <form onSubmit={handleEditSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          {errorMessage && (
            <div className="col-span-1 md:col-span-2 p-3 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 rounded-xl text-xs text-red-700 dark:text-red-300 flex items-start justify-between gap-2">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <span>{safeText(errorMessage)}</span>
              </div>
              <button
                type="button"
                onClick={() => setErrorMessage(null)}
                className="font-bold text-xs text-red-600 shrink-0"
              >
                ✕
              </button>
            </div>
          )}
          <div>
            <label className="block text-[11px] font-bold text-[#1E1E1E] dark:text-gray-200 uppercase mb-1">
              Nombre del Potrero <span className="text-red-500">*</span>
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
              {allowedSpeciesOptions.map((sp) => (
                <option key={`edit-select-sp-${sp.id}`} value={sp.id}>
                  {sp.name} — Sector: {sp.category}
                </option>
              ))}
              {/* Preservar especie actual si no está en la lista de activas */}
              {selectedPotrero?.species &&
                !activeSpeciesList.some((s) => s.id === selectedPotrero.species?.id) && (
                  <option value={selectedPotrero.species.id}>
                    {selectedPotrero.species.name} (Especie asignada)
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
              id="edit-potrero-purpose"
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
              {formSpeciesIsCustom
                ? 'Especie personalizada: solo se permite el propósito Carne.'
                : allowedPurposes.length > 0
                ? `Propósitos permitidos para el sector ${formSector}: ${allowedPurposes.join(', ')}.`
                : 'Las opciones dependen del sector pecuario de la especie seleccionada.'}
            </p>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-[#1E1E1E] dark:text-gray-200 uppercase mb-1">
              Capacidad Máxima (Animales) <span className="text-red-500">*</span>
            </label>
            <NumberInput
              min="1"
              step="1"
              value={formMaxCapacity}
              onChange={(e) => setFormMaxCapacity(e.target.value)}
              required
              className="w-full px-3.5 py-2.5 bg-[#F9F9F9] dark:bg-[#121816] border border-gray-200 dark:border-[#263632] rounded-xl text-xs focus:ring-2 focus:ring-[#1B4D3E] text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
            />
          </div>

          {renderManagementFields('edit')}

          <div className="col-span-1 md:col-span-2 p-3 bg-gray-50 dark:bg-[#121816] rounded-xl border border-gray-200 dark:border-[#263632] flex items-center justify-between">
            <div>
              <span className="font-bold text-xs text-[#1E1E1E] dark:text-gray-200 block">
                Potrero Habilitado
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
              {isSubmitting ? 'Guardando...' : 'Actualizar Potrero'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* 8. Modal: Detalle de Potrero (Ficha Técnica) */}
      <Modal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        title="Ficha Técnica del Potrero"
      >
        {selectedPotrero && (
          <div className="space-y-4 text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-[#263632]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#1B4D3E]/10 dark:bg-[#4E9F3D]/20 text-[#1B4D3E] dark:text-[#4E9F3D] flex items-center justify-center font-black text-sm">
                  <Fence className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-sm text-[#1E1E1E] dark:text-gray-100">
                    {safeText(selectedPotrero.name)}
                  </h3>
                  <p className="text-[11px] text-gray-400">
                    {selectedPotrero.code ? `${selectedPotrero.code} · ` : ''}ID Registro: #{selectedPotrero.id}
                  </p>
                </div>
              </div>
              {(() => {
                const meta =
                  OPERATIONAL_STATE_META[getOperationalStateKey(selectedPotrero)] ||
                  OPERATIONAL_STATE_META.disponible;
                return (
                  <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase ${meta.className}`}>
                    {meta.label}
                  </span>
                );
              })()}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-gray-50 dark:bg-[#121816] rounded-xl border border-gray-200/60 dark:border-[#263632]">
                <span className="text-[10px] text-gray-400 uppercase font-bold block mb-0.5">
                  Especie Asignada
                </span>
                <span className="font-bold text-xs text-[#1E1E1E] dark:text-gray-200 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-[#4E9F3D]" />
                  {safeText(selectedPotrero.species?.name, 'Sin especie')}
                </span>
              </div>

              <div className="p-3 bg-gray-50 dark:bg-[#121816] rounded-xl border border-gray-200/60 dark:border-[#263632]">
                <span className="text-[10px] text-gray-400 uppercase font-bold block mb-0.5">
                  Sector Pecuario
                </span>
                <span className="font-bold text-xs text-[#1B4D3E] dark:text-[#4E9F3D] capitalize flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5" />
                  {safeText(selectedPotrero.sector || selectedPotrero.category || selectedPotrero.species?.category, 'General')}
                </span>
              </div>

              <div className="p-3 bg-gray-50 dark:bg-[#121816] rounded-xl border border-gray-200/60 dark:border-[#263632]">
                <span className="text-[10px] text-gray-400 uppercase font-bold block mb-0.5">
                  Propósito Operativo
                </span>
                <span className="font-bold text-xs text-gray-800 dark:text-gray-200">
                  {safeText(selectedPotrero.purpose)}
                </span>
              </div>

              <div className="p-3 bg-gray-50 dark:bg-[#121816] rounded-xl border border-gray-200/60 dark:border-[#263632]">
                <span className="text-[10px] text-gray-400 uppercase font-bold block mb-0.5">
                  Capacidad Máxima
                </span>
                <span className="font-black text-sm text-[#1E1E1E] dark:text-gray-100 font-mono">
                  {Number(selectedPotrero.max_capacity || 0).toLocaleString()} animales
                </span>
              </div>
            </div>

            {/* Características físicas y operativas (Fase 1) */}
            <div className="space-y-3">
              <span className="text-[10px] text-gray-400 uppercase font-bold block">
                Características del Potrero
              </span>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-gray-50 dark:bg-[#121816] rounded-xl border border-gray-200/60 dark:border-[#263632]">
                  <span className="text-[10px] text-gray-400 uppercase font-bold block mb-0.5">
                    Superficie
                  </span>
                  <span className="font-bold text-xs text-[#1E1E1E] dark:text-gray-200 font-mono">
                    {selectedPotrero.superficie_ha !== null && selectedPotrero.superficie_ha !== undefined
                      ? `${Number(selectedPotrero.superficie_ha).toLocaleString()} ha`
                      : '—'}
                  </span>
                </div>

                {selectedPotrero.geometry && (
                  <div className="p-3 bg-gray-50 dark:bg-[#121816] rounded-xl border border-gray-200/60 dark:border-[#263632]">
                    <span className="text-[10px] text-gray-400 uppercase font-bold block mb-0.5">
                      Superficie del Croquis
                    </span>
                    <span className="font-bold text-xs text-[#1E1E1E] dark:text-gray-200 font-mono">
                      {selectedPotrero.geo_area_ha !== null &&
                      selectedPotrero.geo_area_ha !== undefined
                        ? `${Number(selectedPotrero.geo_area_ha).toLocaleString()} ha`
                        : '—'}
                    </span>
                  </div>
                )}

                <div className="p-3 bg-gray-50 dark:bg-[#121816] rounded-xl border border-gray-200/60 dark:border-[#263632]">
                  <span className="text-[10px] text-gray-400 uppercase font-bold block mb-0.5">
                    Capacidad de Carga
                  </span>
                  <span className="font-bold text-xs text-[#1E1E1E] dark:text-gray-200 font-mono">
                    {selectedPotrero.capacidad_ua !== null && selectedPotrero.capacidad_ua !== undefined
                      ? `${Number(selectedPotrero.capacidad_ua).toLocaleString()} UA`
                      : '—'}
                  </span>
                </div>

                <div className="p-3 bg-gray-50 dark:bg-[#121816] rounded-xl border border-gray-200/60 dark:border-[#263632]">
                  <span className="text-[10px] text-gray-400 uppercase font-bold block mb-0.5">
                    Carga (UA/ha)
                  </span>
                  <span className="font-bold text-xs text-[#1E1E1E] dark:text-gray-200 font-mono">
                    {getUaPerHa(selectedPotrero) !== null ? getUaPerHa(selectedPotrero) : '—'}
                  </span>
                </div>

                <div className="p-3 bg-gray-50 dark:bg-[#121816] rounded-xl border border-gray-200/60 dark:border-[#263632]">
                  <span className="text-[10px] text-gray-400 uppercase font-bold block mb-0.5">
                    Estado Operativo
                  </span>
                  <span className="font-bold text-xs text-[#1E1E1E] dark:text-gray-200">
                    {(OPERATIONAL_STATE_META[getOperationalStateKey(selectedPotrero)] ||
                      OPERATIONAL_STATE_META.disponible).label}
                  </span>
                </div>

                <div className="p-3 bg-gray-50 dark:bg-[#121816] rounded-xl border border-gray-200/60 dark:border-[#263632]">
                  <span className="text-[10px] text-gray-400 uppercase font-bold block mb-0.5">
                    Tipo de Pastura
                  </span>
                  <span className="font-bold text-xs text-[#1E1E1E] dark:text-gray-200">
                    {safeText(selectedPotrero.tipo_pastura, '—')}
                  </span>
                </div>

                <div className="p-3 bg-gray-50 dark:bg-[#121816] rounded-xl border border-gray-200/60 dark:border-[#263632]">
                  <span className="text-[10px] text-gray-400 uppercase font-bold block mb-0.5">
                    Topografía
                  </span>
                  <span className="font-bold text-xs text-[#1E1E1E] dark:text-gray-200 capitalize">
                    {TOPOGRAFIA_OPTIONS.find((option) => option.value === selectedPotrero.topografia)?.label ||
                      safeText(selectedPotrero.topografia, '—')}
                  </span>
                </div>

                <div className="p-3 bg-gray-50 dark:bg-[#121816] rounded-xl border border-gray-200/60 dark:border-[#263632]">
                  <span className="text-[10px] text-gray-400 uppercase font-bold block mb-0.5">
                    Tipo de Cercado
                  </span>
                  <span className="font-bold text-xs text-[#1E1E1E] dark:text-gray-200">
                    {safeText(selectedPotrero.tipo_cercado, '—')}
                  </span>
                </div>

                <div className="p-3 bg-gray-50 dark:bg-[#121816] rounded-xl border border-gray-200/60 dark:border-[#263632]">
                  <span className="text-[10px] text-gray-400 uppercase font-bold block mb-0.5">
                    Ocupación
                  </span>
                  <span className="font-bold text-xs text-[#1E1E1E] dark:text-gray-200 font-mono">
                    {Number(selectedPotrero.occupied_capacity || 0).toLocaleString()} /{' '}
                    {Number(selectedPotrero.max_capacity || 0).toLocaleString()}
                  </span>
                </div>
              </div>

              {Array.isArray(selectedPotrero.fuente_agua) && selectedPotrero.fuente_agua.length > 0 && (
                <div className="p-3 bg-gray-50 dark:bg-[#121816] rounded-xl border border-gray-200/60 dark:border-[#263632]">
                  <span className="text-[10px] text-gray-400 uppercase font-bold block mb-1">
                    Fuentes de Agua
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedPotrero.fuente_agua.map((source) => (
                      <span
                        key={`detail-water-${source}`}
                        className="px-2 py-0.5 rounded-md bg-sky-100 dark:bg-sky-900/40 text-sky-800 dark:text-sky-300 text-[10px] font-semibold"
                      >
                        {source}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {selectedPotrero.notes && (
                <div className="p-3 bg-gray-50 dark:bg-[#121816] rounded-xl border border-gray-200/60 dark:border-[#263632]">
                  <span className="text-[10px] text-gray-400 uppercase font-bold block mb-1">
                    Notas
                  </span>
                  <p className="text-xs text-gray-600 dark:text-gray-300 whitespace-pre-line">
                    {selectedPotrero.notes}
                  </p>
                </div>
              )}
            </div>

            {/* Fase 2: Manejo y Rotación */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-gray-400 uppercase font-bold flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-[#4E9F3D]" />
                  Manejo y Rotación
                </span>
                {isLoadingManagement && (
                  <RefreshCw className="w-3.5 h-3.5 text-[#4E9F3D] animate-spin" />
                )}
              </div>

              {isLoadingManagement && !managementData ? (
                <div className="p-6 text-center text-xs text-gray-400 rounded-xl border border-dashed border-gray-200 dark:border-[#263632]">
                  Cargando información de manejo…
                </div>
              ) : managementData ? (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <div className="p-3 bg-gray-50 dark:bg-[#121816] rounded-xl border border-gray-200/60 dark:border-[#263632]">
                      <span className="text-[10px] text-gray-400 uppercase font-bold flex items-center gap-1 mb-0.5">
                        <Clock className="w-3 h-3" /> Días de Ocupación
                      </span>
                      <span className="font-bold text-sm text-[#1E1E1E] dark:text-gray-200 font-mono">
                        {managementData.days_occupied !== null
                          ? `${managementData.days_occupied} días`
                          : '—'}
                      </span>
                    </div>

                    <div className="p-3 bg-gray-50 dark:bg-[#121816] rounded-xl border border-gray-200/60 dark:border-[#263632]">
                      <span className="text-[10px] text-gray-400 uppercase font-bold flex items-center gap-1 mb-0.5">
                        <RotateCcw className="w-3 h-3" /> Días de Descanso
                      </span>
                      <span className="font-bold text-sm text-[#1E1E1E] dark:text-gray-200 font-mono">
                        {managementData.days_resting !== null
                          ? `${managementData.days_resting} días`
                          : '—'}
                      </span>
                    </div>

                    <div className="p-3 bg-gray-50 dark:bg-[#121816] rounded-xl border border-gray-200/60 dark:border-[#263632]">
                      <span className="text-[10px] text-gray-400 uppercase font-bold flex items-center gap-1 mb-0.5">
                        <Calendar className="w-3 h-3" /> Salida Estimada
                      </span>
                      <span className="font-bold text-xs text-[#1E1E1E] dark:text-gray-200">
                        {managementData.estimated_exit_date
                          ? formatShortDate(managementData.estimated_exit_date)
                          : '—'}
                      </span>
                    </div>

                    <div className="p-3 bg-gray-50 dark:bg-[#121816] rounded-xl border border-gray-200/60 dark:border-[#263632]">
                      <span className="text-[10px] text-gray-400 uppercase font-bold flex items-center gap-1 mb-0.5">
                        <Sprout className="w-3 h-3" /> Forraje Disponible
                      </span>
                      <span className="font-bold text-xs text-[#1E1E1E] dark:text-gray-200 font-mono">
                        {managementData.forage_available_kg_dm !== null
                          ? `${Number(managementData.forage_available_kg_dm).toLocaleString()} kg MS`
                          : '—'}
                      </span>
                    </div>

                    <div className="p-3 bg-gray-50 dark:bg-[#121816] rounded-xl border border-gray-200/60 dark:border-[#263632]">
                      <span className="text-[10px] text-gray-400 uppercase font-bold flex items-center gap-1 mb-0.5">
                        <Activity className="w-3 h-3" /> Demanda Diaria
                      </span>
                      <span className="font-bold text-xs text-[#1E1E1E] dark:text-gray-200 font-mono">
                        {managementData.daily_demand_kg_dm !== null
                          ? `${Number(managementData.daily_demand_kg_dm).toLocaleString()} kg MS/día`
                          : '—'}
                      </span>
                    </div>

                    <div className="p-3 bg-gray-50 dark:bg-[#121816] rounded-xl border border-gray-200/60 dark:border-[#263632]">
                      <span className="text-[10px] text-gray-400 uppercase font-bold flex items-center gap-1 mb-0.5">
                        <Boxes className="w-3 h-3" /> Lotes Activos
                      </span>
                      <span className="font-bold text-xs text-[#1E1E1E] dark:text-gray-200 font-mono">
                        {managementData.active_lots.length} ·{' '}
                        {Number(managementData.occupied_capacity).toLocaleString()} anim.
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Historial de Tratamientos */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-gray-400 uppercase font-bold flex items-center gap-1.5">
                          <Sprout className="w-3.5 h-3.5 text-[#4E9F3D]" />
                          Tratamientos ({managementData.treatments.length})
                        </span>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          icon={<Plus className="w-3.5 h-3.5" />}
                          onClick={openTreatmentModal}
                        >
                          Registrar
                        </Button>
                      </div>
                      {managementData.treatments.length === 0 ? (
                        <p className="text-[11px] text-gray-400 italic">
                          Sin tratamientos registrados.
                        </p>
                      ) : (
                        <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                          {managementData.treatments.map((treatment) => (
                            <div
                              key={`treat-${treatment.id}`}
                              className="flex items-center justify-between gap-3 p-2.5 bg-gray-50 dark:bg-[#121816] rounded-xl border border-gray-200/60 dark:border-[#263632]"
                            >
                              <div className="min-w-0">
                                <span className="block text-xs font-bold text-[#1E1E1E] dark:text-gray-200">
                                  {TREATMENT_TYPE_LABELS[treatment.type] || treatment.type}
                                  {treatment.product ? ` · ${treatment.product}` : ''}
                                </span>
                                <span className="block text-[10px] text-gray-400">
                                  {formatShortDate(treatment.applied_at)}
                                  {treatment.dose
                                    ? ` · ${Number(treatment.dose).toLocaleString()} ${
                                        treatment.dose_unit || ''
                                      }`
                                    : ''}
                                  {treatment.cost
                                    ? ` · $${Number(treatment.cost).toLocaleString()}`
                                    : ''}
                                </span>
                                {treatment.notes && (
                                  <span className="block text-[10px] text-gray-400 italic truncate">
                                    {treatment.notes}
                                  </span>
                                )}
                              </div>
                              <button
                                type="button"
                                title="Eliminar tratamiento"
                                onClick={() =>
                                  setManagementDeleteTarget({ kind: 'treatment', id: treatment.id })
                                }
                                className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors cursor-pointer shrink-0"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Historial de Aforos */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-gray-400 uppercase font-bold flex items-center gap-1.5">
                          <Droplets className="w-3.5 h-3.5 text-sky-500" />
                          Aforos de Forraje ({managementData.biomass_surveys.length})
                        </span>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          icon={<Plus className="w-3.5 h-3.5" />}
                          onClick={openSurveyModal}
                        >
                          Registrar
                        </Button>
                      </div>
                      {managementData.biomass_surveys.length === 0 ? (
                        <p className="text-[11px] text-gray-400 italic">Sin aforos registrados.</p>
                      ) : (
                        <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                          {managementData.biomass_surveys.map((survey) => (
                            <div
                              key={`survey-${survey.id}`}
                              className="flex items-center justify-between gap-3 p-2.5 bg-gray-50 dark:bg-[#121816] rounded-xl border border-gray-200/60 dark:border-[#263632]"
                            >
                              <div className="min-w-0">
                                <span className="block text-xs font-bold text-[#1E1E1E] dark:text-gray-200">
                                  {survey.biomass_kg_dm_ha !== null &&
                                  survey.biomass_kg_dm_ha !== undefined
                                    ? `${Number(survey.biomass_kg_dm_ha).toLocaleString()} kg MS/ha`
                                    : 'Aforo'}
                                </span>
                                <span className="block text-[10px] text-gray-400">
                                  {formatShortDate(survey.surveyed_at)}
                                  {survey.entry_height_cm
                                    ? ` · Entrada ${Number(survey.entry_height_cm).toLocaleString()} cm`
                                    : ''}
                                  {survey.exit_height_cm
                                    ? ` · Salida ${Number(survey.exit_height_cm).toLocaleString()} cm`
                                    : ''}
                                </span>
                                {survey.notes && (
                                  <span className="block text-[10px] text-gray-400 italic truncate">
                                    {survey.notes}
                                  </span>
                                )}
                              </div>
                              <button
                                type="button"
                                title="Eliminar aforo"
                                onClick={() =>
                                  setManagementDeleteTarget({ kind: 'survey', id: survey.id })
                                }
                                className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors cursor-pointer shrink-0"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Fase 3: Historial de Rotaciones */}
                  <div className="space-y-2">
                    <span className="text-[10px] text-gray-400 uppercase font-bold flex items-center gap-1.5">
                      <History className="w-3.5 h-3.5 text-[#4E9F3D]" />
                      Historial de Rotaciones ({managementData.rotation_count})
                    </span>
                    {managementData.rotation_history.length === 0 ? (
                      <p className="text-[11px] text-gray-400 italic">Sin rotaciones registradas.</p>
                    ) : (
                      <div className="overflow-x-auto rounded-xl border border-gray-200/60 dark:border-[#263632]">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-gray-50 dark:bg-[#121816] text-[10px] uppercase text-gray-400 font-bold">
                              <th className="py-2 px-3">Lote</th>
                              <th className="py-2 px-3">Especie</th>
                              <th className="py-2 px-3 text-right">Animales</th>
                              <th className="py-2 px-3">Ingreso</th>
                              <th className="py-2 px-3">Salida</th>
                              <th className="py-2 px-3 text-right">Días</th>
                              <th className="py-2 px-3 text-center">Estado</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100 dark:divide-[#263632] text-[11px]">
                            {managementData.rotation_history.map((entry: RotationHistoryEntry) => (
                              <tr
                                key={`rotation-${entry.id}`}
                                className="text-gray-600 dark:text-gray-300"
                              >
                                <td className="py-2 px-3 font-mono font-bold text-[#1E1E1E] dark:text-gray-200">
                                  {entry.code || `#${entry.id}`}
                                </td>
                                <td className="py-2 px-3">{safeText(entry.species, '—')}</td>
                                <td className="py-2 px-3 text-right font-mono">
                                  {Number(entry.quantity).toLocaleString()}
                                </td>
                                <td className="py-2 px-3">{formatShortDate(entry.entry_date)}</td>
                                <td className="py-2 px-3">
                                  {entry.exit_date ? (
                                    formatShortDate(entry.exit_date)
                                  ) : (
                                    <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase">
                                      En curso
                                    </span>
                                  )}
                                </td>
                                <td className="py-2 px-3 text-right font-mono">
                                  {entry.days_occupied !== null && entry.days_occupied !== undefined
                                    ? entry.days_occupied
                                    : '—'}
                                </td>
                                <td className="py-2 px-3 text-center">
                                  <span
                                    className={`inline-flex px-2 py-0.5 rounded-md text-[9px] font-bold uppercase ${
                                      entry.status === 'activo'
                                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                                        : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300'
                                    }`}
                                  >
                                    {entry.status}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="p-4 text-center text-xs text-gray-400 rounded-xl border border-dashed border-gray-200 dark:border-[#263632]">
                  No hay información de manejo disponible.
                </div>
              )}
            </div>

            {selectedPotrero.farm && (
              <div className="p-3 bg-emerald-50/50 dark:bg-[#121816] rounded-xl border border-emerald-200/60 dark:border-[#263632] flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-gray-400 uppercase font-bold block">
                    Granja Propietaria
                  </span>
                  <span className="font-bold text-xs text-[#1B4D3E] dark:text-[#4E9F3D]">
                    {safeText(selectedPotrero.farm.name)}
                  </span>
                </div>
                {selectedPotrero.farm.code && (
                  <span className="text-[10px] px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 font-bold rounded-md font-mono">
                    {selectedPotrero.farm.code}
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
          normalizeIsActive(selectedPotrero?.is_active)
            ? 'Inhabilitar Potrero'
            : 'Habilitar Potrero'
        }
      >
        {selectedPotrero && (
          <div className="space-y-4 text-xs">
            <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
              ¿Estás seguro de que deseas{' '}
              {normalizeIsActive(selectedPotrero.is_active) ? 'inhabilitar' : 'habilitar'}{' '}
              el potrero{' '}
              <strong className="text-[#1E1E1E] dark:text-gray-100">
                "{safeText(selectedPotrero.name)}"
              </strong>
              ?
              {normalizeIsActive(selectedPotrero.is_active)
                ? ' Al inhabilitarlo, no podrá seleccionarse para nuevos lotes ni albergar animales.'
                : ' El potrero volverá a estar disponible inmediatamente para la asignación de lotes.'}
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
                  normalizeIsActive(selectedPotrero.is_active) ? 'danger' : 'accent'
                }
                size="sm"
                disabled={isSubmitting}
                onClick={handleToggleStatus}
              >
                {isSubmitting
                  ? 'Actualizando...'
                  : normalizeIsActive(selectedPotrero.is_active)
                  ? 'Confirmar Inhabilitación'
                  : 'Confirmar Habilitación'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
      {/* 10. Modal: Confirmación de Eliminación de Potrero */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Eliminar Potrero"
      >
        {selectedPotrero && (
          <div className="space-y-4 text-xs">
            <div className="p-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-red-800 dark:text-red-200">
                  ¿Estás seguro de que deseas eliminar este potrero?
                </p>
                <p className="text-red-700 dark:text-red-300 mt-1 leading-relaxed">
                  Esta acción es <strong>irreversible</strong>. El potrero{' '}
                  <strong>"{safeText(selectedPotrero.name)}"</strong> se eliminará
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

      {/* 11. Modal: Registrar Tratamiento */}
      <Modal
        isOpen={isTreatmentModalOpen}
        onClose={() => setIsTreatmentModalOpen(false)}
        title="Registrar Tratamiento"
        maxWidth="lg"
      >
        <form
          onSubmit={handleTreatmentSubmit}
          className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs"
        >
          <div>
            <label className="block text-[11px] font-bold text-[#1E1E1E] dark:text-gray-200 uppercase mb-1">
              Tipo de Tratamiento <span className="text-red-500">*</span>
            </label>
            <select
              value={treatmentType}
              onChange={(e) => setTreatmentType(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-[#F9F9F9] dark:bg-[#121816] border border-gray-200 dark:border-[#263632] rounded-xl text-xs focus:ring-2 focus:ring-[#1B4D3E] cursor-pointer text-gray-900 dark:text-gray-100"
            >
              {TREATMENT_TYPE_OPTIONS.map((option) => (
                <option key={`treat-type-${option.value}`} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-[#1E1E1E] dark:text-gray-200 uppercase mb-1">
              Fecha de Aplicación <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={treatmentAppliedAt}
              onChange={(e) => setTreatmentAppliedAt(e.target.value)}
              required
              className="w-full px-3.5 py-2.5 bg-[#F9F9F9] dark:bg-[#121816] border border-gray-200 dark:border-[#263632] rounded-xl text-xs focus:ring-2 focus:ring-[#1B4D3E] text-gray-900 dark:text-gray-100"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-[#1E1E1E] dark:text-gray-200 uppercase mb-1">
              Producto
            </label>
            <input
              type="text"
              value={treatmentProduct}
              onChange={(e) => setTreatmentProduct(e.target.value)}
              placeholder="Ej. Urea 46%"
              className="w-full px-3.5 py-2.5 bg-[#F9F9F9] dark:bg-[#121816] border border-gray-200 dark:border-[#263632] rounded-xl text-xs focus:ring-2 focus:ring-[#1B4D3E] text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-[#1E1E1E] dark:text-gray-200 uppercase mb-1">
              Dosis
            </label>
            <div className="flex gap-2">
              <NumberInput
                min="0"
                step="0.01"
                value={treatmentDose}
                onChange={(e) => setTreatmentDose(e.target.value)}
                placeholder="Ej. 150"
                className="flex-1 px-3.5 py-2.5 bg-[#F9F9F9] dark:bg-[#121816] border border-gray-200 dark:border-[#263632] rounded-xl text-xs focus:ring-2 focus:ring-[#1B4D3E] text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
              />
              <select
                value={treatmentDoseUnit}
                onChange={(e) => setTreatmentDoseUnit(e.target.value)}
                className="w-24 px-2 py-2.5 bg-[#F9F9F9] dark:bg-[#121816] border border-gray-200 dark:border-[#263632] rounded-xl text-xs focus:ring-2 focus:ring-[#1B4D3E] cursor-pointer text-gray-900 dark:text-gray-100"
              >
                {DOSE_UNIT_OPTIONS.map((unit) => (
                  <option key={`dose-unit-${unit}`} value={unit}>
                    {unit}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-[#1E1E1E] dark:text-gray-200 uppercase mb-1">
              Costo (USD)
            </label>
            <NumberInput
              min="0"
              step="0.01"
              value={treatmentCost}
              onChange={(e) => setTreatmentCost(e.target.value)}
              placeholder="Ej. 480.50"
              className="w-full px-3.5 py-2.5 bg-[#F9F9F9] dark:bg-[#121816] border border-gray-200 dark:border-[#263632] rounded-xl text-xs focus:ring-2 focus:ring-[#1B4D3E] text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-[11px] font-bold text-[#1E1E1E] dark:text-gray-200 uppercase mb-1">
              Notas
            </label>
            <textarea
              rows={2}
              value={treatmentNotes}
              onChange={(e) => setTreatmentNotes(e.target.value)}
              placeholder="Observaciones de la aplicación..."
              className="w-full px-3.5 py-2.5 bg-[#F9F9F9] dark:bg-[#121816] border border-gray-200 dark:border-[#263632] rounded-xl text-xs focus:ring-2 focus:ring-[#1B4D3E] text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 resize-none"
            />
          </div>

          <div className="md:col-span-2 pt-3 border-t border-gray-100 dark:border-[#263632] flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsTreatmentModalOpen(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" variant="primary" size="sm" disabled={isSubmittingManagement}>
              {isSubmittingManagement ? 'Registrando...' : 'Registrar Tratamiento'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* 12. Modal: Registrar Aforo de Forraje */}
      <Modal
        isOpen={isSurveyModalOpen}
        onClose={() => setIsSurveyModalOpen(false)}
        title="Registrar Aforo de Forraje"
        maxWidth="lg"
      >
        <form
          onSubmit={handleSurveySubmit}
          className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs"
        >
          <div>
            <label className="block text-[11px] font-bold text-[#1E1E1E] dark:text-gray-200 uppercase mb-1">
              Fecha del Aforo <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={surveyDate}
              onChange={(e) => setSurveyDate(e.target.value)}
              required
              className="w-full px-3.5 py-2.5 bg-[#F9F9F9] dark:bg-[#121816] border border-gray-200 dark:border-[#263632] rounded-xl text-xs focus:ring-2 focus:ring-[#1B4D3E] text-gray-900 dark:text-gray-100"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-[#1E1E1E] dark:text-gray-200 uppercase mb-1">
              Forraje Disponible (kg MS/ha)
            </label>
            <NumberInput
              min="0"
              step="0.01"
              value={surveyBiomass}
              onChange={(e) => setSurveyBiomass(e.target.value)}
              placeholder="Ej. 3100"
              className="w-full px-3.5 py-2.5 bg-[#F9F9F9] dark:bg-[#121816] border border-gray-200 dark:border-[#263632] rounded-xl text-xs focus:ring-2 focus:ring-[#1B4D3E] text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-[#1E1E1E] dark:text-gray-200 uppercase mb-1">
              Altura de Entrada (cm)
            </label>
            <NumberInput
              min="0"
              step="0.01"
              value={surveyEntryHeight}
              onChange={(e) => setSurveyEntryHeight(e.target.value)}
              placeholder="Ej. 28.5"
              className="w-full px-3.5 py-2.5 bg-[#F9F9F9] dark:bg-[#121816] border border-gray-200 dark:border-[#263632] rounded-xl text-xs focus:ring-2 focus:ring-[#1B4D3E] text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-[#1E1E1E] dark:text-gray-200 uppercase mb-1">
              Altura de Salida (cm)
            </label>
            <NumberInput
              min="0"
              step="0.01"
              value={surveyExitHeight}
              onChange={(e) => setSurveyExitHeight(e.target.value)}
              placeholder="Ej. 12"
              className="w-full px-3.5 py-2.5 bg-[#F9F9F9] dark:bg-[#121816] border border-gray-200 dark:border-[#263632] rounded-xl text-xs focus:ring-2 focus:ring-[#1B4D3E] text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-[11px] font-bold text-[#1E1E1E] dark:text-gray-200 uppercase mb-1">
              Notas
            </label>
            <textarea
              rows={2}
              value={surveyNotes}
              onChange={(e) => setSurveyNotes(e.target.value)}
              placeholder="Observaciones del muestreo..."
              className="w-full px-3.5 py-2.5 bg-[#F9F9F9] dark:bg-[#121816] border border-gray-200 dark:border-[#263632] rounded-xl text-xs focus:ring-2 focus:ring-[#1B4D3E] text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 resize-none"
            />
          </div>

          <div className="md:col-span-2 pt-3 border-t border-gray-100 dark:border-[#263632] flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsSurveyModalOpen(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" variant="primary" size="sm" disabled={isSubmittingManagement}>
              {isSubmittingManagement ? 'Registrando...' : 'Registrar Aforo'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* 13. Modal: Confirmación de Eliminación de Registro de Manejo */}
      <Modal
        isOpen={managementDeleteTarget !== null}
        onClose={() => setManagementDeleteTarget(null)}
        title={
          managementDeleteTarget?.kind === 'survey' ? 'Eliminar Aforo' : 'Eliminar Tratamiento'
        }
      >
        {managementDeleteTarget && (
          <div className="space-y-4 text-xs">
            <div className="p-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-red-800 dark:text-red-200">
                  ¿Eliminar este registro de manejo?
                </p>
                <p className="text-red-700 dark:text-red-300 mt-1 leading-relaxed">
                  Esta acción es <strong>irreversible</strong> y borrará el{' '}
                  {managementDeleteTarget.kind === 'survey'
                    ? 'aforo de forraje'
                    : 'tratamiento'}{' '}
                  del historial del potrero.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setManagementDeleteTarget(null)}
                disabled={isSubmittingManagement}
              >
                Cancelar
              </Button>
              <Button
                variant="danger"
                size="sm"
                disabled={isSubmittingManagement}
                onClick={handleConfirmManagementDelete}
                icon={<Trash2 className="w-3.5 h-3.5" />}
              >
                {isSubmittingManagement ? 'Eliminando...' : 'Sí, Eliminar'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default PotrerosView;
