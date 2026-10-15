import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { lotService } from '../services/lotService';
import { barnService } from '../services/barnService';
import { farmService } from '../services/farmService';
import type {
  Lot,
  LotStats,
  LoteAnimal,
  AnimalService,
  CreateLoteAnimalDTO,
  UpdateLoteAnimalDTO,
  Barn,
  Farm,
} from '../types/auth';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { normalizeIsActive } from '../components/ui/StatusBadge';
import { Modal } from '../components/ui/Modal';
import { safeText } from '../utils/safeText';
import {
  Boxes,
  Plus,
  Search,
  Eye,
  Edit2,
  Trash2,
  RefreshCw,
  PackageCheck,
  Egg,
  PiggyBank,
  RotateCcw,
  Building2,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  Tag,
  Activity,
  Skull,
  HeartPulse,
  History,
  Weight,
  DollarSign,
  Calendar,
  Warehouse,
  Layers,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/* Helpers de normalización sectorial (sin tildes, minúsculas)         */
/* ------------------------------------------------------------------ */

const normalizeKey = (raw?: string | null): string =>
  (raw || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();

const isEggPurpose = (purpose?: string | null): boolean =>
  normalizeKey(purpose) === 'huevos';

const isReproductionPurpose = (purpose?: string | null): boolean =>
  normalizeKey(purpose) === 'reproduccion';

// Cerdas en gestación. OJO: normalizeKey quita los acentos,
// por lo que la clave normalizada es "gestacion" (sin tilde).
const isGestatingAnimal = (status?: string | null): boolean =>
  normalizeKey(status) === 'gestacion';

const isPorcinoSector = (sector?: string | null): boolean =>
  normalizeKey(sector).startsWith('porcin');

const ANIMAL_STATUS_LABELS: Record<string, string> = {
  activo: 'Activo',
  'gestación': 'Gestación',
  destete: 'Destete',
  cosechado: 'Cosechado',
  vendido: 'Vendido',
  descartado: 'Descartado',
  muerto: 'Muerto',
};

// Estados en los que el animal ya NO cuenta dentro de la producción del lote
// (coinciden con ANIMAL_OUT_OF_PRODUCTION_STATUSES del backend)
const OUT_PRODUCTION_STATUSES = new Set(['muerto', 'cosechado', 'vendido', 'descartado']);

const isAnimalInProduction = (status?: string | null): boolean =>
  !OUT_PRODUCTION_STATUSES.has(normalizeKey(status));

/**
 * Cabeza de cerdito / lechón (SVG en estilo Lucide: trazo de 2px,
 * puntas redondeadas). La librería Lucide no incluye un icono de
 * cerdo, así que se define localmente para la acción de
 * "Registrar Destete / Parto".
 */
const PigletHead = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    {/* Orejas */}
    <path d="M8.5 3.5 7 7" />
    <path d="M15.5 3.5 17 7" />
    {/* Cabeza */}
    <path d="M12 5.5c-3.6 0-6.5 2.9-6.5 6.5 0 2.2 1.2 4.1 3 5.3.3.2.5.6.5 1 0 1.3.9 2.2 2 2.2s2-.9 2-2.2c0-.4.2-.8.5-1 1.8-1.2 3-3.1 3-5.3 0-3.6-2.9-6.5-6.5-6.5Z" />
    {/* Ojos */}
    <path d="M9.6 10.3h.01" />
    <path d="M14.4 10.3h.01" />
    {/* Hocico */}
    <ellipse cx="12" cy="15.3" rx="2.7" ry="1.9" />
    <path d="M10.9 15.3h2.2" />
  </svg>
);

/** Insignia de estado del animal (colores por estado, sin tildes). */
const animalStatusClasses = (status?: string | null): string => {
  const key = normalizeKey(status);
  if (key === 'muerto') return 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300';
  if (key === 'cosechado') return 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300';
  if (key === 'vendido') return 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300';
  if (key === 'descartado') return 'bg-gray-300 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
  if (key === 'gestacion') return 'bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300';
  if (key === 'destete') return 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300';
  return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300';
};

/** Campo informativo de la ficha técnica (etiqueta + valor). */
const InfoField = ({ label, value }: { label: string; value?: string | number | null }) => (
  <div className="p-2 rounded-lg bg-white dark:bg-[#18221F] border border-gray-100 dark:border-[#263632]">
    <span className="block text-[9px] text-gray-400 uppercase font-bold tracking-wide">{label}</span>
    <span className="font-semibold text-[11px] text-[#1E1E1E] dark:text-gray-200">
      {value === null || value === undefined || value === '' ? '—' : safeText(String(value))}
    </span>
  </div>
);

/** Formatea fechas ISO del backend a es-ES (o null si no aplica). */
const formatDate = (value?: string | null): string | null => {
  if (!value) return null;
  const d = new Date(value);
  if (isNaN(d.getTime())) return value;
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const capitalize = (value?: string | null): string | null =>
  value ? value.charAt(0).toUpperCase() + value.slice(1) : null;

const formatDecimal = (
  value?: string | number | null,
  digits = 2
): string => {
  if (value === null || value === undefined || value === '') return '—';
  const num = Number(value);
  if (Number.isNaN(num)) return '—';
  return num.toLocaleString('es-ES', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
};

/**
 * Suma N días a una fecha en formato YYYY-MM-DD operando en fecha
 * local (sin toISOString) para evitar el off-by-one por zona horaria.
 */
const addDays = (dateStr: string, days: number): string => {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  if (!y || !m || !d) return '';
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + days);
  const yy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
};

const nextLotCode = (lots: Lot[]): string => {
  let max = 0;
  lots.forEach((lot) => {
    const m = /^LOT-(\d+)$/.exec(String(lot.code || ''));
    if (m) max = Math.max(max, parseInt(m[1], 10));
  });
  return `LOT-${String(max + 1).padStart(5, '0')}`;
};

interface AnimalFormState {
  /** Identificador estable del formulario (NUNCA se usa el índice como key). */
  formKey: string;
  breed: string;
  father_breed: string;
  mother_breed: string;
  gender: 'hembra' | 'macho';
  birth_date: string;
  parity_count: string;
  teats_count: string;
  avg_piglets_per_birth: string;
}

// Secuencia monotónica para dar a cada formulario individual una key única y estable
let animalFormSeq = 0;

const emptyAnimalForm = (): AnimalFormState => ({
  formKey: `animal-form-${(animalFormSeq += 1)}`,
  breed: '',
  father_breed: '',
  mother_breed: '',
  gender: 'hembra',
  birth_date: '',
  parity_count: '',
  teats_count: '',
  avg_piglets_per_birth: '',
});

// Límite de formularios individuales desplegados en el modal de creación
// (lotes de reproducción son pequeños; el resto se registra desde "Animales")
const MAX_ANIMAL_FORMS = 100;

export const LotesView: React.FC = () => {
  const { user, activeFarm, farms: authFarms } = useAuth();
  const { toastSuccess, toastError } = useToast();

  const roleUpper = (user?.role || '').toUpperCase();
  const isRoot = roleUpper === 'ROOT';

  /* ------------------------------ Estado ------------------------------ */
  const [lotsList, setLotsList] = useState<Lot[]>([]);
  const [barnsList, setBarnsList] = useState<Barn[]>([]);
  const [farmsList, setFarmsList] = useState<Farm[]>(() =>
    Array.isArray(authFarms) ? authFarms : []
  );
  const [stats, setStats] = useState<LotStats>({
    total_lotes: 0,
    active_lotes: 0,
    inactive_lotes: 0,
    total_animals: 0,
    total_lote_animals: 0,
    in_production_animals: 0,
  });

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  /* ----------------------------- Filtros ------------------------------ */
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'activo' | 'inactivo'>('all');
  const [purposeFilter, setPurposeFilter] = useState<string>('all');
  const [selectedRootFarmId, setSelectedRootFarmId] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 8;

  /* ----------------------------- Modales ------------------------------ */
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isHarvestModalOpen, setIsHarvestModalOpen] = useState(false);
  const [isEggsModalOpen, setIsEggsModalOpen] = useState(false);
  const [isAnimalsModalOpen, setIsAnimalsModalOpen] = useState(false);
  const [isAnimalEditModalOpen, setIsAnimalEditModalOpen] = useState(false);
  const [isAnimalSaleModalOpen, setIsAnimalSaleModalOpen] = useState(false);
  const [isMortalityModalOpen, setIsMortalityModalOpen] = useState(false);
  const [isServiceModalOpen, setIsServiceModalOpen] = useState(false);
  const [isServiceHistoryOpen, setIsServiceHistoryOpen] = useState(false);

  const [selectedLot, setSelectedLot] = useState<Lot | null>(null);
  const [selectedAnimal, setSelectedAnimal] = useState<LoteAnimal | null>(null);
  const [lotAnimals, setLotAnimals] = useState<LoteAnimal[]>([]);
  const [isLoadingAnimals, setIsLoadingAnimals] = useState(false);
  // Secuencia de peticiones de animales (evita que respuestas fuera de orden
  // sobrescriban la lista de otro lote)
  const animalsReqSeqRef = useRef(0);
  const [animalServices, setAnimalServices] = useState<AnimalService[]>([]);
  // Alerta de lechones destetados pendientes. El estado PERSISTE
  // en backend (`animal_services.pending_piglets`): al abrir el
  // lote se consulta GET /lots/{id}/weaned-pending, por lo que la
  // alerta sobrevive a un refresco de página y solo desaparece
  // cuando se crea el lote de lechones vinculado.
  const [weanedSuggestion, setWeanedSuggestion] = useState<{
    piglets: number;
    lot: Lot;
    serviceIds: number[];
  } | null>(null);
  // Destetes vinculados al próximo lote de lechones a crear
  const [weanedSourceIds, setWeanedSourceIds] = useState<number[]>([]);
  // Ficha técnica del lote (vista PURAMENTE INFORMATIVA de animales,
  // sin acciones operativas)
  const [isTechSheetOpen, setIsTechSheetOpen] = useState(false);
  const [techSheetAnimals, setTechSheetAnimals] = useState<LoteAnimal[]>([]);
  const [isLoadingTechSheet, setIsLoadingTechSheet] = useState(false);
  const techSheetReqSeqRef = useRef(0);
  // Modal de selección de galpón para lechones destetados
  const [barnSelectionOpen, setBarnSelectionOpen] = useState(false);
  const [selectedBarnForWeaned, setSelectedBarnForWeaned] = useState<number | null>(null);
  // Galpones de la granja con capacidad libre >= lechones pendientes
  const weanedAvailableBarns = useMemo(() => {
    if (!weanedSuggestion) return [];
    return barnsList.filter((b) => {
      const free = Number((b as any).available_capacity) || Math.max(0, Number(b.max_capacity || 0) - Number((b as any).occupied_capacity || 0));
      return free >= weanedSuggestion.piglets;
    });
  }, [barnsList, weanedSuggestion]);

  /* --------------------- Formulario: Crear Lote --------------------- */
  const [formGalponId, setFormGalponId] = useState<string>('');
  const [formSpeciesId, setFormSpeciesId] = useState<string>('');
  const [formQuantity, setFormQuantity] = useState<string>('');
  const [formFarmId, setFormFarmId] = useState<string>('');
  const [animalForms, setAnimalForms] = useState<AnimalFormState[]>([]);

  /* --------------------- Formulario: Editar Lote -------------------- */
  const [editQuantity, setEditQuantity] = useState<string>('');
  const [editPurpose, setEditPurpose] = useState<string>('');
  const [editStatus, setEditStatus] = useState<string>('activo');

  /* --------------------- Formulario: Cosecha ------------------------ */
  const [harvestAvgWeight, setHarvestAvgWeight] = useState<string>('');
  const [harvestPricePerKg, setHarvestPricePerKg] = useState<string>('');
  const [harvestDate, setHarvestDate] = useState<string>('');
  const [harvestQuantity, setHarvestQuantity] = useState<string>('');

  /* --------------------- Formulario: Huevos ------------------------- */
  const [eggsTotal, setEggsTotal] = useState<string>('');
  const [eggsBroken, setEggsBroken] = useState<string>('0');
  const [eggsPrice, setEggsPrice] = useState<string>('');

  /* --------------------- Formulario: Animal ------------------------- */
  const [animalEditForm, setAnimalEditForm] = useState<AnimalFormState>(emptyAnimalForm());
  const [saleWeight, setSaleWeight] = useState<string>('');
  const [salePricePerKg, setSalePricePerKg] = useState<string>('');

  /* --------------------- Formulario: Servicio ----------------------- */
  // Modo del modal: 'servicio' (inseminación / monta) o
  // 'destete' (parto de una cerda en gestación).
  const [serviceMode, setServiceMode] = useState<'servicio' | 'destete'>('servicio');
  const [serviceType, setServiceType] = useState<'inseminación' | 'monta'>('inseminación');
  const [serviceDate, setServiceDate] = useState<string>('');
  const [totalPiglets, setTotalPiglets] = useState<string>('');
  const [livePiglets, setLivePiglets] = useState<string>('');

  // Fecha probable de parto: período de gestación de la cerda = 114 días.
  // La Fecha del Servicio es el único punto de partida (la fecha de
  // gestación se unificó con ella), por lo que el parto se calcula
  // reactivamente como servicio + 114 días y es de solo lectura.
  const GESTATION_DAYS = 114;
  const probableBirthDate = useMemo(
    () => addDays(serviceDate, GESTATION_DAYS),
    [serviceDate]
  );

  /* --------------------- Farm scope ---------------------------------- */
  const effectiveFarmId = useMemo(() => {
    if (isRoot) {
      return selectedRootFarmId && selectedRootFarmId !== 'all'
        ? selectedRootFarmId
        : undefined;
    }
    return (
      activeFarm?.id ||
      user?.farm_id ||
      (user?.farm && user.farm.id) ||
      user?.farmId ||
      undefined
    );
  }, [isRoot, selectedRootFarmId, activeFarm, user]);

  // Granjas disponibles para Root
  useEffect(() => {
    if (isRoot) {
      farmService
        .getFarmsSelect()
        .then((data) => {
          if (Array.isArray(data) && data.length > 0) setFarmsList(data);
        })
        .catch(() => null);
    }
  }, [isRoot]);

  // Carga principal: lotes + galpones (con cupos) + stats
  const loadData = useCallback(
    async (silent = false) => {
      if (!silent) setIsLoading(true);
      setErrorMessage(null);
      try {
        const [lotsRes, barnsRes, statsRes] = await Promise.all([
          lotService.getAll({ farm_id: effectiveFarmId }),
          barnService.getAll({ farm_id: effectiveFarmId }).catch(() => ({ data: [] })),
          lotService.getStats(effectiveFarmId).catch(() => null),
        ]);

        const rows = Array.isArray(lotsRes?.data) ? lotsRes.data : [];
        setLotsList(rows);
        setStats(lotsRes?.stats ?? statsRes ?? {
          total_lotes: rows.length,
          active_lotes: rows.filter((l) => l.status === 'activo').length,
          inactive_lotes: rows.filter((l) => l.status === 'inactivo').length,
          total_animals: rows.reduce((acc, l) => acc + Number((l.current_occupancy ?? l.quantity) || 0), 0),
          total_lote_animals: 0,
          in_production_animals: rows.reduce((acc, l) => acc + Number((l.current_occupancy ?? l.quantity) || 0), 0),
        });

        const barnRows = Array.isArray((barnsRes as any)?.data)
          ? (barnsRes as any).data
          : [];
        setBarnsList(barnRows);
      } catch (err: any) {
        console.error('Error al cargar lotes:', err);
        const msg =
          err.response?.data?.message || 'Error al cargar los lotes de la granja.';
        setErrorMessage(msg);
        toastError('Error al Cargar', msg);
      } finally {
        if (!silent) setIsLoading(false);
      }
    },
    [effectiveFarmId, toastError]
  );

  useEffect(() => {
    loadData();
  }, [loadData]);

  /* ------------------------- Cálculos reactivos ---------------------- */

  // Código autogenerado vista previa (el definitivo lo asigna el backend)
  const previewCode = useMemo(() => nextLotCode(lotsList), [lotsList]);

  // Galpón seleccionado en el formulario de creación
  const selectedBarn = useMemo(
    () => barnsList.find((b) => String(b.id) === String(formGalponId)) || null,
    [barnsList, formGalponId]
  );

  const availableCapacity = useMemo(() => {
    if (!selectedBarn) return 0;
    if (typeof (selectedBarn as any).available_capacity === 'number') {
      return (selectedBarn as any).available_capacity;
    }
    const occupied = Number((selectedBarn as any).occupied_capacity || 0);
    return Math.max(0, Number(selectedBarn.max_capacity || 0) - occupied);
  }, [selectedBarn]);

  // Solo galpones activos con cupos disponibles pueden recibir lotes
  const barnsWithCapacity = useMemo(
    () =>
      barnsList.filter(
        (b) =>
          normalizeIsActive(b.is_active) &&
          (typeof (b as any).available_capacity === 'number'
            ? (b as any).available_capacity > 0
            : Number(b.max_capacity || 0) -
                Number((b as any).occupied_capacity || 0) >
              0)
      ),
    [barnsList]
  );

  const formSector = useMemo(
    () => selectedBarn?.sector || selectedBarn?.category || selectedBarn?.species?.category || '',
    [selectedBarn]
  );
  const formPurpose = useMemo(() => selectedBarn?.purpose || '', [selectedBarn]);

  const quantityNum = useMemo(() => {
    const n = parseInt(formQuantity, 10);
    return Number.isNaN(n) ? 0 : n;
  }, [formQuantity]);

  const quantityError = useMemo(() => {
    if (!formGalponId) return '';
    if (quantityNum <= 0) return 'Ingrese una cantidad válida de animales.';
    if (quantityNum > availableCapacity) {
      return `Supera los ${availableCapacity} cupos disponibles de este galpón.`;
    }
    return '';
  }, [formGalponId, quantityNum, availableCapacity]);

  // Lote porcino de reproducción → formularios individuales por animal
  const isReproductionForm = useMemo(
    () => isPorcinoSector(formSector) && isReproductionPurpose(formPurpose),
    [formSector, formPurpose]
  );

  const shownAnimalForms = useMemo(() => {
    if (!isReproductionForm || quantityNum <= 0) return 0;
    return Math.min(quantityNum, MAX_ANIMAL_FORMS);
  }, [isReproductionForm, quantityNum]);

  // Sincroniza la cantidad de formularios individuales con la cantidad ingresada
  useEffect(() => {
    if (isReproductionForm) {
      setAnimalForms((prev) => {
        if (prev.length === shownAnimalForms) return prev;
        if (prev.length < shownAnimalForms) {
          return [...prev, ...Array.from({ length: shownAnimalForms - prev.length }, emptyAnimalForm)];
        }
        return prev.slice(0, shownAnimalForms);
      });
    } else {
      setAnimalForms([]);
    }
  }, [isReproductionForm, shownAnimalForms]);

  // Filtrado y paginación en memoria
  const filteredLots = useMemo(() => {
    return lotsList.filter((lot) => {
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const haystack = [
          lot.code,
          lot.sector,
          lot.purpose,
          lot.galpon?.name,
          lot.species?.name,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (statusFilter !== 'all' && lot.status !== statusFilter) return false;
      if (purposeFilter !== 'all' && normalizeKey(lot.purpose) !== normalizeKey(purposeFilter)) {
        return false;
      }
      return true;
    });
  }, [lotsList, searchTerm, statusFilter, purposeFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredLots.length / pageSize));
  const paginatedLots = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredLots.slice(start, start + pageSize);
  }, [filteredLots, currentPage, pageSize]);

  // Evita quedarse en página vacía
  useEffect(() => {
    if (currentPage > 1 && filteredLots.length > 0 && paginatedLots.length === 0) {
      setCurrentPage((prev) => Math.max(1, prev - 1));
    }
  }, [currentPage, filteredLots.length, paginatedLots.length]);

  // Cupo ocupado por galpón, derivado de los lotes visibles
  // (animales activos + en gestación). Se recalcula al
  // instante tras cualquier cambio en la tabla principal.
  const occupiedByBarnId = useMemo(() => {
    const map = new Map<string, number>();
    lotsList.forEach((l) => {
      const key = String(l.galpon_id ?? '');
      if (!key || key === 'null' || key === 'undefined') return;
      const occ = Number(l.current_occupancy ?? l.quantity ?? 0);
      if (!Number.isFinite(occ) || occ <= 0) return;
      map.set(key, (map.get(key) ?? 0) + occ);
    });
    return map;
  }, [lotsList]);

  // Cupo ocupado de un lote (para la tabla)
  const barnCapacityOf = useCallback(
    (lot: Lot) => {
      const key = String(lot.galpon_id ?? '');
      const barn: any = barnsList.find((b) => String(b.id) === key) ?? lot.galpon ?? null;
      if (!barn) return null;
      const occupied =
        occupiedByBarnId.get(key) ??
        (typeof barn.occupied_capacity === 'number'
          ? barn.occupied_capacity
          : Math.max(
              0,
              Number(barn.max_capacity || 0) - Math.max(0, Number(barn.available_capacity || 0))
            ));
      return { occupied, capacity: Number(barn.max_capacity || 0) };
    },
    [barnsList, occupiedByBarnId]
  );

  /* ------------------------------ Handlers --------------------------- */

  const openCreateModal = () => {
    setFormGalponId('');
    setFormSpeciesId('');
    setFormQuantity('');
    setFormFarmId(isRoot ? (selectedRootFarmId && selectedRootFarmId !== 'all' ? selectedRootFarmId : '') : '');
    setAnimalForms([]);
    // Un lote manual no consume los destetes pendientes
    setWeanedSourceIds([]);
    setErrorMessage(null);
    setIsCreateModalOpen(true);
  };

  const handleBarnChange = (barnId: string) => {
    setFormGalponId(barnId);
    const barn = barnsList.find((b) => String(b.id) === String(barnId));
    if (barn) {
      setFormSpeciesId(String(barn.species_id));
    } else {
      setFormSpeciesId('');
    }
    setFormQuantity('');
    setAnimalForms([]);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formGalponId) {
      setErrorMessage('Debe seleccionar un galpón con cupos disponibles.');
      return;
    }
    if (quantityError) {
      setErrorMessage(quantityError);
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const payloadFarmId = isRoot
        ? formFarmId && formFarmId !== 'all'
          ? formFarmId
          : selectedRootFarmId && selectedRootFarmId !== 'all'
          ? selectedRootFarmId
          : undefined
        : effectiveFarmId;

      const created = await lotService.create({
        galpon_id: Number(formGalponId),
        species_id: Number(formSpeciesId),
        quantity: quantityNum,
        purpose: formPurpose || undefined,
        farm_id: payloadFarmId,
        // Lote de lechones destetados: vincula los destetes
        // pendientes (el backend valida la cantidad exacta de
        // vivos y los marca como resueltos en BD)
        ...(weanedSourceIds.length > 0 ? { from_service_ids: weanedSourceIds } : {}),
      });

      // Registro de animales individuales (porcinos de reproducción)
      if (isReproductionForm && animalForms.length > 0) {
        for (const af of animalForms) {
          const payload: CreateLoteAnimalDTO = {
            gender: af.gender,
            breed: af.breed.trim() || undefined,
            father_breed: af.father_breed.trim() || undefined,
            mother_breed: af.mother_breed.trim() || undefined,
            birth_date: af.birth_date || undefined,
          };
          if (af.gender === 'hembra') {
            const parity = parseInt(af.parity_count, 10);
            const teats = parseInt(af.teats_count, 10);
            const avg = parseFloat(af.avg_piglets_per_birth);
            if (!Number.isNaN(parity)) payload.parity_count = parity;
            if (!Number.isNaN(teats)) payload.teats_count = teats;
            if (!Number.isNaN(avg)) payload.avg_piglets_per_birth = avg;
          }
          try {
            await lotService.createAnimal(created.id, payload);
          } catch (animalErr: any) {
            console.warn('No se pudo registrar un animal individual:', animalErr);
          }
        }
      }

      setIsCreateModalOpen(false);
      // Lote de lechones creado con éxito: los destetes quedan
      // resueltos en backend y la alerta de pendientes desaparece
      setWeanedSuggestion(null);
      setWeanedSourceIds([]);
      setSuccessMessage(`Lote ${created.code} registrado correctamente.`);
      toastSuccess(
        'Registro Exitoso',
        `El lote "${created.code}" fue creado en el galpón "${safeText(created.galpon?.name || '')}".` +
          (isReproductionForm && quantityNum > MAX_ANIMAL_FORMS
            ? ` Se registraron los primeros ${MAX_ANIMAL_FORMS} animales; registre el resto desde "Animales".`
            : '')
      );
      loadData(true);
    } catch (err: any) {
      console.error('Error al registrar lote:', err);
      const msg =
        err.response?.data?.message ||
        err.response?.data?.errors?.from_service_ids?.[0] ||
        err.response?.data?.errors?.galpon_id?.[0] ||
        err.response?.data?.errors?.quantity?.[0] ||
        err.response?.data?.errors?.species_id?.[0] ||
        'No se pudo registrar el lote. Verifique los datos.';
      setErrorMessage(msg);
      toastError('Error al Guardar', msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Editar lote
  const openEditModal = (lot: Lot) => {
    setSelectedLot(lot);
    setEditQuantity(String(lot.quantity || 0));
    setEditPurpose(lot.purpose || '');
    setEditStatus(lot.status === 'inactivo' ? 'inactivo' : 'activo');
    setErrorMessage(null);
    setIsEditModalOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLot) return;
    const qty = parseInt(editQuantity, 10);
    if (Number.isNaN(qty) || qty <= 0) {
      setErrorMessage('La cantidad debe ser mayor a 0 animales.');
      return;
    }
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const updated = await lotService.update(selectedLot.id, {
        quantity: qty,
        purpose: editPurpose.trim() || undefined,
        status: editStatus as 'activo' | 'inactivo',
      });
      setLotsList((prev) => prev.map((l) => (l.id === updated.id ? { ...l, ...updated } : l)));
      setIsEditModalOpen(false);
      toastSuccess('Actualización Exitosa', `El lote "${updated.code}" fue actualizado.`);
      loadData(true);
    } catch (err: any) {
      const msg =
        err.response?.data?.message ||
        err.response?.data?.errors?.quantity?.[0] ||
        err.response?.data?.errors?.status?.[0] ||
        'No se pudo actualizar el lote.';
      setErrorMessage(msg);
      toastError('Error al Actualizar', msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Eliminar lote
  const openDeleteModal = (lot: Lot) => {
    setSelectedLot(lot);
    setIsDeleteModalOpen(true);
  };

  const handleDelete = async () => {
    if (!selectedLot) return;
    const lotToDelete = selectedLot;
    setIsDeleting(true);
    try {
      await lotService.delete(lotToDelete.id);
      setLotsList((prev) => prev.filter((l) => l.id !== lotToDelete.id));
      setIsDeleteModalOpen(false);
      setSelectedLot(null);
      toastSuccess('Lote Eliminado', `"${lotToDelete.code}" se eliminó de la granja.`);
      loadData(true);
    } catch (err: any) {
      const status = err?.response?.status;
      const serverMsg = err?.response?.data?.message;
      const errs = err?.response?.data?.errors;
      const firstFieldError = errs ? Object.values(errs)[0] : null;
      const detail =
        serverMsg ||
        (Array.isArray(firstFieldError) ? firstFieldError[0] : firstFieldError) ||
        null;
      const msg = detail || 'No se pudo eliminar el lote.';
      setErrorMessage(msg);
      toastError(status === 422 ? 'Eliminación Bloqueada' : 'Error al Eliminar', msg);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleResetFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setPurposeFilter('all');
    setSelectedRootFarmId('');
    setCurrentPage(1);
  };

  /* --------------------- Cosecha (carnes / general) ------------- */
  const openHarvestModal = (lot: Lot) => {
    setSelectedLot(lot);
    setHarvestAvgWeight('');
    setHarvestPricePerKg('');
    setHarvestDate(new Date().toISOString().slice(0, 10));
    setHarvestQuantity(String(lot.quantity || 0));
    setErrorMessage(null);
    setIsHarvestModalOpen(true);
  };

  const harvestTotal = useMemo(() => {
    const w = parseFloat(harvestAvgWeight);
    const p = parseFloat(harvestPricePerKg);
    const q = parseInt(harvestQuantity, 10);
    if (Number.isNaN(w) || Number.isNaN(p) || Number.isNaN(q)) return null;
    return w * p * q;
  }, [harvestAvgWeight, harvestPricePerKg, harvestQuantity]);

  const handleHarvestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLot) return;
    const w = parseFloat(harvestAvgWeight);
    const p = parseFloat(harvestPricePerKg);
    const q = parseInt(harvestQuantity, 10);
    if (Number.isNaN(w) || w < 0) {
      setErrorMessage('Ingrese el peso promedio por animal.');
      return;
    }
    if (Number.isNaN(p) || p < 0) {
      setErrorMessage('Ingrese el precio por kilo.');
      return;
    }
    if (Number.isNaN(q) || q <= 0 || q > Number(selectedLot.quantity || 0)) {
      setErrorMessage(
        `La cantidad a cosechar debe estar entre 1 y ${selectedLot.quantity || 0}.`
      );
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const result = await lotService.harvest(selectedLot.id, {
        avg_weight: w,
        price_per_kg: p,
        quantity: q,
        harvest_date: harvestDate || undefined,
      });
      const updated = result?.data ?? result;
      setLotsList((prev) =>
        prev.map((l) => (l.id === selectedLot.id ? { ...l, ...updated } : l))
      );
      setIsHarvestModalOpen(false);
      toastSuccess(
        'Cosecha Registrada',
        `Lote "${selectedLot.code}" cosechado. Total: ${formatDecimal(updated?.total_price)} — cupo liberado.`
      );
      loadData(true);
    } catch (err: any) {
      const msg =
        err.response?.data?.message ||
        err.response?.data?.errors?.avg_weight?.[0] ||
        err.response?.data?.errors?.price_per_kg?.[0] ||
        'No se pudo registrar la cosecha.';
      setErrorMessage(msg);
      toastError('Error al Cosechar', msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  /* --------------------- Recoger huevos (avícola) ---------------- */
  const openEggsModal = (lot: Lot) => {
    setSelectedLot(lot);
    setEggsTotal('');
    setEggsBroken('0');
    setEggsPrice('');
    setErrorMessage(null);
    setIsEggsModalOpen(true);
  };

  const eggsTotals = useMemo(() => {
    const total = parseInt(eggsTotal, 10);
    const broken = parseInt(eggsBroken, 10);
    const price = parseFloat(eggsPrice);
    if (Number.isNaN(total) || Number.isNaN(price)) return null;
    const b = Number.isNaN(broken) ? 0 : broken;
    return {
      total_egg_cost: total * price,
      total_broken_cost: b * price,
      good_eggs: Math.max(0, total - b),
    };
  }, [eggsTotal, eggsBroken, eggsPrice]);

  const handleEggsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLot) return;
    const total = parseInt(eggsTotal, 10);
    const broken = parseInt(eggsBroken, 10);
    const price = parseFloat(eggsPrice);
    if (Number.isNaN(total) || total < 0) {
      setErrorMessage('Ingrese la cantidad de huevos.');
      return;
    }
    if (Number.isNaN(broken) || broken < 0) {
      setErrorMessage('Ingrese los huevos rotos (0 si no hay).');
      return;
    }
    if (broken > total) {
      setErrorMessage('Los huevos rotos no pueden superar el total.');
      return;
    }
    if (Number.isNaN(price) || price < 0) {
      setErrorMessage('Ingrese el precio unitario por huevo.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const result = await lotService.registerEggs(selectedLot.id, {
        total_eggs: total,
        broken_eggs: broken,
        egg_price: price,
      });
      const updated = result?.data ?? result;
      setLotsList((prev) =>
        prev.map((l) => (l.id === selectedLot.id ? { ...l, ...updated } : l))
      );
      setIsEggsModalOpen(false);
      toastSuccess(
        'Huevos Registrados',
        `Producción acumulada en "${selectedLot.code}". El cupo del galpón se mantiene hasta la cosecha.`
      );
      loadData(true);
    } catch (err: any) {
      const msg =
        err.response?.data?.message ||
        err.response?.data?.errors?.total_eggs?.[0] ||
        err.response?.data?.errors?.broken_eggs?.[0] ||
        'No se pudo registrar la producción de huevos.';
      setErrorMessage(msg);
      toastError('Error al Registrar Huevos', msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  /* --------------------- Animales individuales -------------------- */
  const openAnimalsModal = async (lot: Lot) => {
    const requestId = (animalsReqSeqRef.current += 1);
    setSelectedLot(lot);
    setLotAnimals([]);
    setWeanedSuggestion(null);
    setIsAnimalsModalOpen(true);
    // Lechones destetados pendientes (persistidos en backend: la
    // alerta se restaura aunque se recargue la página)
    lotService
      .getWeanedPending(lot.id)
      .then((pending) => {
        if (pending.pending_piglets > 0) {
          setWeanedSuggestion({
            piglets: pending.pending_piglets,
            lot,
            serviceIds: (pending.services || []).map((s) => Number(s.id)),
          });
        }
      })
      .catch(() => { /* silencioso */ });
    setIsLoadingAnimals(true);
    try {
      const animals = await lotService.getAnimals(lot.id);
      // Guard anti-carrera: solo aplica la respuesta de la última petición
      if (animalsReqSeqRef.current === requestId) {
        // Aplicar ambos estados en el mismo batch para evitar renderizados intermedios
        setLotAnimals(animals);
        setIsLoadingAnimals(false);
      }
    } catch (err: any) {
      if (animalsReqSeqRef.current === requestId) {
        setIsLoadingAnimals(false);
      }
      toastError(
        'Error al Cargar',
        err?.response?.data?.message || 'No se pudieron cargar los animales del lote.'
      );
    }
  };

  // Ficha técnica: vista PURAMENTE INFORMATIVA de los animales del
  // lote (sin botones de acción). Se abre desde "Ver ficha técnica".
  const openTechSheet = async (lot: Lot) => {
    const requestId = (techSheetReqSeqRef.current += 1);
    setSelectedLot(lot);
    setTechSheetAnimals([]);
    setIsTechSheetOpen(true);
    setIsLoadingTechSheet(true);
    try {
      const animals = await lotService.getAnimals(lot.id);
      // Guard anti-carrera: solo aplica la respuesta de la última petición
      if (techSheetReqSeqRef.current === requestId) {
        setTechSheetAnimals(animals);
        setIsLoadingTechSheet(false);
      }
    } catch {
      if (techSheetReqSeqRef.current === requestId) {
        setTechSheetAnimals([]);
        setIsLoadingTechSheet(false);
      }
      toastError(
        'Error al Cargar',
        'No se pudo cargar la ficha técnica del lote.'
      );
    }
  };

  const refreshLotAnimals = useCallback(async (lotId: number | string) => {
    const requestId = (animalsReqSeqRef.current += 1);
    try {
      const animals = await lotService.getAnimals(lotId);
      // Guard anti-carrera: descarta respuestas obsoletas de otros lotes
      if (animalsReqSeqRef.current === requestId) {
        setLotAnimals(animals);
      }
    } catch {
      /* silencioso */
    }
  }, []);

  // Recarga suave de la sub-tabla: conserva las filas actuales en el DOM
  // (keys estables por animal.id) mientras llegan los datos nuevos, sin
  // destruir y recrear el nodo de la tabla en cada refresco.
  const handleRefreshAnimals = useCallback(async () => {
    if (!selectedLot) return;
    setIsLoadingAnimals(true);
    try {
      await refreshLotAnimals(selectedLot.id);
    } finally {
      setIsLoadingAnimals(false);
    }
  }, [selectedLot, refreshLotAnimals]);

  // Edición de animal
  const openAnimalEditModal = (animal: LoteAnimal) => {
    setSelectedAnimal(animal);
    setAnimalEditForm({
      formKey: `animal-edit-${animal.id}`,
      breed: animal.breed || '',
      father_breed: animal.father_breed || '',
      mother_breed: animal.mother_breed || '',
      gender: animal.gender === 'macho' ? 'macho' : 'hembra',
      birth_date: animal.birth_date || '',
      parity_count: String(animal.parity_count || ''),
      teats_count: String(animal.teats_count || ''),
      avg_piglets_per_birth: String(animal.avg_piglets_per_birth || ''),
    });
    setErrorMessage(null);
    setIsAnimalEditModalOpen(true);
  };

  const handleAnimalEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAnimal) return;
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const af = animalEditForm;
      const payload: UpdateLoteAnimalDTO = {
        gender: af.gender,
        breed: af.breed.trim() || undefined,
        father_breed: af.father_breed.trim() || undefined,
        mother_breed: af.mother_breed.trim() || undefined,
        birth_date: af.birth_date || undefined,
      };
      const parity = parseInt(af.parity_count, 10);
      const teats = parseInt(af.teats_count, 10);
      const avg = parseFloat(af.avg_piglets_per_birth);
      if (!Number.isNaN(parity)) payload.parity_count = parity;
      if (!Number.isNaN(teats)) payload.teats_count = teats;
      if (!Number.isNaN(avg)) payload.avg_piglets_per_birth = avg;

      const updated = await lotService.updateAnimal(selectedAnimal.id, payload);
      await refreshLotAnimals(selectedAnimal.lote_id);
      setIsAnimalEditModalOpen(false);
      toastSuccess('Animal Actualizado', `Cerdo ${updated.identifier} editado.`);
    } catch (err: any) {
      const msg =
        err.response?.data?.message ||
        err.response?.data?.errors?.gender?.[0] ||
        'No se pudo actualizar el animal.';
      setErrorMessage(msg);
      toastError('Error al Actualizar', msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Mortalidad
  const openMortalityModal = (animal: LoteAnimal) => {
    setSelectedAnimal(animal);
    setIsMortalityModalOpen(true);
  };

  // Reflejo inmediato del estado del lote en la tabla principal:
  // la respuesta del PUT ya incluye el lote actualizado (con el
  // cierre automático a INACTIVO cuando el último animal sale), así
  // que la insignia gris se muestra al instante, sin esperar al GET.
  const reflectLotStatusFromAnimal = (updated: LoteAnimal | null) => {
    const lot = updated?.lote;
    if (!lot) return;
    setLotsList((prev) =>
      prev.map((l) =>
        String(l.id) === String(lot.id) ? { ...l, status: lot.status } : l
      )
    );
  };

  const handleMortalityConfirm = async () => {
    if (!selectedAnimal) return;
    setIsSubmitting(true);
    try {
      const updated = await lotService.updateAnimal(selectedAnimal.id, { status: 'muerto' });
      // Reflejo inmediato (optimista) con el estado 'muerto' persistido,
      // para que la tabla no quede pintando "Activo" si el GET de refresco
      // posterior falla o llega tarde.
      setLotAnimals((prev) =>
        prev.map((a) => (a.id === updated.id ? { ...a, ...updated } : a))
      );
      // Cierre automático del lote si era el último animal vigente
      reflectLotStatusFromAnimal(updated);
      await refreshLotAnimals(selectedAnimal.lote_id);
      // Refresca cantidad del lote, stats y cupo del galpón (liberado por la baja)
      loadData(true);
      setIsMortalityModalOpen(false);
      toastSuccess(
        'Mortalidad Registrada',
        `El cerdo ${selectedAnimal.identifier} fue dado de baja por mortalidad. Cantidad del lote y cupo del galpón actualizados.`
      );
    } catch (err: any) {
      const msg = err.response?.data?.message || 'No se pudo registrar la mortalidad.';
      toastError('Error al Registrar', msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Cosecha / Venta individual
  const openAnimalSaleModal = (animal: LoteAnimal) => {
    setSelectedAnimal(animal);
    setSaleWeight('');
    setSalePricePerKg('');
    setErrorMessage(null);
    setIsAnimalSaleModalOpen(true);
  };

  const saleTotal = useMemo(() => {
    const w = parseFloat(saleWeight);
    const p = parseFloat(salePricePerKg);
    if (Number.isNaN(w) || Number.isNaN(p)) return null;
    return w * p;
  }, [saleWeight, salePricePerKg]);

  const handleAnimalSaleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAnimal) return;
    const w = parseFloat(saleWeight);
    const p = parseFloat(salePricePerKg);
    if (Number.isNaN(w) || w <= 0) {
      setErrorMessage('Ingrese el peso de venta (kg).');
      return;
    }
    if (Number.isNaN(p) || p < 0) {
      setErrorMessage('Ingrese el precio por kilo.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const updated = await lotService.updateAnimal(selectedAnimal.id, {
        sale_weight: w,
        sale_price_per_kg: p,
        status: 'cosechado',
      });
      // Reflejo inmediato (optimista): la respuesta del PUT ya trae el
      // animal con el estado 'cosechado' persistido en la BD, así que la
      // tabla lo pinta al instante aunque el GET de refresco posterior
      // fallara (catch silencioso) o llegara tarde.
      setLotAnimals((prev) =>
        prev.map((a) => (a.id === updated.id ? { ...a, ...updated } : a))
      );
      // Cierre automático del lote si era el último animal vigente
      reflectLotStatusFromAnimal(updated);
      await refreshLotAnimals(selectedAnimal.lote_id);
      // Refresca cantidad del lote, stats y cupo del galpón (liberado por la venta)
      loadData(true);
      setIsAnimalSaleModalOpen(false);
      toastSuccess(
        'Venta Registrada',
        `Cerdo ${updated.identifier} vendido: ${formatDecimal(updated.sale_total_price)}. Estado "cosechado", cantidad del lote y cupo del galpón actualizados.`
      );
    } catch (err: any) {
      const msg =
        err.response?.data?.message ||
        err.response?.data?.errors?.sale_weight?.[0] ||
        'No se pudo registrar la venta.';
      setErrorMessage(msg);
      toastError('Error al Registrar Venta', msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Servicio reproductivo
  const openServiceModal = (animal: LoteAnimal) => {
    setSelectedAnimal(animal);
    // Regla de ciclo: una cerda en gestación ya no puede
    // recibir otro servicio (inseminación / monta). La
    // acción disponible para ella es Registrar Destete / Parto.
    setServiceMode(
      isGestatingAnimal(animal.status) ? 'destete' : 'servicio'
    );
    setServiceType('inseminación');
    setServiceDate(new Date().toISOString().slice(0, 10));
    setTotalPiglets('');
    setLivePiglets('');
    setErrorMessage(null);
    setIsServiceModalOpen(true);
  };

  const handleServiceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAnimal) return;
    if (!serviceDate) {
      setErrorMessage(
        serviceMode === 'destete'
          ? 'La fecha del parto es obligatoria.'
          : 'La fecha del servicio es obligatoria.'
      );
      return;
    }

    /* -------- Rama: Registro de Destete / Parto -------- */
    if (serviceMode === 'destete') {
      const total = parseInt(totalPiglets, 10);
      const live = parseInt(livePiglets, 10);
      if (Number.isNaN(total) || total <= 0) {
        setErrorMessage('Ingrese el total de lechones.');
        return;
      }
      if (Number.isNaN(live) || live < 0) {
        setErrorMessage('Ingrese la cantidad de lechones vivos.');
        return;
      }
      if (live > total) {
        setErrorMessage(
          'Los lechones vivos no pueden superar el total de lechones.'
        );
        return;
      }

      setIsSubmitting(true);
      setErrorMessage(null);
      try {
        const createdService: any = await lotService.createService(selectedAnimal.id, {
          service_type: 'parto',
          service_date: serviceDate,
          status: 'destete',
          // La fecha del parto es tanto la fecha del evento
          // como la fecha de nacimiento de los lechones.
          birth_date: serviceDate,
          total_piglets: total,
          live_piglets: live,
        });

        // Reflejo inmediato (optimista): al destetar, la
        // cerda vuelve a "Activo" y su contador de partos
        // (parity_count) aumenta en uno.
        setLotAnimals((prev) =>
          prev.map((a) =>
            a.id === selectedAnimal.id
              ? { ...a, status: 'activo', parity_count: Number(a.parity_count || 0) + 1 }
              : a
          )
        );

        // Sugerencia PERSISTIDA: el backend guardó los lechones
        // vivos como pendientes (`pending_piglets`) hasta que se
        // cree el lote de lechones vinculado, por lo que la
        // alerta sobrevive a un refresco de página.
        const pendingPiglets = Number(createdService?.pending_piglets ?? live);
        if (pendingPiglets > 0 && selectedLot) {
          setWeanedSuggestion({
            piglets: pendingPiglets,
            lot: selectedLot,
            serviceIds: [Number(createdService.id)],
          });
        }

        setIsServiceModalOpen(false);
        await refreshLotAnimals(selectedAnimal.lote_id);
        toastSuccess(
          'Destete / Parto Registrado',
          `${live} lechones vivos de ${total} para el cerdo ${selectedAnimal.identifier}.`
        );
      } catch (err: any) {
        const msg =
          err.response?.data?.message ||
          err.response?.data?.errors?.birth_date?.[0] ||
          err.response?.data?.errors?.total_piglets?.[0] ||
          err.response?.data?.errors?.live_piglets?.[0] ||
          'No se pudo registrar el destete/parto.';
        setErrorMessage(msg);
        toastError('Error al Registrar Destete / Parto', msg);
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    /* -------- Rama: Servicio (inseminación / monta) -------- */
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      await lotService.createService(selectedAnimal.id, {
        service_type: serviceType,
        service_date: serviceDate,
        // El servicio reproductivo (inseminación / monta)
        // inicia la gestación de la cerda.
        status: 'gestación',
        // La fecha de gestación se unifica con la fecha del
        // servicio, y la fecha probable de parto = servicio + 114 días.
        pregnancy_date: serviceDate,
        birth_date: probableBirthDate || undefined,
      });

      // Reflejo inmediato (optimista): la cerda pasa a
      // "Gestación", así la insignia de la tabla se
      // actualiza al instante sin esperar al refresco GET.
      setLotAnimals((prev) =>
        prev.map((a) =>
          a.id === selectedAnimal.id ? { ...a, status: 'gestación' } : a
        )
      );

      setIsServiceModalOpen(false);
      await refreshLotAnimals(selectedAnimal.lote_id);
      toastSuccess(
        'Servicio Registrado',
        `${serviceType} registrado para el cerdo ${selectedAnimal.identifier}.`
      );
    } catch (err: any) {
      const msg =
        err.response?.data?.message ||
        err.response?.data?.errors?.service_type?.[0] ||
        err.response?.data?.errors?.service_date?.[0] ||
        err.response?.data?.errors?.pregnancy_date?.[0] ||
        'No se pudo registrar el servicio.';
      setErrorMessage(msg);
      toastError('Error al Registrar Servicio', msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Historial de servicios del animal
  const openServiceHistory = async (animal: LoteAnimal) => {
    setSelectedAnimal(animal);
    setAnimalServices([]);
    setIsServiceHistoryOpen(true);
    try {
      const services = await lotService.getServices(animal.id);
      setAnimalServices(services);
    } catch {
      setAnimalServices([]);
    }
  };

  const handleWeanedNewLot = () => {
    if (!weanedSuggestion) return;
    const { piglets } = weanedSuggestion;

    if (weanedAvailableBarns.length === 0) {
      toastError(
        'Sin Cupo Disponible',
        `No hay galpones con suficientes cupos libres para ${piglets} lechones. Coseche otro lote para liberar cupo o elija otro momento.`
      );
      return;
    }

    // Cierre limpio del modal de animales ANTES de abrir el de
    // selección: nunca deben quedar modales superpuestos
    setIsAnimalsModalOpen(false);
    setSelectedBarnForWeaned(null);
    setBarnSelectionOpen(true);
  };

  // Selección de galpón desde el modal de lechones destetados:
  // precarga el formulario de creación con el galpón elegido y
  // vincula los destetes pendientes al nuevo lote
  const handleWeanedBarnSelect = (barnId: number) => {
    if (!weanedSuggestion) return;
    setBarnSelectionOpen(false);
    setIsAnimalsModalOpen(false);
    setSelectedBarnForWeaned(barnId);
    setFormGalponId(String(barnId));
    const barn = barnsList.find((b) => String(b.id) === String(barnId));
    if (barn?.species_id) {
      setFormSpeciesId(String(barn.species_id));
    }
    setFormQuantity(String(weanedSuggestion.piglets));
    setFormFarmId(isRoot ? (selectedRootFarmId && selectedRootFarmId !== 'all' ? selectedRootFarmId : '') : '');
    setWeanedSourceIds(weanedSuggestion.serviceIds);
    setIsCreateModalOpen(true);
  };

  // __RENDER2__

  return (
    <div className="space-y-6">
      {/* 1. Header con título y acciones */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-gray-200 dark:border-[#263632]">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#1B4D3E]/10 dark:bg-[#4E9F3D]/20 text-[#1B4D3E] dark:text-[#4E9F3D] flex items-center justify-center shrink-0">
              <Boxes className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-black text-[#1E1E1E] dark:text-gray-100 flex items-center gap-2">
                Gestión de Lotes de Producción
                {activeFarm?.name && !isRoot && (
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-[#263632] text-[#1B4D3E] dark:text-[#4E9F3D] font-bold border border-emerald-300 dark:border-emerald-700/50">
                    {safeText(activeFarm.name)}
                  </span>
                )}
              </h1>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Control de cupos, cosechas, producción de huevos y reproducción por lote.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadData()}
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
            Nuevo Lote
          </Button>
        </div>
      </div>

      {/* 2. Resumen superior: 4 tarjetas métricas (targets) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Lotes Totales */}
        <Card key="target-total-lots" className="p-4 bg-white dark:bg-[#18221F] border border-gray-200 dark:border-[#263632]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Lotes Totales
              </p>
              <h3 className="text-2xl font-black text-[#1E1E1E] dark:text-gray-100 mt-0.5">
                {stats.total_lotes}
              </h3>
              <p className="text-[10px] text-gray-400 mt-0.5">Lotes registrados</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-[#1B4D3E]/10 dark:bg-[#4E9F3D]/20 text-[#1B4D3E] dark:text-[#4E9F3D] flex items-center justify-center shrink-0">
              <Boxes className="w-5 h-5" />
            </div>
          </div>
        </Card>

        {/* Lotes Activos */}
        <Card key="target-active-lots" className="p-4 bg-white dark:bg-[#18221F] border border-gray-200 dark:border-[#263632]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                Lotes Activos
              </p>
              <h3 className="text-2xl font-black text-emerald-700 dark:text-emerald-300 mt-0.5">
                {stats.active_lotes}
              </h3>
              <p className="text-[10px] text-gray-400 mt-0.5">En producción</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <Activity className="w-5 h-5" />
            </div>
          </div>
        </Card>

        {/* Animales en Producción */}
        <Card key="target-production-animals" className="p-4 bg-white dark:bg-[#18221F] border border-gray-200 dark:border-[#263632]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                Animales en Producción
              </p>
              <h3 className="text-2xl font-black text-blue-700 dark:text-blue-300 mt-0.5">
                {(stats.in_production_animals ?? stats.total_animals).toLocaleString()}
              </h3>
              <p className="text-[10px] text-gray-400 mt-0.5">Alojados en lotes activos</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
              <PiggyBank className="w-5 h-5" />
            </div>
          </div>
        </Card>

        {/* Cupos Disponibles */}
        <Card key="target-available-capacity" className="p-4 bg-white dark:bg-[#18221F] border border-gray-200 dark:border-[#263632]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">
                Cupos Disponibles
              </p>
              <h3 className="text-2xl font-black text-purple-700 dark:text-purple-300 mt-0.5">
                {barnsWithCapacity
                  .reduce((acc, b) => {
                    const av =
                      typeof (b as any).available_capacity === 'number'
                        ? (b as any).available_capacity
                        : Math.max(
                            0,
                            Number(b.max_capacity || 0) -
                              Number((b as any).occupied_capacity || 0)
                          );
                    return acc + av;
                  }, 0)
                  .toLocaleString()}
              </h3>
              <p className="text-[10px] text-gray-400 mt-0.5">Libres en galpones activos</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
              <Layers className="w-5 h-5" />
            </div>
          </div>
        </Card>
      </div>

      {/* Mensajes de alerta */}
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

      {/* 3. Filtros y búsqueda */}
      <Card className="p-4 bg-white dark:bg-[#18221F] border border-gray-200 dark:border-[#263632]">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-center">
          {/* Buscador */}
          <div className={`relative col-span-12 ${isRoot ? 'lg:col-span-4' : 'lg:col-span-5'}`}>
            <Search className="w-4 h-4 absolute left-3.5 top-3 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por código, galpón, sector o propósito..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-10 pr-4 py-2 bg-[#F9F9F9] dark:bg-[#121816] border border-gray-200 dark:border-[#263632] rounded-xl text-xs focus:ring-2 focus:ring-[#1B4D3E] text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
            />
          </div>

          {/* Selector de granja (Root) */}
          {isRoot && (
            <div className="col-span-12 sm:col-span-6 lg:col-span-3">
              <select
                value={selectedRootFarmId || ''}
                onChange={(e) => {
                  const rawVal = e.target.value;
                  setSelectedRootFarmId(rawVal === 'all' || !rawVal ? '' : rawVal);
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

          {/* Filtro de propósito */}
          <div className="col-span-12 sm:col-span-6 lg:col-span-3">
            <select
              value={purposeFilter}
              onChange={(e) => {
                setPurposeFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 bg-[#F9F9F9] dark:bg-[#121816] border border-gray-200 dark:border-[#263632] rounded-xl text-xs focus:ring-2 focus:ring-[#1B4D3E] text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
            >
              <option value="all">Todos los Propósitos</option>
              <option value="carne">Carne</option>
              <option value="huevos">Huevos</option>
              <option value="reproducción">Reproducción</option>
            </select>
          </div>

          {/* Filtro de estado */}
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
              <option value="activo">Activos</option>
              <option value="inactivo">Inactivos / Cosechados</option>
            </select>
          </div>

          {/* Limpiar filtros */}
          {(searchTerm || statusFilter !== 'all' || purposeFilter !== 'all') && (
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

      {/* 4. Tabla de lotes */}
      <Card className="overflow-hidden bg-white dark:bg-[#18221F] border border-gray-200 dark:border-[#263632]">
        {isLoading ? (
          <div key="lots-loading" className="p-16 text-center text-xs text-gray-500">
            <RefreshCw className="w-7 h-7 animate-spin mx-auto text-[#1B4D3E] dark:text-[#4E9F3D] mb-3" />
            <p className="font-bold text-sm text-[#1E1E1E] dark:text-gray-200">
              Cargando lotes de la granja...
            </p>
            <p className="text-xs text-gray-400 mt-1">Consultando cupos y producción por galpón.</p>
          </div>
        ) : (
          <div key="lots-table-wrapper" className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#F9F9F9] dark:bg-[#121816] border-b border-gray-200 dark:border-[#263632] text-[11px] font-bold uppercase text-[#1E1E1E] dark:text-gray-400 tracking-wider">
                  <th className="py-3.5 px-4">Código del Lote</th>
                  <th className="py-3.5 px-4">Galpón</th>
                  <th className="py-3.5 px-4">Especie</th>
                  <th className="py-3.5 px-4">Sector</th>
                  <th className="py-3.5 px-4">Propósito</th>
                  <th className="py-3.5 px-4 text-right">Cantidad</th>
                  <th className="py-3.5 px-4 text-right">Costo Total de Cosecha</th>
                  <th className="py-3.5 px-4 text-right">Cupo del Galpón</th>
                  <th className="py-3.5 px-4 text-center">Estado</th>
                  <th className="py-3.5 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-[#263632] text-xs">
                {paginatedLots.length === 0 ? (
                  <tr key="lots-empty">
                    <td colSpan={10} className="py-12 text-center text-gray-500">
                      <div className="max-w-sm mx-auto text-center space-y-2">
                        <Boxes className="w-8 h-8 mx-auto text-gray-300 dark:text-gray-600" />
                        <p className="font-bold text-sm text-[#1E1E1E] dark:text-gray-200">
                          No se encontraron lotes registrados
                        </p>
                        <p className="text-xs text-gray-400">
                          {searchTerm || statusFilter !== 'all' || purposeFilter !== 'all'
                            ? 'No hay registros que coincidan con los filtros aplicados.'
                            : 'Comienza creando el primer lote de producción para tu granja.'}
                        </p>
                        <Button
                          variant="accent"
                          size="sm"
                          onClick={openCreateModal}
                          className="mt-2"
                          icon={<Plus className="w-3.5 h-3.5" />}
                        >
                          Nuevo Lote
                        </Button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedLots.map((lot) => {
                    const lCode = safeText(lot.code, 'LOT-00000');
                    const lInitial = (lCode.charAt(0) || 'L').toUpperCase();
                    const barnName = safeText(lot.galpon?.name, 'Sin galpón');
                    const speciesName = safeText(lot.species?.name, 'Sin especie');
                    const sectorLabel = safeText(lot.sector, 'General');
                    const purposeText = safeText(lot.purpose, '—');
                    const isActive = lot.status === 'activo';
                    const capacity = barnCapacityOf(lot);

                    return (
                      <tr
                        key={lot.id}
                        className="hover:bg-gray-50/60 dark:hover:bg-[#18221F]/60 transition-colors"
                      >
                        {/* Código */}
                        <td className="py-3.5 px-4 font-bold text-[#1E1E1E] dark:text-gray-100">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-[#1B4D3E]/10 dark:bg-[#4E9F3D]/20 text-[#1B4D3E] dark:text-[#4E9F3D] flex items-center justify-center font-black text-xs shrink-0 font-mono">
                              {lInitial}
                            </div>
                            <div>
                              <span className="block font-bold text-xs text-[#1E1E1E] dark:text-gray-100 font-mono leading-tight">
                                {lCode}
                              </span>
                              {lot.farm?.name && (
                                <span className="text-[10px] text-gray-400 font-normal flex items-center gap-1 mt-0.5">
                                  <Building2 className="w-2.5 h-2.5 text-[#4E9F3D]" />
                                  {safeText(lot.farm.name)}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Galpón */}
                        <td className="py-3.5 px-4 font-medium text-gray-700 dark:text-gray-300">
                          <div className="flex items-center gap-1.5">
                            <Warehouse className="w-3.5 h-3.5 text-[#4E9F3D] shrink-0" />
                            <span className="font-semibold text-xs">{barnName}</span>
                          </div>
                        </td>

                        {/* Especie */}
                        <td className="py-3.5 px-4 font-medium text-gray-700 dark:text-gray-300">
                          <div className="flex items-center gap-1.5">
                            <Layers className="w-3.5 h-3.5 text-[#4E9F3D] shrink-0" />
                            <span className="font-semibold text-xs">{speciesName}</span>
                          </div>
                        </td>

                        {/* Sector */}
                        <td className="py-3.5 px-4">
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-[#121816] border border-emerald-200/60 dark:border-[#263632] text-xs font-semibold text-[#1B4D3E] dark:text-[#4E9F3D]">
                            <Tag className="w-3 h-3 text-[#4E9F3D]" />
                            <span className="capitalize">{sectorLabel}</span>
                          </div>
                        </td>

                        {/* Propósito */}
                        <td className="py-3.5 px-4 text-gray-600 dark:text-gray-300">
                          <span className="px-2 py-0.5 rounded-md bg-gray-100 dark:bg-[#263632] text-xs font-medium">
                            {purposeText}
                          </span>
                        </td>

                        {/* Cantidad */}
                        <td className="py-3.5 px-4 text-right font-mono font-bold text-gray-800 dark:text-gray-200">
                          <span>{Number((lot.current_occupancy ?? lot.quantity) || 0).toLocaleString()}</span>
                          <span className="text-[10px] text-gray-400 ml-1 font-sans font-normal">
                            animales
                          </span>
                        </td>

                        {/* Costo Total de Cosecha */}
                        <td className="py-3.5 px-4 text-right font-mono font-bold text-gray-800 dark:text-gray-200">
                          <span>{formatDecimal(lot.harvest_cost ?? 0)}</span>
                        </td>

                        {/* Cupo del galpón */}
                        <td className="py-3.5 px-4 text-right font-mono text-gray-700 dark:text-gray-300">
                          {capacity ? (
                            <span>
                              {capacity.occupied.toLocaleString()}
                              <span className="text-gray-400"> / </span>
                              {capacity.capacity.toLocaleString()}
                            </span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>

                        {/* Estado */}
                        <td className="py-3.5 px-4 text-center">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              isActive
                                ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300'
                                : 'bg-gray-200 dark:bg-[#263632] text-gray-600 dark:text-gray-400'
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                isActive ? 'bg-emerald-500' : 'bg-gray-400'
                              }`}
                            />
                            {isActive ? 'Activo' : 'Inactivo'}
                          </span>
                        </td>

                        {/* Acciones */}
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Ver ficha técnica: en lotes de reproducción
                                la ficha es el listado de animales
                                individuales (ID, raza, sexo y estado
                                actual con insignia); en lotes de carne
                                abre la ficha general del lote */}
                            <button
                              type="button"
                              onClick={() => {
                                if (isReproductionPurpose(lot.purpose)) {
                                  // La ficha técnica de un lote de reproducción
                                  // es la vista informativa de sus animales
                                  // (sin acciones operativas)
                                  openTechSheet(lot);
                                } else {
                                  setSelectedLot(lot);
                                  setIsDetailModalOpen(true);
                                }
                              }}
                              title={
                                isReproductionPurpose(lot.purpose)
                                  ? 'Ficha técnica — animales del lote'
                                  : 'Ver ficha técnica'
                              }
                              className="p-1.5 text-gray-400 hover:text-[#1B4D3E] dark:hover:text-[#4E9F3D] hover:bg-gray-100 dark:hover:bg-[#263632] rounded-lg transition-colors cursor-pointer"
                            >
                              <Eye className="w-4 h-4" />
                            </button>

                            {/* Editar */}
                            <button
                              type="button"
                              onClick={() => openEditModal(lot)}
                              title="Editar lote"
                              className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-[#263632] rounded-lg transition-colors cursor-pointer"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>

                            {/* Cosechar (carnes / general) */}
                            {isActive && !isEggPurpose(lot.purpose) && (
                              <button
                                type="button"
                                onClick={() => openHarvestModal(lot)}
                                title="Cosechar lote"
                                className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-[#263632] rounded-lg transition-colors cursor-pointer"
                              >
                                <PackageCheck className="w-4 h-4" />
                              </button>
                            )}

                            {/* Recoger huevos (avícola - huevos) */}
                            {isActive && isEggPurpose(lot.purpose) && (
                              <button
                                type="button"
                                onClick={() => openEggsModal(lot)}
                                title="Registrar producción de huevos"
                                className="p-1.5 text-gray-400 hover:text-yellow-600 hover:bg-yellow-50 dark:hover:bg-[#263632] rounded-lg transition-colors cursor-pointer"
                              >
                                <Egg className="w-4 h-4" />
                              </button>
                            )}

                            {/* Animales individuales (porcinos de reproducción) */}
                            {isActive && isReproductionPurpose(lot.purpose) && (
                              <button
                                type="button"
                                onClick={() => openAnimalsModal(lot)}
                                title="Animales individuales del lote"
                                className="p-1.5 text-gray-400 hover:text-pink-600 hover:bg-pink-50 dark:hover:bg-[#263632] rounded-lg transition-colors cursor-pointer"
                              >
                                <PiggyBank className="w-4 h-4" />
                              </button>
                            )}

                            {/* Eliminar */}
                            <button
                              type="button"
                              onClick={() => openDeleteModal(lot)}
                              title="Eliminar lote"
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

        {/* 5. Paginación */}
        <div className="p-4 bg-[#F9F9F9] dark:bg-[#121816] border-t border-gray-200 dark:border-[#263632] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-500">
          <div>
            Mostrando{' '}
            <span className="font-bold text-[#1E1E1E] dark:text-gray-200">
              {paginatedLots.length}
            </span>{' '}
            de{' '}
            <span className="font-bold text-[#1E1E1E] dark:text-gray-200">
              {filteredLots.length}
            </span>{' '}
            lotes
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

      {/* __MODALS__ */}

      {/* 5b. Modal: Selección de galpón para lechones destetados */}
      <Modal
        isOpen={barnSelectionOpen}
        onClose={() => setBarnSelectionOpen(false)}
        title={`Destino para ${weanedSuggestion?.piglets ?? 0} lechones destetados`}
        subtitle="Seleccione el galpón de destino (solo galpones con cupo suficiente)"
        maxWidth="lg"
        zIndex={60}
      >
        <div className="space-y-2 text-xs max-h-[50vh] overflow-y-auto">
          {weanedAvailableBarns.length === 0 ? (
            <p className="text-gray-500 text-center py-4">
              No hay galpones con cupo suficiente.
            </p>
          ) : (
            weanedAvailableBarns.map((b) => {
              const free = Number((b as any).available_capacity) || Math.max(0, Number(b.max_capacity || 0) - Number((b as any).occupied_capacity || 0));
              return (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => handleWeanedBarnSelect(b.id)}
                  className="w-full text-left p-3 rounded-xl border border-gray-200 dark:border-[#263632] hover:border-[#1B4D3E] dark:hover:border-[#4E9F3D] hover:bg-emerald-50 dark:hover:bg-[#121816] transition-colors cursor-pointer"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5">
                      <Warehouse className="w-3.5 h-3.5 text-[#4E9F3D] shrink-0" />
                      <span className="font-bold">{safeText(b.name)}</span>
                      <span className="text-gray-400 font-normal">{safeText(b.sector || 'General')}</span>
                    </span>
                    <span className="shrink-0 font-mono font-bold text-[#1B4D3E] dark:text-[#4E9F3D]">
                      {free} / {Number(b.max_capacity || 0)} libres
                    </span>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </Modal>

      {/* 5c. Modal: Ficha Técnica del Lote (informativo, sin acciones) */}
      <Modal
        isOpen={isTechSheetOpen}
        onClose={() => setIsTechSheetOpen(false)}
        title={`Ficha Técnica — Lote ${selectedLot ? safeText(selectedLot.code) : ''}`}
        subtitle="Características completas registradas de cada animal"
        maxWidth="xl"
      >
        {selectedLot && (
          <div className="space-y-3 text-xs max-h-[60vh] overflow-y-auto">
            {isLoadingTechSheet && techSheetAnimals.length === 0 ? (
              <div className="p-10 text-center text-gray-500">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto text-[#1B4D3E] mb-2" />
                Cargando ficha técnica...
              </div>
            ) : techSheetAnimals.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <PiggyBank className="w-8 h-8 mx-auto text-gray-300 dark:text-gray-600 mb-2" />
                <p className="font-bold text-sm">Sin animales registrados</p>
                <p className="text-[10px] text-gray-400 mt-0.5">
                  Este lote aún no tiene cerdos individuales registrados.
                </p>
              </div>
            ) : (
              techSheetAnimals.map((animal) => (
                <div
                  key={animal.id}
                  className="p-3 rounded-xl border border-gray-200 dark:border-[#263632] bg-gray-50 dark:bg-[#121816]"
                >
                  {/* Encabezado: identificador + estado actual */}
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="font-mono font-bold text-[#1B4D3E] dark:text-[#4E9F3D]">
                      {safeText(animal.identifier)}
                    </span>
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${animalStatusClasses(animal.status)}`}>
                      {ANIMAL_STATUS_LABELS[animal.status] || animal.status}
                    </span>
                  </div>
                  {/* Atributos completos del cerdo */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                    <InfoField label="Raza" value={animal.breed} />
                    <InfoField label="Raza del padre" value={animal.father_breed} />
                    <InfoField label="Raza de la madre" value={animal.mother_breed} />
                    <InfoField label="Sexo" value={capitalize(animal.gender)} />
                    <InfoField label="Fecha de nacimiento" value={formatDate(animal.birth_date)} />
                    <InfoField label="Fecha de registro" value={formatDate(animal.created_at)} />
                    <InfoField
                      label="Partos (paridad)"
                      value={Number(animal.parity_count || 0) > 0 ? animal.parity_count : null}
                    />
                    <InfoField
                      label="Pezones"
                      value={Number(animal.teats_count || 0) > 0 ? animal.teats_count : null}
                    />
                    <InfoField
                      label="Prom. lechones / parto"
                      value={Number(animal.avg_piglets_per_birth || 0) > 0 ? animal.avg_piglets_per_birth : null}
                    />
                    <InfoField
                      label="Peso de venta (kg)"
                      value={Number(animal.sale_weight || 0) > 0 ? animal.sale_weight : null}
                    />
                    <InfoField
                      label="Precio por kg"
                      value={Number(animal.sale_price_per_kg || 0) > 0 ? animal.sale_price_per_kg : null}
                    />
                    <InfoField
                      label="Precio total"
                      value={Number(animal.sale_total_price || 0) > 0 ? animal.sale_total_price : null}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </Modal>

      {/* 6. Modal: Registrar Nuevo Lote (cuadrícula de dos columnas) */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Registrar Nuevo Lote"
        subtitle="Código autogenerado, herencia de sector/propósito y validación de cupo"
        maxWidth="xl"
        zIndex={60}
      >
        <form onSubmit={handleCreateSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          {/* Código del Lote (autogenerado, solo lectura) */}
          <div>
            <label className="block text-[11px] font-bold text-[#1E1E1E] dark:text-gray-200 uppercase mb-1 flex items-center justify-between">
              <span>Código del Lote</span>
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold normal-case">
                Autogenerado
              </span>
            </label>
            <div className="relative">
              <input
                type="text"
                readOnly
                value={previewCode}
                className="w-full px-3.5 py-2.5 bg-gray-100 dark:bg-[#121816]/70 border border-gray-200 dark:border-[#263632] rounded-xl text-xs font-bold font-mono cursor-not-allowed select-none text-gray-700 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500"
              />
              <Tag className="w-4 h-4 absolute right-3.5 top-2.5 text-gray-400" />
            </div>
            <p className="text-[10px] text-gray-400 mt-1">
              Código único e irrepetible asignado automáticamente (formato LOT-XXXXX).
            </p>
          </div>

          {/* Selector de Galpón (solo con cupos disponibles) */}
          <div>
            <label className="block text-[11px] font-bold text-[#1E1E1E] dark:text-gray-200 uppercase mb-1">
              Galpón Destino <span className="text-red-500">*</span>
            </label>
            <select
              value={formGalponId}
              onChange={(e) => handleBarnChange(e.target.value)}
              required
              className="w-full px-3.5 py-2.5 bg-[#F9F9F9] dark:bg-[#121816] border border-gray-200 dark:border-[#263632] rounded-xl text-xs focus:ring-2 focus:ring-[#1B4D3E] cursor-pointer text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
            >
              <option value="" disabled>
                {barnsList.length === 0
                  ? 'No hay galpones en la granja'
                  : barnsWithCapacity.length === 0
                  ? 'No hay galpones con cupos disponibles'
                  : 'Selecciona un galpón con cupo...'}
              </option>
              {barnsWithCapacity.map((b) => {
                const av =
                  typeof (b as any).available_capacity === 'number'
                    ? (b as any).available_capacity
                    : Math.max(
                        0,
                        Number(b.max_capacity || 0) -
                          Number((b as any).occupied_capacity || 0)
                      );
                return (
                  <option key={`lot-barn-${b.id}`} value={String(b.id)}>
                    {safeText(b.name)} — {av.toLocaleString()} /{' '}
                    {Number(b.max_capacity || 0).toLocaleString()} cupos libres
                  </option>
                );
              })}
            </select>
            <p className="text-[10px] text-gray-400 mt-1">
              Solo se listan galpones activos con capacidad disponible. El cupo se valida al guardar.
            </p>
          </div>

          {/* Especie (autocompletada desde el galpón) */}
          <div>
            <label className="block text-[11px] font-bold text-[#1E1E1E] dark:text-gray-200 uppercase mb-1 flex items-center justify-between">
              <span>Especie Asociada</span>
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold normal-case">
                Autocompletado
              </span>
            </label>
            <input
              type="text"
              readOnly
              value={
                selectedBarn?.species?.name
                  ? `${selectedBarn.species.name}`
                  : 'SELECCIONA UN GALPÓN ARRIBA'
              }
              className="w-full px-3.5 py-2.5 bg-gray-100 dark:bg-[#121816]/70 border border-gray-200 dark:border-[#263632] rounded-xl text-xs font-semibold cursor-not-allowed select-none text-gray-700 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500"
            />
            <p className="text-[10px] text-gray-400 mt-1">
              Se hereda automáticamente de la especie asignada al galpón.
            </p>
          </div>

          {/* Sector (autocompletado, solo lectura) */}
          <div>
            <label className="block text-[11px] font-bold text-[#1E1E1E] dark:text-gray-200 uppercase mb-1 flex items-center justify-between">
              <span>Sector</span>
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold normal-case">
                Autocompletado
              </span>
            </label>
            <div className="relative">
              <input
                type="text"
                readOnly
                value={formSector ? formSector.toUpperCase() : 'SELECCIONA UN GALPÓN ARRIBA'}
                className="w-full px-3.5 py-2.5 bg-gray-100 dark:bg-[#121816]/70 border border-gray-200 dark:border-[#263632] rounded-xl text-xs font-semibold cursor-not-allowed select-none text-gray-700 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500"
              />
              <Tag className="w-4 h-4 absolute right-3.5 top-2.5 text-gray-400" />
            </div>
            <p className="text-[10px] text-gray-400 mt-1">
              Heredado directamente del sector del galpón seleccionado.
            </p>
          </div>

          {/* Propósito (autocompletado, solo lectura) */}
          <div>
            <label className="block text-[11px] font-bold text-[#1E1E1E] dark:text-gray-200 uppercase mb-1 flex items-center justify-between">
              <span>Propósito</span>
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold normal-case">
                Autocompletado
              </span>
            </label>
            <input
              type="text"
              readOnly
              value={formPurpose ? formPurpose.toUpperCase() : 'SELECCIONA UN GALPÓN ARRIBA'}
              className="w-full px-3.5 py-2.5 bg-gray-100 dark:bg-[#121816]/70 border border-gray-200 dark:border-[#263632] rounded-xl text-xs font-semibold cursor-not-allowed select-none text-gray-700 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500"
            />
            <p className="text-[10px] text-gray-400 mt-1">
              Heredado del propósito operativo del galpón (carne, huevos o reproducción).
            </p>
          </div>

          {/* Cantidad de Animales (validación en tiempo real) */}
          <div>
            <label className="block text-[11px] font-bold text-[#1E1E1E] dark:text-gray-200 uppercase mb-1">
              Cantidad de Animales <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              min="1"
              step="1"
              max={availableCapacity || undefined}
              placeholder={`Máx. ${availableCapacity} cupos disponibles`}
              value={formQuantity}
              onChange={(e) => setFormQuantity(e.target.value)}
              required
              className={`w-full px-3.5 py-2.5 bg-[#F9F9F9] dark:bg-[#121816] border rounded-xl text-xs focus:ring-2 ${ formGalponId && quantityError ? 'border-red-400 focus:ring-red-500' : 'border-gray-200 dark:border-[#263632] focus:ring-[#1B4D3E]' } text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500`}
            />
            {formGalponId && quantityNum > 0 && !quantityError && (
              <p className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-1 font-semibold">
                ✓ {quantityNum} animales caben en el galpón. Quedarán {Math.max(0, availableCapacity - quantityNum)} cupos libres.
              </p>
            )}
            {formGalponId && quantityError && (
              <p className="text-[10px] text-red-600 dark:text-red-400 mt-1 font-semibold flex items-center gap-1">
                <AlertCircle className="w-3 h-3 shrink-0" />
                {quantityError}
              </p>
            )}
            {!formGalponId && (
              <p className="text-[10px] text-gray-400 mt-1">
                Validado en tiempo real contra los cupos disponibles del galpón.
              </p>
            )}
          </div>

          {/* Granja asignada (Root) */}
          {isRoot && farmsList.length > 0 && (
            <div>
              <label className="block text-[11px] font-bold text-[#1E1E1E] dark:text-gray-200 uppercase mb-1">
                Granja Asignada <span className="text-red-500">*</span>
              </label>
              <select
                value={formFarmId}
                onChange={(e) => setFormFarmId(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 bg-[#F9F9F9] dark:bg-[#121816] border border-gray-200 dark:border-[#263632] rounded-xl text-xs focus:ring-2 focus:ring-[#1B4D3E] text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
              >
                <option value="">Selecciona una granja...</option>
                {farmsList.map((f) => (
                  <option key={`lot-farm-${f.id}`} value={String(f.id)}>
                    {f.name} {f.code ? `(${f.code})` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Formularios individuales por animal (Porcino + Reproducción) */}
          {isReproductionForm && shownAnimalForms > 0 && (
            <div className="col-span-1 md:col-span-2">
              <div className="p-3 bg-pink-50 dark:bg-pink-950/30 border border-pink-200 dark:border-pink-800/50 rounded-xl mb-3 flex items-start gap-2">
                <PiggyBank className="w-4 h-4 text-pink-600 dark:text-pink-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-xs text-pink-800 dark:text-pink-200">
                    Lote de reproducción porcina — {shownAnimalForms} animales individuales
                  </p>
                  <p className="text-[10px] text-pink-600 dark:text-pink-300 mt-0.5">
                    Complete la ficha de cada integrante del lote. El identificador de 5 dígitos es automático. Los campos de partos, pezones y promedio de lechones aplican solo a hembras.
                    {quantityNum > MAX_ANIMAL_FORMS && (
                      <span className="block mt-0.5 font-semibold">
                        Mostrando los primeros {MAX_ANIMAL_FORMS}; registre el resto desde "Animales" tras crear el lote.
                      </span>
                    )}
                  </p>
                </div>
              </div>

              <div className="max-h-96 overflow-y-auto pr-1 space-y-3">
                {animalForms.map((af, idx) => (
                  <div
                    key={af.formKey}
                    className="p-3 bg-white dark:bg-[#121816] border border-gray-200 dark:border-[#263632] rounded-xl"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-bold text-[#1E1E1E] dark:text-gray-200 flex items-center gap-2">
                        <span className="w-6 h-6 rounded-lg bg-pink-100 dark:bg-pink-900/40 text-pink-700 dark:text-pink-300 flex items-center justify-center font-mono font-black text-[10px]">
                          {String(idx + 1).padStart(5, '0')}
                        </span>
                        Animal #{idx + 1}
                      </span>
                      <span className="text-[10px] text-gray-400 font-mono">
                        ID automático: {String(idx + 1).padStart(5, '0')}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* Raza */}
                      <div>
                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">
                          Raza
                        </label>
                        <input
                          type="text"
                          placeholder="Ej. Landrace, Duroc..."
                          value={af.breed}
                          onChange={(e) =>
                            setAnimalForms((prev) =>
                              prev.map((f, i) =>
                                i === idx ? { ...f, breed: e.target.value } : f
                              )
                            )
                          }
                          className="w-full px-3 py-2 bg-[#F9F9F9] dark:bg-[#18221F] border border-gray-200 dark:border-[#263632] rounded-lg text-xs text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
                        />
                      </div>

                      {/* Sexo */}
                      <div>
                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">
                          Sexo <span className="text-red-500">*</span>
                        </label>
                        <select
                          value={af.gender}
                          onChange={(e) =>
                            setAnimalForms((prev) =>
                              prev.map((f, i) =>
                                i === idx
                                  ? { ...f, gender: e.target.value as 'hembra' | 'macho' }
                                  : f
                              )
                            )
                          }
                          className="w-full px-3 py-2 bg-[#F9F9F9] dark:bg-[#18221F] border border-gray-200 dark:border-[#263632] rounded-lg text-xs text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
                        >
                          <option value="hembra">Hembra</option>
                          <option value="macho">Macho</option>
                        </select>
                      </div>

                      {/* Raza padre */}
                      <div>
                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">
                          Raza Padre
                        </label>
                        <input
                          type="text"
                          placeholder="Ej. Duroc"
                          value={af.father_breed}
                          onChange={(e) =>
                            setAnimalForms((prev) =>
                              prev.map((f, i) =>
                                i === idx ? { ...f, father_breed: e.target.value } : f
                              )
                            )
                          }
                          className="w-full px-3 py-2 bg-[#F9F9F9] dark:bg-[#18221F] border border-gray-200 dark:border-[#263632] rounded-lg text-xs text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
                        />
                      </div>

                      {/* Raza madre */}
                      <div>
                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">
                          Raza Madre
                        </label>
                        <input
                          type="text"
                          placeholder="Ej. Yorkshire"
                          value={af.mother_breed}
                          onChange={(e) =>
                            setAnimalForms((prev) =>
                              prev.map((f, i) =>
                                i === idx ? { ...f, mother_breed: e.target.value } : f
                              )
                            )
                          }
                          className="w-full px-3 py-2 bg-[#F9F9F9] dark:bg-[#18221F] border border-gray-200 dark:border-[#263632] rounded-lg text-xs text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
                        />
                      </div>

                      {/* Fecha de nacimiento */}
                      <div>
                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">
                          Fecha de Nacimiento
                        </label>
                        <input
                          type="date"
                          value={af.birth_date}
                          onChange={(e) =>
                            setAnimalForms((prev) =>
                              prev.map((f, i) =>
                                i === idx ? { ...f, birth_date: e.target.value } : f
                              )
                            )
                          }
                          className="w-full px-3 py-2 bg-[#F9F9F9] dark:bg-[#18221F] border border-gray-200 dark:border-[#263632] rounded-lg text-xs text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
                        />
                      </div>

                      {/* Campos exclusivos para hembras */}
                      {af.gender === 'hembra' ? (
                        <>
                          <div>
                            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">
                              Partos (paridad)
                            </label>
                            <input
                              type="number"
                              min="0"
                              step="1"
                              placeholder="Ej. 3"
                              value={af.parity_count}
                              onChange={(e) =>
                                setAnimalForms((prev) =>
                                  prev.map((f, i) =>
                                    i === idx ? { ...f, parity_count: e.target.value } : f
                                  )
                                )
                              }
                              className="w-full px-3 py-2 bg-[#F9F9F9] dark:bg-[#18221F] border border-gray-200 dark:border-[#263632] rounded-lg text-xs text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">
                              Pezones
                            </label>
                            <input
                              type="number"
                              min="0"
                              step="1"
                              placeholder="Ej. 14"
                              value={af.teats_count}
                              onChange={(e) =>
                                setAnimalForms((prev) =>
                                  prev.map((f, i) =>
                                    i === idx ? { ...f, teats_count: e.target.value } : f
                                  )
                                )
                              }
                              className="w-full px-3 py-2 bg-[#F9F9F9] dark:bg-[#18221F] border border-gray-200 dark:border-[#263632] rounded-lg text-xs text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
                            />
                          </div>
                          <div className="sm:col-span-2">
                            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">
                              Promedio de Lechones por Parto
                            </label>
                            <input
                              type="number"
                              min="0"
                              step="0.1"
                              placeholder="Ej. 11.5"
                              value={af.avg_piglets_per_birth}
                              onChange={(e) =>
                                setAnimalForms((prev) =>
                                  prev.map((f, i) =>
                                    i === idx
                                      ? { ...f, avg_piglets_per_birth: e.target.value }
                                      : f
                                  )
                                )
                              }
                              className="w-full px-3 py-2 bg-[#F9F9F9] dark:bg-[#18221F] border border-gray-200 dark:border-[#263632] rounded-lg text-xs text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
                            />
                          </div>
                        </>
                      ) : (
                        <div className="sm:col-span-2 p-2 bg-gray-50 dark:bg-[#18221F] rounded-lg text-[10px] text-gray-400 italic">
                          Macho: campos de paridad, pezones y promedio de lechones no aplican.
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Botones */}
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
              disabled={isSubmitting || !formGalponId || !!quantityError}
              icon={<CheckCircle2 className="w-4 h-4" />}
            >
              {isSubmitting ? 'Guardando...' : 'Registrar Lote'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* 7. Modal: Editar Lote */}      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title={`Editar Lote ${selectedLot ? safeText(selectedLot.code) : ''}`}
        maxWidth="lg"
      >
        {selectedLot && (
          <form onSubmit={handleEditSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="col-span-1 md:col-span-2 p-3 bg-gray-50 dark:bg-[#121816] rounded-xl border border-gray-200 dark:border-[#263632] flex items-center justify-between">
              <div>
                <span className="font-bold text-xs text-[#1E1E1E] dark:text-gray-200 block">
                  {safeText(selectedLot.galpon?.name, 'Galpón')}
                </span>
                <span className="text-[10px] text-gray-400">
                  {safeText(selectedLot.sector, 'General')} · {safeText(selectedLot.purpose, '—')}
                </span>
              </div>
              <span className="font-mono font-bold text-xs text-[#1B4D3E] dark:text-[#4E9F3D]">
                {safeText(selectedLot.code)}
              </span>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-[#1E1E1E] dark:text-gray-200 uppercase mb-1">
                Cantidad de Animales <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min="1"
                step="1"
                value={editQuantity}
                onChange={(e) => setEditQuantity(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 bg-[#F9F9F9] dark:bg-[#121816] border border-gray-200 dark:border-[#263632] rounded-xl text-xs focus:ring-2 focus:ring-[#1B4D3E] text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
              />
              <p className="text-[10px] text-gray-400 mt-1">
                El backend revalida el cupo disponible del galpón al guardar.
              </p>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-[#1E1E1E] dark:text-gray-200 uppercase mb-1">
                Propósito Operativo
              </label>
              <input
                type="text"
                value={editPurpose}
                onChange={(e) => setEditPurpose(e.target.value)}
                placeholder="Ej. Carne, Huevos, Reproducción"
                className="w-full px-3.5 py-2.5 bg-[#F9F9F9] dark:bg-[#121816] border border-gray-200 dark:border-[#263632] rounded-xl text-xs focus:ring-2 focus:ring-[#1B4D3E] text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
              />
            </div>

            <div className="col-span-1 md:col-span-2">
              <label className="block text-[11px] font-bold text-[#1E1E1E] dark:text-gray-200 uppercase mb-1">
                Estado del Lote
              </label>
              <select
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-[#F9F9F9] dark:bg-[#121816] border border-gray-200 dark:border-[#263632] rounded-xl text-xs focus:ring-2 focus:ring-[#1B4D3E] text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
              >
                <option value="activo">Activo</option>
                <option value="inactivo">Inactivo / Cosechado</option>
              </select>
              <p className="text-[10px] text-gray-400 mt-1">
                Al reactivar un lote, el backend verifica que el galpón tenga cupo suficiente.
              </p>
            </div>

            <div className="col-span-1 md:col-span-2 pt-3 border-t border-gray-100 dark:border-[#263632] flex items-center justify-end gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setIsEditModalOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" variant="accent" size="sm" disabled={isSubmitting} icon={<CheckCircle2 className="w-4 h-4" />}>
                {isSubmitting ? 'Guardando...' : 'Actualizar Lote'}
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* 8. Modal: Ficha Técnica del Lote */}
      <Modal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        title="Ficha Técnica del Lote"
      >
        {selectedLot && (
          <div className="space-y-4 text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-[#263632]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#1B4D3E]/10 dark:bg-[#4E9F3D]/20 text-[#1B4D3E] dark:text-[#4E9F3D] flex items-center justify-center font-mono font-black text-xs">
                  {safeText(selectedLot.code).charAt(0)}
                </div>
                <div>
                  <h3 className="font-black text-sm text-[#1E1E1E] dark:text-gray-100 font-mono">
                    {safeText(selectedLot.code)}
                  </h3>
                  <p className="text-[11px] text-gray-400">ID Registro: #{selectedLot.id}</p>
                </div>
              </div>
              <span
                className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                  selectedLot.status === 'activo'
                    ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300'
                    : 'bg-gray-200 dark:bg-[#263632] text-gray-600 dark:text-gray-400'
                }`}
              >
                {selectedLot.status === 'activo' ? 'Activo' : 'Inactivo'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-gray-50 dark:bg-[#121816] rounded-xl border border-gray-200/60 dark:border-[#263632]">
                <span className="text-[10px] text-gray-400 uppercase font-bold block mb-0.5">Galpón</span>
                <span className="font-bold text-xs flex items-center gap-1.5">
                  <Warehouse className="w-3.5 h-3.5 text-[#4E9F3D]" />
                  {safeText(selectedLot.galpon?.name, 'Sin galpón')}
                </span>
              </div>
              <div className="p-3 bg-gray-50 dark:bg-[#121816] rounded-xl border border-gray-200/60 dark:border-[#263632]">
                <span className="text-[10px] text-gray-400 uppercase font-bold block mb-0.5">Especie</span>
                <span className="font-bold text-xs flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-[#4E9F3D]" />
                  {safeText(selectedLot.species?.name, 'Sin especie')}
                </span>
              </div>
              <div className="p-3 bg-gray-50 dark:bg-[#121816] rounded-xl border border-gray-200/60 dark:border-[#263632]">
                <span className="text-[10px] text-gray-400 uppercase font-bold block mb-0.5">Sector</span>
                <span className="font-bold text-xs text-[#1B4D3E] dark:text-[#4E9F3D] capitalize flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5" />
                  {safeText(selectedLot.sector, 'General')}
                </span>
              </div>
              <div className="p-3 bg-gray-50 dark:bg-[#121816] rounded-xl border border-gray-200/60 dark:border-[#263632]">
                <span className="text-[10px] text-gray-400 uppercase font-bold block mb-0.5">Propósito</span>
                <span className="font-bold text-xs">{safeText(selectedLot.purpose, '—')}</span>
              </div>
              <div className="p-3 bg-gray-50 dark:bg-[#121816] rounded-xl border border-gray-200/60 dark:border-[#263632]">
                <span className="text-[10px] text-gray-400 uppercase font-bold block mb-0.5">Cantidad</span>
                <span className="font-black text-sm font-mono">
                  {Number((selectedLot.current_occupancy ?? selectedLot.quantity) || 0).toLocaleString()} animales
                </span>
              </div>
              <div className="p-3 bg-gray-50 dark:bg-[#121816] rounded-xl border border-gray-200/60 dark:border-[#263632]">
                <span className="text-[10px] text-gray-400 uppercase font-bold block mb-0.5">Fecha de Registro</span>
                <span className="font-bold text-xs flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-[#4E9F3D]" />
                  {selectedLot.entry_date ? safeText(selectedLot.entry_date) : '—'}
                </span>
              </div>

              {/* Resumen de cosecha */}
              {selectedLot.harvest_date && (
                <div className="col-span-2 p-3 bg-amber-50 dark:bg-amber-950/30 rounded-xl border border-amber-200/60 dark:border-amber-800/40">
                  <span className="text-[10px] text-amber-600 uppercase font-bold block mb-1.5">
                    Resumen de Cosecha
                  </span>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <span>Peso promedio: <strong>{formatDecimal(selectedLot.avg_weight)} kg</strong></span>
                    <span>Peso total: <strong>{formatDecimal(selectedLot.total_weight)} kg</strong></span>
                    <span>Precio/kg: <strong>{formatDecimal(selectedLot.price_per_kg)}</strong></span>
                    <span>Total: <strong>{formatDecimal(selectedLot.total_price)}</strong></span>
                    <span className="col-span-2">Fecha: <strong>{safeText(selectedLot.harvest_date)}</strong></span>
                  </div>
                </div>
              )}

              {/* Resumen de huevos */}
              {Number(selectedLot.total_eggs || 0) > 0 && (
                <div className="col-span-2 p-3 bg-yellow-50 dark:bg-yellow-950/30 rounded-xl border border-yellow-200/60 dark:border-yellow-800/40">
                  <span className="text-[10px] text-yellow-600 uppercase font-bold block mb-1.5">
                    Producción de Huevos Acumulada
                  </span>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <span>Huevos totales: <strong>{Number(selectedLot.total_eggs || 0).toLocaleString()}</strong></span>
                    <span>Huevos rotos: <strong>{Number(selectedLot.broken_eggs || 0).toLocaleString()}</strong></span>
                    <span>Precio unitario: <strong>{formatDecimal(selectedLot.egg_price)}</strong></span>
                    <span>Costo producción: <strong>{formatDecimal(selectedLot.total_egg_cost)}</strong></span>
                    <span>Costo mermas: <strong>{formatDecimal(selectedLot.total_broken_cost)}</strong></span>
                    <span>Buenos: <strong>{Number(selectedLot.total_eggs || 0) - Number(selectedLot.broken_eggs || 0)}</strong></span>
                  </div>
                </div>
              )}
            </div>

            {selectedLot.farm && (
              <div className="p-3 bg-emerald-50/50 dark:bg-[#121816] rounded-xl border border-emerald-200/60 dark:border-[#263632] flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-gray-400 uppercase font-bold block">Granja Propietaria</span>
                  <span className="font-bold text-xs text-[#1B4D3E] dark:text-[#4E9F3D]">
                    {safeText(selectedLot.farm.name)}
                  </span>
                </div>
                {selectedLot.farm.code && (
                  <span className="text-[10px] px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 font-bold rounded-md font-mono">
                    {selectedLot.farm.code}
                  </span>
                )}
              </div>
            )}

            <div className="pt-3 border-t border-gray-100 dark:border-[#263632] flex justify-end">
              <Button variant="outline" size="sm" onClick={() => setIsDetailModalOpen(false)}>
                Cerrar
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* 9. Modal: Confirmación de Eliminación */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Eliminar Lote"
      >
        {selectedLot && (
          <div className="space-y-4 text-xs">
            <div className="p-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-red-800 dark:text-red-200">
                  ¿Estás seguro de que deseas eliminar este lote?
                </p>
                <p className="text-red-700 dark:text-red-300 mt-1 leading-relaxed">
                  Solo se pueden eliminar lotes <strong>inactivos</strong> y sin animales registrados individualmente.
                  Si el lote está activo, <strong>cosechélo primero</strong> para liberar el cupo.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setIsDeleteModalOpen(false)} disabled={isDeleting}>
                Cancelar
              </Button>
              <Button variant="danger" size="sm" disabled={isDeleting} onClick={handleDelete} icon={<Trash2 className="w-3.5 h-3.5" />}>
                {isDeleting ? 'Eliminando...' : 'Sí, Eliminar'}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* __MODALS2__ */}

      {/* 11. Modal: Cosechar Lote (carnes / general) */}
      <Modal
        isOpen={isHarvestModalOpen}
        onClose={() => setIsHarvestModalOpen(false)}
        title={`Cosechar Lote ${selectedLot ? safeText(selectedLot.code) : ''}`}
        subtitle="Calcula pesos y precios totales, libera cupo e inactiva el lote"
        maxWidth="lg"
      >
        {selectedLot && (
          <form onSubmit={handleHarvestSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="col-span-1 md:col-span-2 p-3 bg-gray-50 dark:bg-[#121816] rounded-xl border border-gray-200 dark:border-[#263632] flex items-center justify-between">
              <div>
                <span className="font-bold text-xs block">{safeText(selectedLot.galpon?.name, 'Galpón')}</span>
                <span className="text-[10px] text-gray-400">
                  {safeText(selectedLot.sector, 'General')} · {safeText(selectedLot.purpose, '—')}
                </span>
              </div>
              <span className="font-mono font-bold text-xs">
                {Number(selectedLot.quantity || 0).toLocaleString()} animales
              </span>
            </div>

            {/* Cantidad a cosechar (permite cosecha parcial) */}
            <div>
              <label className="block text-[11px] font-bold text-[#1E1E1E] dark:text-gray-200 uppercase mb-1">
                Cantidad a Cosechar
              </label>
              <input
                type="number"
                min="1"
                max={Number(selectedLot.quantity || 0)}
                step="1"
                value={harvestQuantity}
                onChange={(e) => setHarvestQuantity(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-[#F9F9F9] dark:bg-[#121816] border border-gray-200 dark:border-[#263632] rounded-xl text-xs focus:ring-2 focus:ring-[#1B4D3E] text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
              />
              <p className="text-[10px] text-gray-400 mt-1">
                Déjelo en {Number(selectedLot.quantity || 0)} para cosechar el lote completo. Menos cantidad genera una cosecha parcial.
              </p>
            </div>

            {/* Fecha de cosecha */}
            <div>
              <label className="block text-[11px] font-bold text-[#1E1E1E] dark:text-gray-200 uppercase mb-1">
                Fecha de Cosecha
              </label>
              <input
                type="date"
                value={harvestDate}
                onChange={(e) => setHarvestDate(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-[#F9F9F9] dark:bg-[#121816] border border-gray-200 dark:border-[#263632] rounded-xl text-xs focus:ring-2 focus:ring-[#1B4D3E] text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
              />
            </div>

            {/* Peso promedio */}
            <div>
              <label className="block text-[11px] font-bold text-[#1E1E1E] dark:text-gray-200 uppercase mb-1">
                Peso Promedio (kg) <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Ej. 120.50"
                  value={harvestAvgWeight}
                  onChange={(e) => setHarvestAvgWeight(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 bg-[#F9F9F9] dark:bg-[#121816] border border-gray-200 dark:border-[#263632] rounded-xl text-xs focus:ring-2 focus:ring-[#1B4D3E] text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
                />
                <Weight className="w-4 h-4 absolute right-3.5 top-2.5 text-gray-400" />
              </div>
            </div>

            {/* Precio por kilo */}
            <div>
              <label className="block text-[11px] font-bold text-[#1E1E1E] dark:text-gray-200 uppercase mb-1">
                Precio por Kilo <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Ej. 3.25"
                  value={harvestPricePerKg}
                  onChange={(e) => setHarvestPricePerKg(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 bg-[#F9F9F9] dark:bg-[#121816] border border-gray-200 dark:border-[#263632] rounded-xl text-xs focus:ring-2 focus:ring-[#1B4D3E] text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
                />
                <DollarSign className="w-4 h-4 absolute right-3.5 top-2.5 text-gray-400" />
              </div>
            </div>

            {/* Total automático */}
            <div className="col-span-1 md:col-span-2 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-800/40 rounded-xl">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase text-amber-700 dark:text-amber-300">
                  Total de Cosecha (automático)
                </span>
                <span className="text-lg font-black font-mono text-amber-800 dark:text-amber-200">
                  {harvestTotal !== null ? formatDecimal(harvestTotal) : '—'}
                </span>
              </div>
              <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1">
                = cantidad × peso promedio × precio por kilo. Al guardar, el lote se marca inactivo y el cupo se libera en el galpón.
              </p>
            </div>

            <div className="col-span-1 md:col-span-2 pt-3 border-t border-gray-100 dark:border-[#263632] flex items-center justify-end gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setIsHarvestModalOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" variant="accent" size="sm" disabled={isSubmitting} icon={<PackageCheck className="w-4 h-4" />}>
                {isSubmitting ? 'Cosechando...' : 'Confirmar Cosecha'}
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* 12. Modal: Recoger Huevos (avícola - huevos) */}
      <Modal
        isOpen={isEggsModalOpen}
        onClose={() => setIsEggsModalOpen(false)}
        title={`Producción de Huevos — Lote ${selectedLot ? safeText(selectedLot.code) : ''}`}
        subtitle="Acumula producción y mermas sin liberar el cupo del galpón"
        maxWidth="lg"
      >
        {selectedLot && (
          <form onSubmit={handleEggsSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="col-span-1 md:col-span-2 p-3 bg-gray-50 dark:bg-[#121816] rounded-xl border border-gray-200 dark:border-[#263632] flex items-center justify-between">
              <div>
                <span className="font-bold text-xs block">{safeText(selectedLot.galpon?.name, 'Galpón')}</span>
                <span className="text-[10px] text-gray-400">
                  Acumulado: {Number(selectedLot.total_eggs || 0).toLocaleString()} huevos · Rotos: {Number(selectedLot.broken_eggs || 0).toLocaleString()}
                </span>
              </div>
              <Egg className="w-5 h-5 text-yellow-500" />
            </div>

            {/* Huevos completos */}
            <div>
              <label className="block text-[11px] font-bold text-[#1E1E1E] dark:text-gray-200 uppercase mb-1">
                Huevos Completos <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min="0"
                step="1"
                placeholder="Ej. 1000"
                value={eggsTotal}
                onChange={(e) => setEggsTotal(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 bg-[#F9F9F9] dark:bg-[#121816] border border-gray-200 dark:border-[#263632] rounded-xl text-xs focus:ring-2 focus:ring-[#1B4D3E] text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
              />
            </div>

            {/* Huevos rotos */}
            <div>
              <label className="block text-[11px] font-bold text-[#1E1E1E] dark:text-gray-200 uppercase mb-1">
                Huevos Rotos (mermas)
              </label>
              <input
                type="number"
                min="0"
                step="1"
                placeholder="Ej. 40"
                value={eggsBroken}
                onChange={(e) => setEggsBroken(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-[#F9F9F9] dark:bg-[#121816] border border-gray-200 dark:border-[#263632] rounded-xl text-xs focus:ring-2 focus:ring-[#1B4D3E] text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
              />
              <p className="text-[10px] text-gray-400 mt-1">No pueden superar el total de huevos.</p>
            </div>

            {/* Precio unitario */}
            <div>
              <label className="block text-[11px] font-bold text-[#1E1E1E] dark:text-gray-200 uppercase mb-1">
                Precio Unitario por Huevo <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  step="0.001"
                  placeholder="Ej. 0.25"
                  value={eggsPrice}
                  onChange={(e) => setEggsPrice(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 bg-[#F9F9F9] dark:bg-[#121816] border border-gray-200 dark:border-[#263632] rounded-xl text-xs focus:ring-2 focus:ring-[#1B4D3E] text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
                />
                <DollarSign className="w-4 h-4 absolute right-3.5 top-2.5 text-gray-400" />
              </div>
            </div>

            {/* Costos calculados automáticamente */}
            <div className="col-span-1 md:col-span-2 p-3 bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200/60 dark:border-yellow-800/40 rounded-xl space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase text-yellow-700 dark:text-yellow-300">
                  Cálculos automáticos
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-600 dark:text-gray-300">Costo de producción (totales × precio):</span>
                <span className="font-black font-mono">{eggsTotals ? formatDecimal(eggsTotals.total_egg_cost) : '—'}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-600 dark:text-gray-300">Costo de mermas (rotos × precio):</span>
                <span className="font-black font-mono">{eggsTotals ? formatDecimal(eggsTotals.total_broken_cost) : '—'}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-600 dark:text-gray-300">Huevos buenos:</span>
                <span className="font-black font-mono">{eggsTotals ? eggsTotals.good_eggs.toLocaleString() : '—'}</span>
              </div>
              <p className="text-[10px] text-yellow-600 dark:text-yellow-400 pt-1">
                El cupo del galpón se mantiene ocupado hasta que se coseche el lote completo.
              </p>
            </div>

            <div className="col-span-1 md:col-span-2 pt-3 border-t border-gray-100 dark:border-[#263632] flex items-center justify-end gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setIsEggsModalOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" variant="accent" size="sm" disabled={isSubmitting} icon={<Egg className="w-4 h-4" />}>
                {isSubmitting ? 'Guardando...' : 'Registrar Huevos'}
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* 13. Modal: Animales Individuales (porcinos de reproducción) */}
      <Modal
        isOpen={isAnimalsModalOpen}
        onClose={() => setIsAnimalsModalOpen(false)}
        title={`Animales del Lote ${selectedLot ? safeText(selectedLot.code) : ''}`}
        subtitle="Registro individual de cerdos con acciones por animal"
        maxWidth="2xl"
      >
        {selectedLot && (
          <div className="space-y-4 text-xs">
            {/* Sugerencia de nuevo lote con lechones destetados */}
            {weanedSuggestion && (
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-700/50 rounded-xl flex items-center justify-between gap-3">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-emerald-800 dark:text-emerald-200">
                      Hay {weanedSuggestion.piglets} lechones destetados pendientes de asignar a un galpón
                    </p>
                    <p className="text-[10px] text-emerald-600 dark:text-emerald-300 mt-0.5">
                      La alerta permanece —incluso si recargas la página— hasta crear el lote de lechones con la cantidad exacta de vivos.
                    </p>
                  </div>
                </div>
                <Button
                  variant="accent"
                  size="sm"
                  onClick={handleWeanedNewLot}
                  icon={<Plus className="w-3.5 h-3.5" />}
                  className="shrink-0"
                >
                  Nuevo Lote ({weanedSuggestion.piglets})
                </Button>
              </div>
            )}

            <div className="flex items-center justify-between">
              <span className="text-[11px] text-gray-500">
                <strong>{lotAnimals.length}</strong> cerdos registrados en este lote
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefreshAnimals}
                icon={<RefreshCw className={`w-3.5 h-3.5 ${isLoadingAnimals ? 'animate-spin' : ''}`} />}
              >
                Recargar
              </Button>
            </div>

            {/* Contenedor estable para evitar errores de sincronización del DOM */}
            <div className="min-h-[200px]">
              {isLoadingAnimals && lotAnimals.length === 0 ? (
                <div key="loading" className="p-10 text-center text-gray-500">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto text-[#1B4D3E] mb-2" />
                  Cargando animales...
                </div>
              ) : lotAnimals.length === 0 ? (
                <div key="empty" className="p-8 text-center text-gray-500">
                  <PiggyBank className="w-8 h-8 mx-auto text-gray-300 dark:text-gray-600 mb-2" />
                  <p className="font-bold text-sm">Sin animales registrados</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    Registre los cerdos individualmente desde "Nuevo Lote" o aquí.
                  </p>
                </div>
              ) : (
                <div
                  key="table"
                  className={`max-h-96 overflow-y-auto border border-gray-200 dark:border-[#263632] rounded-xl transition-opacity ${
                    isLoadingAnimals ? 'opacity-60' : ''
                  }`}
                >
                  <table className="w-full text-left border-collapse">
                    <thead className="sticky top-0 bg-[#F9F9F9] dark:bg-[#121816]">
                      <tr className="border-b border-gray-200 dark:border-[#263632] text-[10px] font-bold uppercase text-gray-500 dark:text-gray-400 tracking-wider">
                        <th className="py-2.5 px-3">ID / Identificador</th>
                        <th className="py-2.5 px-3">Raza</th>
                        <th className="py-2.5 px-3">Sexo</th>
                        <th className="py-2.5 px-3">Estado</th>
                        <th className="py-2.5 px-3 text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-[#263632]">
                      {lotAnimals.map((animal) => {
                        const aStatus = ANIMAL_STATUS_LABELS[animal.status] || animal.status;
                        // Regla del ciclo reproductivo: una cerda en
                        // gestación no puede recibir otro servicio;
                        // su acción pasa a ser Registrar Destete / Parto.
                        const animalIsGestating = isGestatingAnimal(animal.status);
                        const statusColor = animalStatusClasses(animal.status);

                        return (
                          <tr key={animal.id} className="hover:bg-gray-50/60 dark:hover:bg-[#18221F]/60">
                            <td className="py-2.5 px-3">
                              <span className="font-mono font-bold text-[#1B4D3E] dark:text-[#4E9F3D]">
                                {safeText(animal.identifier)}
                              </span>
                              {animal.gender === 'hembra' && Number(animal.parity_count || 0) > 0 && (
                                <span className="block text-[9px] text-gray-400 font-normal">
                                  {animal.parity_count} partos · {animal.teats_count} pezones
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-gray-700 dark:text-gray-300">
                              {safeText(animal.breed, '—')}
                            </td>
                            <td className="py-2.5 px-3 capitalize text-gray-700 dark:text-gray-300">
                              {safeText(animal.gender)}
                            </td>
                            <td className="py-2.5 px-3">
                              <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${statusColor}`}>
                                {aStatus}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              <div className="flex items-center justify-end gap-1">
                                {/* Mortalidad */}
                                {isAnimalInProduction(animal.status) && (
                                  <button
                                    type="button"
                                    onClick={() => openMortalityModal(animal)}
                                    title="Registrar mortalidad"
                                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-[#263632] rounded-lg transition-colors cursor-pointer"
                                  >
                                    <Skull className="w-4 h-4" />
                                  </button>
                                )}
                                {/* Edición */}
                                <button
                                  type="button"
                                  onClick={() => openAnimalEditModal(animal)}
                                  title="Editar animal"
                                  className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-[#263632] rounded-lg transition-colors cursor-pointer"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                {/* Cosecha / Venta */}
                                {isAnimalInProduction(animal.status) && (
                                  <button
                                    type="button"
                                    onClick={() => openAnimalSaleModal(animal)}
                                    title="Cosecha / Venta individual"
                                    className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-[#263632] rounded-lg transition-colors cursor-pointer"
                                  >
                                    <DollarSign className="w-4 h-4" />
                                  </button>
                                )}
                                {/* Ciclo reproductivo: UN botón que se
                                    transforma según el estado de la cerda.
                                    - Activo → "Registrar Servicio"
                                      (inseminación / monta), que inicia
                                      la gestación.
                                    - Gestación → "Registrar Destete /
                                      Parto" (fecha de parto, total y
                                      lechones vivos); no puede recibir
                                      otro servicio hasta destetar.
                                    openServiceModal deriva el modo del
                                    modal desde el estado del animal, por
                                    lo que también bloquea por código
                                    cualquier servicio sobre una cerda
                                    gestante (y el backend lo rechaza). */}
                                {isAnimalInProduction(animal.status) && (
                                  <button
                                    type="button"
                                    onClick={() => openServiceModal(animal)}
                                    title={
                                      animalIsGestating
                                        ? 'Registrar Destete / Parto — la cerda está en gestación y no puede recibir otro servicio'
                                        : 'Registrar Servicio (inseminación / monta) — inicia la gestación de la cerda'
                                    }
                                    className={`p-1.5 text-gray-400 dark:hover:bg-[#263632] rounded-lg transition-colors cursor-pointer ${
                                      animalIsGestating
                                        ? 'hover:text-purple-600 hover:bg-purple-50'
                                        : 'hover:text-pink-600 hover:bg-pink-50'
                                    }`}
                                  >
                                    {animalIsGestating ? (
                                      <PigletHead className="w-4 h-4" />
                                    ) : (
                                      <HeartPulse className="w-4 h-4" />
                                    )}
                                  </button>
                                )}
                                {/* Historial de servicios */}
                                <button
                                  type="button"
                                  onClick={() => openServiceHistory(animal)}
                                  title="Historial de servicios"
                                  className="p-1.5 text-gray-400 hover:text-[#1B4D3E] dark:hover:text-[#4E9F3D] hover:bg-gray-100 dark:hover:bg-[#263632] rounded-lg transition-colors cursor-pointer"
                                >
                                  <History className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-gray-100 dark:border-[#263632] flex justify-end">
              <Button variant="outline" size="sm" onClick={() => setIsAnimalsModalOpen(false)}>
                Cerrar
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* 14. Modal: Editar Animal Individual */}
      <Modal
        isOpen={isAnimalEditModalOpen}
        onClose={() => setIsAnimalEditModalOpen(false)}
        title={`Editar Cerdo ${selectedAnimal ? safeText(selectedAnimal.identifier) : ''}`}
        maxWidth="lg"
      >
        {selectedAnimal && (
          <form onSubmit={handleAnimalEditSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="col-span-1 md:col-span-2 p-3 bg-gray-50 dark:bg-[#121816] rounded-xl border border-gray-200 dark:border-[#263632] flex items-center justify-between">
              <span className="font-bold text-xs">Lote: {safeText(selectedLot?.code)}</span>
              <span className="font-mono font-black text-xs text-[#1B4D3E] dark:text-[#4E9F3D]">
                ID: {safeText(selectedAnimal.identifier)}
              </span>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase mb-1">Raza</label>
              <input
                type="text"
                value={animalEditForm.breed}
                onChange={(e) => setAnimalEditForm((f) => ({ ...f, breed: e.target.value }))}
                className="w-full px-3.5 py-2.5 bg-[#F9F9F9] dark:bg-[#121816] border border-gray-200 dark:border-[#263632] rounded-xl text-xs focus:ring-2 focus:ring-[#1B4D3E] text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase mb-1">
                Sexo <span className="text-red-500">*</span>
              </label>
              <select
                value={animalEditForm.gender}
                onChange={(e) =>
                  setAnimalEditForm((f) => ({ ...f, gender: e.target.value as 'hembra' | 'macho' }))
                }
                className="w-full px-3.5 py-2.5 bg-[#F9F9F9] dark:bg-[#121816] border border-gray-200 dark:border-[#263632] rounded-xl text-xs focus:ring-2 focus:ring-[#1B4D3E] text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
              >
                <option value="hembra">Hembra</option>
                <option value="macho">Macho</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase mb-1">Raza Padre</label>
              <input
                type="text"
                value={animalEditForm.father_breed}
                onChange={(e) => setAnimalEditForm((f) => ({ ...f, father_breed: e.target.value }))}
                className="w-full px-3.5 py-2.5 bg-[#F9F9F9] dark:bg-[#121816] border border-gray-200 dark:border-[#263632] rounded-xl text-xs focus:ring-2 focus:ring-[#1B4D3E] text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase mb-1">Raza Madre</label>
              <input
                type="text"
                value={animalEditForm.mother_breed}
                onChange={(e) => setAnimalEditForm((f) => ({ ...f, mother_breed: e.target.value }))}
                className="w-full px-3.5 py-2.5 bg-[#F9F9F9] dark:bg-[#121816] border border-gray-200 dark:border-[#263632] rounded-xl text-xs focus:ring-2 focus:ring-[#1B4D3E] text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase mb-1">Fecha de Nacimiento</label>
              <input
                type="date"
                value={animalEditForm.birth_date}
                onChange={(e) => setAnimalEditForm((f) => ({ ...f, birth_date: e.target.value }))}
                className="w-full px-3.5 py-2.5 bg-[#F9F9F9] dark:bg-[#121816] border border-gray-200 dark:border-[#263632] rounded-xl text-xs focus:ring-2 focus:ring-[#1B4D3E] text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
              />
            </div>

            {animalEditForm.gender === 'hembra' && (
              <>
                <div>
                  <label className="block text-[11px] font-bold uppercase mb-1">Partos (paridad)</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={animalEditForm.parity_count}
                    onChange={(e) => setAnimalEditForm((f) => ({ ...f, parity_count: e.target.value }))}
                    className="w-full px-3.5 py-2.5 bg-[#F9F9F9] dark:bg-[#121816] border border-gray-200 dark:border-[#263632] rounded-xl text-xs focus:ring-2 focus:ring-[#1B4D3E] text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase mb-1">Pezones</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={animalEditForm.teats_count}
                    onChange={(e) => setAnimalEditForm((f) => ({ ...f, teats_count: e.target.value }))}
                    className="w-full px-3.5 py-2.5 bg-[#F9F9F9] dark:bg-[#121816] border border-gray-200 dark:border-[#263632] rounded-xl text-xs focus:ring-2 focus:ring-[#1B4D3E] text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
                  />
                </div>
                <div className="col-span-1 md:col-span-2">
                  <label className="block text-[11px] font-bold uppercase mb-1">Promedio de Lechones por Parto</label>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={animalEditForm.avg_piglets_per_birth}
                    onChange={(e) => setAnimalEditForm((f) => ({ ...f, avg_piglets_per_birth: e.target.value }))}
                    className="w-full px-3.5 py-2.5 bg-[#F9F9F9] dark:bg-[#121816] border border-gray-200 dark:border-[#263632] rounded-xl text-xs focus:ring-2 focus:ring-[#1B4D3E] text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
                  />
                </div>
              </>
            )}

            <div className="col-span-1 md:col-span-2 pt-3 border-t border-gray-100 dark:border-[#263632] flex items-center justify-end gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setIsAnimalEditModalOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" variant="accent" size="sm" disabled={isSubmitting} icon={<CheckCircle2 className="w-4 h-4" />}>
                {isSubmitting ? 'Guardando...' : 'Actualizar Animal'}
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* 15. Modal: Cosecha / Venta Individual */}
      <Modal
        isOpen={isAnimalSaleModalOpen}
        onClose={() => setIsAnimalSaleModalOpen(false)}
        title={`Cosecha / Venta — Cerdo ${selectedAnimal ? safeText(selectedAnimal.identifier) : ''}`}
        subtitle="Registra peso, precio y marca el animal como cosechado"
      >
        {selectedAnimal && (
          <form onSubmit={handleAnimalSaleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            {/* Peso de venta */}
            <div>
              <label className="block text-[11px] font-bold uppercase mb-1">
                Peso (kg) <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Ej. 115.5"
                  value={saleWeight}
                  onChange={(e) => setSaleWeight(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 bg-[#F9F9F9] dark:bg-[#121816] border border-gray-200 dark:border-[#263632] rounded-xl text-xs focus:ring-2 focus:ring-[#1B4D3E] text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
                />
                <Weight className="w-4 h-4 absolute right-3.5 top-2.5 text-gray-400" />
              </div>
            </div>

            {/* Precio por kilo */}
            <div>
              <label className="block text-[11px] font-bold uppercase mb-1">
                Precio por Kilo <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Ej. 3.50"
                  value={salePricePerKg}
                  onChange={(e) => setSalePricePerKg(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 bg-[#F9F9F9] dark:bg-[#121816] border border-gray-200 dark:border-[#263632] rounded-xl text-xs focus:ring-2 focus:ring-[#1B4D3E] text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
                />
                <DollarSign className="w-4 h-4 absolute right-3.5 top-2.5 text-gray-400" />
              </div>
            </div>

            {/* Total automático */}
            <div className="col-span-1 md:col-span-2 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-800/40 rounded-xl flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase text-amber-700 dark:text-amber-300">
                Total de Venta (automático)
              </span>
              <span className="text-lg font-black font-mono text-amber-800 dark:text-amber-200">
                {saleTotal !== null ? formatDecimal(saleTotal) : '—'}
              </span>
            </div>

            <div className="col-span-1 md:col-span-2 pt-3 border-t border-gray-100 dark:border-[#263632] flex items-center justify-end gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setIsAnimalSaleModalOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" variant="accent" size="sm" disabled={isSubmitting} icon={<DollarSign className="w-4 h-4" />}>
                {isSubmitting ? 'Registrando...' : 'Registrar Venta'}
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* 16. Modal: Registrar Mortalidad */}
      <Modal
        isOpen={isMortalityModalOpen}
        onClose={() => setIsMortalityModalOpen(false)}
        title="Registrar Mortalidad"
      >
        {selectedAnimal && (
          <div className="space-y-4 text-xs">
            <div className="p-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl flex items-start gap-3">
              <Skull className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-red-800 dark:text-red-200">
                  ¿Registrar la baja del cerdo {safeText(selectedAnimal.identifier)}?
                </p>
                <p className="text-red-700 dark:text-red-300 mt-1 leading-relaxed">
                  El animal pasará a estado <strong>"Muerto"</strong> por enfermedad o accidente y dejará de aparecer en la producción activa del lote.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setIsMortalityModalOpen(false)} disabled={isSubmitting}>
                Cancelar
              </Button>
              <Button variant="danger" size="sm" disabled={isSubmitting} onClick={handleMortalityConfirm} icon={<Skull className="w-3.5 h-3.5" />}>
                {isSubmitting ? 'Registrando...' : 'Confirmar Mortalidad'}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* 17. Modal: Servicio (inseminación / monta) o Destete / Parto */}
      <Modal
        isOpen={isServiceModalOpen}
        onClose={() => setIsServiceModalOpen(false)}
        title={
          serviceMode === 'destete'
            ? `Destete / Parto — Cerdo ${selectedAnimal ? safeText(selectedAnimal.identifier) : ''}`
            : `Servicio Reproductivo — Cerdo ${selectedAnimal ? safeText(selectedAnimal.identifier) : ''}`
        }
        subtitle={
          serviceMode === 'destete'
            ? 'Registro del parto y los lechones destetados'
            : 'Inseminación o monta con cálculo automático de gestación'
        }
        maxWidth="lg"
      >
        {selectedAnimal && (
          <form onSubmit={handleServiceSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            {serviceMode === 'destete' ? (
              <>
                {/* Destete / Parto: fecha del parto */}
                <div className="col-span-1 md:col-span-2">
                  <label className="block text-[11px] font-bold uppercase mb-1">
                    Fecha del Parto <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={serviceDate}
                    onChange={(e) => setServiceDate(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 bg-[#F9F9F9] dark:bg-[#121816] border border-gray-200 dark:border-[#263632] rounded-xl text-xs focus:ring-2 focus:ring-[#1B4D3E] text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
                  />
                </div>

                {/* Total de lechones */}
                <div>
                  <label className="block text-[11px] font-bold uppercase mb-1">
                    Total de Lechones <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    placeholder="Ej. 12"
                    value={totalPiglets}
                    onChange={(e) => setTotalPiglets(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 bg-[#F9F9F9] dark:bg-[#121816] border border-gray-200 dark:border-[#263632] rounded-xl text-xs focus:ring-2 focus:ring-[#1B4D3E] text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
                  />
                </div>

                {/* Lechones vivos */}
                <div>
                  <label className="block text-[11px] font-bold uppercase mb-1">
                    Lechones Vivos <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    placeholder="Ej. 11"
                    value={livePiglets}
                    onChange={(e) => setLivePiglets(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 bg-[#F9F9F9] dark:bg-[#121816] border border-gray-200 dark:border-[#263632] rounded-xl text-xs focus:ring-2 focus:ring-[#1B4D3E] text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
                  />
                  {!Number.isNaN(parseInt(livePiglets, 10)) && parseInt(livePiglets, 10) > 0 && (
                    <p className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-1 font-semibold">
                      ✓ Al guardar, la cerda vuelve a "Activo" y podrá abrir un nuevo lote con {livePiglets} lechones destetados (si hay cupo).
                    </p>
                  )}
                </div>
              </>
            ) : (
              <>
                {/* Tipo de servicio */}
                <div>
                  <label className="block text-[11px] font-bold uppercase mb-1">
                    Tipo de Servicio <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={serviceType}
                    onChange={(e) => setServiceType(e.target.value as 'inseminación' | 'monta')}
                    className="w-full px-3.5 py-2.5 bg-[#F9F9F9] dark:bg-[#121816] border border-gray-200 dark:border-[#263632] rounded-xl text-xs focus:ring-2 focus:ring-[#1B4D3E] text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
                  >
                    <option value="inseminación">Inseminación</option>
                    <option value="monta">Monta</option>
                  </select>
                </div>

                {/* Fecha del servicio */}
                <div>
                  <label className="block text-[11px] font-bold uppercase mb-1">
                    Fecha del Servicio <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={serviceDate}
                    onChange={(e) => setServiceDate(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 bg-[#F9F9F9] dark:bg-[#121816] border border-gray-200 dark:border-[#263632] rounded-xl text-xs focus:ring-2 focus:ring-[#1B4D3E] text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
                  />
                </div>

                {/* Fecha probable de parto: cálculo automático (114 días de gestación) */}
                <div>
                  <label className="block text-[11px] font-bold uppercase mb-1">
                    Fecha Probable de Parto
                    <span className="text-[9px] font-normal text-gray-400 ml-1.5">
                      (+{GESTATION_DAYS} días, automática)
                    </span>
                  </label>
                  <input
                    type="date"
                    value={probableBirthDate}
                    readOnly
                    className="w-full px-3.5 py-2.5 bg-gray-100 dark:bg-[#263632]/60 border border-gray-200 dark:border-[#263632] rounded-xl text-xs font-semibold text-gray-700 dark:text-gray-200 cursor-not-allowed select-none"
                  />
                  <p className="text-[10px] text-gray-400 mt-1">
                    Se calcula automáticamente desde la fecha del servicio sumando {GESTATION_DAYS} días.
                  </p>
                </div>
              </>
            )}

            <div className="col-span-1 md:col-span-2 pt-3 border-t border-gray-100 dark:border-[#263632] flex items-center justify-end gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setIsServiceModalOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" variant="accent" size="sm" disabled={isSubmitting} icon={serviceMode === 'destete' ? <PigletHead className="w-4 h-4" /> : <HeartPulse className="w-4 h-4" />}>
                {isSubmitting
                  ? 'Guardando...'
                  : serviceMode === 'destete'
                    ? 'Registrar Destete / Parto'
                    : 'Registrar Servicio'}
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* 18. Modal: Historial de Servicios del Animal */}
      <Modal
        isOpen={isServiceHistoryOpen}
        onClose={() => setIsServiceHistoryOpen(false)}
        title={`Historial de Servicios — Cerdo ${selectedAnimal ? safeText(selectedAnimal.identifier) : ''}`}
      >
        <div className="space-y-3 text-xs">
          {animalServices.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <History className="w-8 h-8 mx-auto text-gray-300 dark:text-gray-600 mb-2" />
              <p className="font-bold text-sm">Sin servicios registrados</p>
              <p className="text-[10px] text-gray-400 mt-0.5">
                Use la acción "Servicio" para registrar inseminaciones o montas.
              </p>
            </div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
              {animalServices.map((svc) => (
                <div
                  key={svc.id}
                  className="p-3 bg-gray-50 dark:bg-[#121816] border border-gray-200 dark:border-[#263632] rounded-xl"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-bold text-xs text-[#1E1E1E] dark:text-gray-200 capitalize flex items-center gap-1.5">
                      <HeartPulse className="w-3.5 h-3.5 text-pink-500" />
                      {safeText(svc.service_type)}
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-gray-200 dark:bg-[#263632] text-[10px] font-bold">
                      {safeText(svc.status)}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 text-[11px] text-gray-600 dark:text-gray-300">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-gray-400" />
                      Servicio: {safeText(svc.service_date)}
                    </span>
                    {svc.pregnancy_date && (
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-pink-400" />
                        Gestación: {safeText(svc.pregnancy_date)}
                      </span>
                    )}
                    {svc.birth_date && (
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-emerald-400" />
                        Parto: {safeText(svc.birth_date)}
                      </span>
                    )}
                    {Number(svc.total_piglets || 0) > 0 && (
                      <span className="flex items-center gap-1">
                        <PiggyBank className="w-3 h-3 text-gray-400" />
                        Lechones: {svc.total_piglets} ({svc.live_piglets} vivos)
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="pt-3 border-t border-gray-100 dark:border-[#263632] flex justify-end">
            <Button variant="outline" size="sm" onClick={() => setIsServiceHistoryOpen(false)}>
              Cerrar
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default LotesView;
