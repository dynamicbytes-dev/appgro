import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { speciesService, type SpeciesStats } from '../services/speciesService';
import { farmService } from '../services/farmService';
import type { Species, Farm } from '../types/auth';
import { SpeciesStatsCards } from '../components/species/SpeciesStatsCards';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { StatusBadge, normalizeIsActive } from '../components/ui/StatusBadge';
import { Modal } from '../components/ui/Modal';
import { ExportKpiPdfButton } from '../components/common/ExportKpiPdfButton';
import { safeText } from '../utils/safeText';
import {
  Layers,
  Plus,
  Search,
  Building2,
  Edit2,
  Power,
  Eye,
  RefreshCw,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Tag,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Calendar,
  Trash2,
} from 'lucide-react';

export interface OfficialCategory {
  id: string;
  name: string;
  value: string;
  animals: string[];
}

// Sectores pecuarios oficiales y sus tipos de animales (alineados con Species::TAXONOMY del backend).
// `value` se mantiene igual al valor canónico almacenado en BD para no romper registros ni filtros.
export const OFFICIAL_CATEGORIES: OfficialCategory[] = [
  { id: 'bovina', name: 'Bovino', value: 'Bovina', animals: ['Vaca', 'Toro', 'Búfalo'] },
  { id: 'avicola', name: 'Avícola', value: 'Avícola', animals: ['Pollo', 'Gallina', 'Codorniz'] },
  { id: 'porcina', name: 'Porcina', value: 'Porcina', animals: ['Cerdo'] },
  { id: 'cunicola', name: 'Cunícula', value: 'Cunícola', animals: ['Conejo'] },
  { id: 'ovina', name: 'Ovino', value: 'Ovina', animals: ['Oveja', 'Carnero', 'Cordero / Borrego'] },
  { id: 'caprina', name: 'Caprina', value: 'Caprina', animals: ['Cabra', 'Chivo'] },
];

const CUSTOM_ANIMAL_OPTION = '__custom__';

// Normaliza acentos, espacios alrededor de "/" y mayúsculas, replicando
// Species::normalizeKey() del backend. Esto hace que "Cordero / Borrego"
// (etiqueta visual) sea equivalente a "Cordero/Borrego" (valor canónico en BD),
// garantizando la validación de unicidad por granja y la clasificación oficial.
const normalizeText = (s: string) =>
  (s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s*\/\s*/g, '/')
    .trim()
    .toLowerCase();

export const findOfficialCategory = (raw: string): OfficialCategory | undefined => {
  const n = normalizeText(raw);
  return OFFICIAL_CATEGORIES.find(
    (c) => normalizeText(c.value) === n || normalizeText(c.name) === n || c.id === n
  );
};

export const SpeciesView: React.FC = () => {
  const { user, activeFarm, farms: authFarms } = useAuth();
  const { toastSuccess, toastError } = useToast();

  const roleUpper = (user?.role || '').toUpperCase();
  const isRoot = roleUpper === 'ROOT';

  // Data States
  const [speciesList, setSpeciesList] = useState<Species[]>([]);
  const [stats, setStats] = useState<SpeciesStats>({
    total_species: 0,
    active_species: 0,
    inactive_species: 0,
    categories_count: 0,
  });
  const [farmsList, setFarmsList] = useState<Farm[]>(() =>
    Array.isArray(authFarms) ? authFarms : []
  );
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [selectedRootFarmId, setSelectedRootFarmId] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 8;

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedSpecies, setSelectedSpecies] = useState<Species | null>(null);

  // Form States
  const [formName, setFormName] = useState('');
  const [formCategory, setFormCategory] = useState('');
  const [formIsActive, setFormIsActive] = useState(true);
  const [formFarmId, setFormFarmId] = useState<string>('');
  const [formError, setFormError] = useState<string | null>(null);
  const [formNameError, setFormNameError] = useState<string | null>(null);
  const [isCustomName, setIsCustomName] = useState(false);

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

  // Load Species from backend API
  const loadSpecies = async (silent = false) => {
    if (!silent) setIsLoading(true);
    setErrorMessage(null);
    try {
      const rawFarmId = isRoot
        ? selectedRootFarmId !== 'all'
          ? selectedRootFarmId
          : undefined
        : activeFarm?.id || user?.farm_id || (user?.farm && user.farm.id);
      const currentFarmId = rawFarmId ? rawFarmId : undefined;

      const data = await speciesService.getAll({
        farm_id: currentFarmId,
      });

      // Extrae la lista de especies con respaldo defensivo
      const speciesRows = Array.isArray(data?.data)
        ? data.data
        : Array.isArray(data)
        ? data
        : [];
      setSpeciesList(speciesRows);

      // Estado de estadísticas blindado con respaldos seguros
      const serverStats = data?.stats || {
        total_species: speciesRows.length,
        active_species: speciesRows.filter((s: any) => normalizeIsActive(s.is_active)).length,
        inactive_species: speciesRows.filter((s: any) => !normalizeIsActive(s.is_active)).length,
        categories_count: new Set(
          speciesRows.map((s: any) => (s.category || '').toLowerCase().trim()).filter(Boolean)
        ).size,
      };

      setStats({
        total_species: Number(serverStats?.total_species ?? serverStats?.totalSpecies ?? speciesRows.length),
        active_species: Number(
          serverStats?.active_species ??
            serverStats?.activeSpecies ??
            speciesRows.filter((s: any) => normalizeIsActive(s.is_active)).length
        ),
        inactive_species: Number(
          serverStats?.inactive_species ??
            serverStats?.inactiveSpecies ??
            Math.max(
              0,
              (serverStats?.total_species ?? speciesRows.length) -
                (serverStats?.active_species ??
                  speciesRows.filter((s: any) => normalizeIsActive(s.is_active)).length)
            )
        ),
        categories_count: Number(
          serverStats?.categories_count ??
            serverStats?.categoriesCount ??
            new Set(
              speciesRows.map((s: any) => (s.category || '').toLowerCase().trim()).filter(Boolean)
            ).size
        ),
      });
    } catch (err: any) {
      console.error('Error al cargar especies:', err);
      const msg = err.response?.data?.message || 'Error al cargar las especies de la granja.';
      setErrorMessage(msg);
      toastError('Error al Cargar', msg);
      if (!silent) {
        setSpeciesList([]);
        setStats({
          total_species: 0,
          active_species: 0,
          inactive_species: 0,
          categories_count: 0,
        });
      }
    } finally {
      if (!silent) setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSpecies();
  }, [selectedRootFarmId]);

  // Reset Form
  const resetForm = () => {
    setFormName('');
    setFormCategory('');
    setFormIsActive(true);
    setFormError(null);
    setFormNameError(null);
    setIsCustomName(false);
    const defaultFarmId = activeFarm?.id || user?.farm_id || (farmsList[0]?.id ? String(farmsList[0].id) : '');
    setFormFarmId(String(defaultFarmId || ''));
  };

  // Open Create Modal
  const openCreateModal = () => {
    resetForm();
    setIsCreateModalOpen(true);
  };

  // Open Edit Modal
  const openEditModal = (sp: Species) => {
    setFormError(null);
    setFormNameError(null);
    setSelectedSpecies(sp);
    setFormName(sp.name || '');
    const matchedCategory = findOfficialCategory(sp.category || '');
    setFormCategory(matchedCategory ? matchedCategory.value : (sp.category || ''));
    const isOfficialAnimal = !!matchedCategory?.animals.some(
      (a) => normalizeText(a) === normalizeText(sp.name || '')
    );
    setIsCustomName(!isOfficialAnimal);
    setFormIsActive(Boolean(sp.is_active));
    setFormFarmId(String(sp.farm_id || ''));
    setIsEditModalOpen(true);
  };

  // Helper to parse validation and duplicate errors from API responses (422 Unprocessable Entity)
  const parseSpeciesApiError = (err: any, defaultMsg: string) => {
    const is422 = err?.response?.status === 422;
    // Captura específica del campo 'name' (ej: error.response.data.errors.name[0])
    const nameFieldError =
      err?.response?.data?.errors?.name?.[0] ||
      (typeof err?.response?.data?.errors?.name === 'string'
        ? err.response.data.errors.name
        : null);
    const serverMessage = err?.response?.data?.message || '';
    const DUPLICATE_TEXT = 'Ya existe una especie con este nombre en la granja.';

    let isDuplicate = false;
    let mainError = defaultMsg;
    let fieldError: string | null = null;

    if (nameFieldError) {
      const isUniqueConflict =
        /existe|duplicad|unique|ya existe/i.test(nameFieldError) ||
        /existe|duplicad|unique/i.test(serverMessage) ||
        is422;

      if (isUniqueConflict) {
        isDuplicate = true;
        mainError = DUPLICATE_TEXT;
        fieldError = DUPLICATE_TEXT;
      } else {
        mainError = nameFieldError;
        fieldError = nameFieldError;
      }
    } else if (/existe|duplicad|unique|ya existe/i.test(serverMessage)) {
      isDuplicate = true;
      mainError = DUPLICATE_TEXT;
      fieldError = DUPLICATE_TEXT;
    } else if (is422) {
      const anyErrors = err?.response?.data?.errors;
      if (anyErrors && typeof anyErrors === 'object') {
        const firstKey = Object.keys(anyErrors)[0];
        const val = anyErrors[firstKey];
        const firstMsg = Array.isArray(val) ? val[0] : String(val);
        if (/existe|duplicad|unique|ya existe/i.test(firstMsg)) {
          isDuplicate = true;
          mainError = DUPLICATE_TEXT;
          fieldError = DUPLICATE_TEXT;
        } else {
          mainError = firstMsg || serverMessage || 'Error de validación.';
          if (firstKey === 'name') fieldError = mainError;
        }
      } else {
        mainError = serverMessage || 'Error de validación de datos.';
      }
    } else {
      mainError = serverMessage || defaultMsg;
    }

    return { isDuplicate, mainError, fieldError };
  };

  // Nombres ya registrados en la granja destino (pre-validación visual de unicidad)
  const getTakenNames = (mode: 'create' | 'edit'): Set<string> => {
    const farmId =
      mode === 'edit'
        ? String(selectedSpecies?.farm_id ?? '')
        : String(
            (isRoot ? formFarmId : activeFarm?.id || user?.farm_id || user?.farm?.id) ?? ''
          );
    return new Set(
      speciesList
        .filter((s) => !farmId || String(s.farm_id ?? '') === farmId)
        .filter((s) => !(mode === 'edit' && selectedSpecies && s.id === selectedSpecies.id))
        .map((s) => normalizeText(s.name || ''))
    );
  };

  const clearNameErrors = () => {
    if (formNameError) setFormNameError(null);
    if (formError) setFormError(null);
  };

  const handleCategoryChange = (value: string) => {
    setFormCategory(value);
    clearNameErrors();
    const cat = findOfficialCategory(value);
    const stillValid = cat?.animals.some((a) => normalizeText(a) === normalizeText(formName));
    if (!isCustomName && !stillValid) setFormName('');
  };

  const handleAnimalSelect = (value: string) => {
    clearNameErrors();
    if (value === CUSTOM_ANIMAL_OPTION) {
      setIsCustomName(true);
      setFormName('');
    } else {
      setIsCustomName(false);
      setFormName(value);
    }
  };

  // Campos compartidos: Sector Pecuario + Tipo de Animal (create / edit)
  const renderSpeciesFields = (mode: 'create' | 'edit') => {
    const currentCat = findOfficialCategory(formCategory);
    const takenNames = getTakenNames(mode);
    const isLegacyCategory = !!formCategory && !currentCat;
    const selectBase =
      'w-full px-3.5 py-2.5 bg-[#F9F9F9] dark:bg-[#121816] rounded-xl text-xs text-[#1E1E1E] dark:text-gray-200 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed';
    const okBorder =
      'border border-gray-200 dark:border-[#263632] focus:ring-2 focus:ring-[#1B4D3E]';
    const errBorder =
      'border-2 border-red-500 focus:ring-2 focus:ring-red-500/20 bg-red-50/10 dark:bg-red-950/20';
    const animalSelectValue = isCustomName
      ? CUSTOM_ANIMAL_OPTION
      : currentCat?.animals.find((a) => normalizeText(a) === normalizeText(formName)) || '';

    return (
      <>
        {/* Sector Pecuario */}
        <div>
          <label
            htmlFor={`${mode}-species-category`}
            className="block text-[11px] font-bold text-[#1E1E1E] dark:text-gray-200 uppercase mb-1"
          >
            Sector Pecuario <span className="text-red-500">*</span>
          </label>
          <select
            id={`${mode}-species-category`}
            value={currentCat ? currentCat.value : formCategory}
            onChange={(e) => handleCategoryChange(e.target.value)}
            required
            className={`${selectBase} ${okBorder} text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500`}
          >
            <option value="" disabled>
              Selecciona el sector pecuario oficial...
            </option>
            {OFFICIAL_CATEGORIES.map((cat) => (
              <option key={`${mode}-cat-${cat.id}`} value={cat.value}>
                {cat.name}
              </option>
            ))}
            {isLegacyCategory && (
              <option key={`${mode}-cat-legacy`} value={formCategory}>
                {formCategory} (Sector actual)
              </option>
            )}
          </select>
        </div>

        {/* Tipo de Animal */}
        <div>
          <label
            htmlFor={`${mode}-species-animal`}
            className="block text-[11px] font-bold text-[#1E1E1E] dark:text-gray-200 uppercase mb-1"
          >
            Tipo de Animal <span className="text-red-500">*</span>
          </label>
          <select
            id={`${mode}-species-animal`}
            value={animalSelectValue}
            onChange={(e) => handleAnimalSelect(e.target.value)}
            disabled={!formCategory}
            required={!isCustomName}
            className={`${selectBase} ${formNameError && !isCustomName ? errBorder : okBorder} text-gray-700 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500`}
          >
            <option value="" disabled>
              {formCategory ? 'Selecciona el tipo de animal...' : 'Primero selecciona un sector...'}
            </option>
            {currentCat && (
              <optgroup label={`Sector ${currentCat.name}`}>
                {currentCat.animals.map((animal) => {
                  const taken = takenNames.has(normalizeText(animal));
                  return (
                    <option
                      key={`${mode}-animal-${currentCat.id}-${animal}`}
                      value={animal}
                      disabled={taken}
                    >
                      {animal}
                      {taken ? ' (ya registrada)' : ''}
                    </option>
                  );
                })}
              </optgroup>
            )}
            <option key={`${mode}-animal-custom`} value={CUSTOM_ANIMAL_OPTION}>
              ➕ Otro / Registrar nueva variante...
            </option>
          </select>

          {isCustomName && (
            <input
              id={`${mode}-species-name-custom`}
              type="text"
              autoFocus
              placeholder="Ej. Cerdo de Engorde, Vaca Holstein, Pollo Broiler..."
              value={formName}
              onChange={(e) => {
                const value = e.target.value;
                setFormName(value);
                setFormError(null);
                // Pre-validación en vivo de unicidad por granja (nombres personalizados)
                setFormNameError(
                  value.trim() && takenNames.has(normalizeText(value))
                    ? 'Ya existe una especie con este nombre en la granja.'
                    : null
                );
              }}
              required
              className={`mt-2 w-full px-3.5 py-2.5 bg-[#F9F9F9] dark:bg-[#121816] rounded-xl text-xs transition-colors ${ formNameError ? errBorder : okBorder } text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500`}
            />
          )}

          {formNameError ? (
            <p className="text-[11px] text-red-600 dark:text-red-400 font-medium mt-1 flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              {formNameError}
            </p>
          ) : (
            <p className="text-[10px] text-gray-400 mt-1">
              {currentCat
                ? `Tipos oficiales del sector ${currentCat.name}: ${currentCat.animals.join(', ')}.`
                : 'Bovino, Avícola, Porcina, Cunícula, Ovino o Caprina.'}
            </p>
          )}
        </div>
      </>
    );
  };

  // Open Detail Modal
  const openDetailModal = (sp: Species) => {
    setSelectedSpecies(sp);
    setIsDetailModalOpen(true);
  };

  // Open Toggle Status Confirm Modal
  const openConfirmToggle = (sp: Species) => {
    setSelectedSpecies(sp);
    setIsConfirmModalOpen(true);
  };

  // Open Delete Confirm Modal
  const openDeleteModal = (sp: Species) => {
    setSelectedSpecies(sp);
    setIsDeleteModalOpen(true);
  };

  // Submit Handler: Create Species
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      toastError('Campo Requerido', 'Ingresa el nombre de la especie.');
      return;
    }
    if (!formCategory.trim()) {
      toastError('Campo Requerido', 'Selecciona el sector pecuario oficial.');
      return;
    }

    const targetFarmId = isRoot
      ? formFarmId || activeFarm?.id || user?.farm_id
      : activeFarm?.id || user?.farm_id || (user?.farm && user.farm.id);

    if (isRoot && !targetFarmId) {
      toastError('Granja Requerida', 'Selecciona la granja a la cual pertenecerá la especie.');
      return;
    }

    setFormError(null);
    setFormNameError(null);
    setIsSubmitting(true);
    try {
      const newSpecies = await speciesService.create({
        name: formName.trim(),
        category: formCategory.trim(),
        is_active: formIsActive,
        farm_id: targetFarmId ? targetFarmId : undefined,
      });

      setSpeciesList((prev) => [newSpecies, ...prev]);

      // Actualización automática e inmediata de las tarjetas métricas
      const isNewActive = normalizeIsActive(newSpecies.is_active);
      setStats((prev) => ({
        total_species: (prev.total_species || speciesList.length) + 1,
        active_species: (prev.active_species || 0) + (isNewActive ? 1 : 0),
        inactive_species: (prev.inactive_species || 0) + (isNewActive ? 0 : 1),
        categories_count: prev.categories_count || 1,
      }));

      setSuccessMessage(`Especie "${formName.trim()}" registrada con éxito.`);
      toastSuccess('Especie Creada', `Se registró "${formName.trim()}" en el catálogo.`);
      setIsCreateModalOpen(false);
      resetForm();
      loadSpecies(true);
    } catch (err: any) {
      const { isDuplicate, mainError, fieldError } = parseSpeciesApiError(
        err,
        'Error al registrar la especie.'
      );
      setFormError(mainError);
      if (fieldError) {
        setFormNameError(fieldError);
      }
      if (isDuplicate) {
        toastError('Especie Duplicada', 'Ya existe una especie con este nombre en la granja.');
      } else {
        toastError('Error al Guardar', mainError);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit Handler: Edit Species
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSpecies) return;

    if (!formName.trim()) {
      toastError('Campo Requerido', 'Ingresa el nombre de la especie.');
      return;
    }
    if (!formCategory.trim()) {
      toastError('Campo Requerido', 'Selecciona el sector pecuario oficial.');
      return;
    }

    setFormError(null);
    setFormNameError(null);
    setIsSubmitting(true);
    try {
      const updated = await speciesService.update(selectedSpecies.id, {
        name: formName.trim(),
        category: formCategory.trim(),
        is_active: formIsActive,
      });

      setSpeciesList((prev) =>
        prev.map((s) => (s.id === selectedSpecies.id ? { ...s, ...updated } : s))
      );

      // Actualizar métricas si el estado de activación cambió
      const prevActive = normalizeIsActive(selectedSpecies.is_active);
      const nextActive = normalizeIsActive(formIsActive);
      if (prevActive !== nextActive) {
        setStats((prev) => ({
          ...prev,
          active_species: Math.max(0, (prev.active_species || 0) + (nextActive ? 1 : -1)),
          inactive_species: Math.max(0, (prev.inactive_species || 0) + (nextActive ? -1 : 1)),
        }));
      }

      setSuccessMessage(`Especie "${formName.trim()}" actualizada correctamente.`);
      toastSuccess('Especie Actualizada', `Se guardaron los cambios de "${formName.trim()}".`);
      setIsEditModalOpen(false);
      loadSpecies(true);
    } catch (err: any) {
      const { isDuplicate, mainError, fieldError } = parseSpeciesApiError(
        err,
        'Error al actualizar la especie.'
      );
      setFormError(mainError);
      if (fieldError) {
        setFormNameError(fieldError);
      }
      if (isDuplicate) {
        toastError('Especie Duplicada', 'Ya existe una especie con este nombre en la granja.');
      } else {
        toastError('Error al Guardar', mainError);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Toggle Active Status
  const handleToggleStatus = async () => {
    if (!selectedSpecies) return;

    const currentStatus = normalizeIsActive(selectedSpecies.is_active);
    const newStatus = !currentStatus;
    setIsSubmitting(true);
    try {
      await speciesService.toggleStatus(selectedSpecies.id, newStatus);

      setSpeciesList((prev) =>
        prev.map((s) => (s.id === selectedSpecies.id ? { ...s, is_active: newStatus } : s))
      );

      // Actualización automática de las tarjetas métricas
      setStats((prev) => ({
        ...prev,
        active_species: Math.max(0, (prev.active_species || 0) + (newStatus ? 1 : -1)),
        inactive_species: Math.max(0, (prev.inactive_species || 0) + (newStatus ? -1 : 1)),
      }));

      toastSuccess(
        `Especie ${newStatus ? 'Habilitada' : 'Inhabilitada'}`,
        `"${selectedSpecies.name}" ahora está ${newStatus ? 'activa' : 'inactiva'}.`
      );
      setIsConfirmModalOpen(false);
      loadSpecies(true);
    } catch (err: any) {
      toastError(
        'Error de Estado',
        err.response?.data?.message || 'No se pudo cambiar el estado de la especie.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete Species: confirma, ejecuta DELETE y filtra el estado local (optimista)
  const handleDelete = async () => {
    if (!selectedSpecies) return;

    const speciesToDelete = selectedSpecies;
    setIsDeleting(true);
    try {
      await speciesService.delete(speciesToDelete.id);

      // Actualización optimista: la especie desaparece de la tabla sin recargar
      setSpeciesList((prev) =>
        prev.filter((s) => s.id !== speciesToDelete.id)
      );

      // Ajuste inmediato de las métricas del catálogo
      const wasActive = normalizeIsActive(speciesToDelete.is_active);
      setStats((prev) => ({
        ...prev,
        total_species: Math.max(0, (prev.total_species || 0) - 1),
        active_species: Math.max(
          0,
          (prev.active_species || 0) - (wasActive ? 1 : 0)
        ),
        inactive_species: Math.max(
          0,
          (prev.inactive_species || 0) - (wasActive ? 0 : 1)
        ),
      }));

      setIsDeleteModalOpen(false);
      setSelectedSpecies(null);
      setSuccessMessage(
        `Especie "${speciesToDelete.name}" eliminada correctamente.`
      );
      toastSuccess(
        'Especie Eliminada',
        `"${speciesToDelete.name}" se eliminó del catálogo.`
      );
      loadSpecies(true);
    } catch (err: any) {
      console.error('Error al eliminar especie:', err);
      const status = err?.response?.status;
      // Motivo exacto devuelto por la API (ej. 422 por galpones asociados)
      const serverMsg = err?.response?.data?.message;
      const errs = err?.response?.data?.errors;
      const firstFieldError = errs ? Object.values(errs)[0] : null;
      const detail =
        serverMsg ||
        (Array.isArray(firstFieldError) ? firstFieldError[0] : firstFieldError) ||
        null;

      const msg = detail || 'No se pudo eliminar la especie.';
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

  // Filtered List
  const filteredSpecies = useMemo(() => {
    return (speciesList || []).filter((sp) => {
      const q = searchTerm.toLowerCase().trim();
      const name = (sp?.name || '').toLowerCase();
      const cat = (sp?.category || '').toLowerCase();
      const farmName = (sp?.farm?.name || '').toLowerCase();

      const matchesSearch = !q || name.includes(q) || cat.includes(q) || farmName.includes(q);

      const isAct = normalizeIsActive(sp?.is_active);
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && isAct) ||
        (statusFilter === 'inactive' && !isAct);

      const matchesCategory =
        categoryFilter === 'all' ||
        cat.toLowerCase() === categoryFilter.toLowerCase();

      return matchesSearch && matchesStatus && matchesCategory;
    });
  }, [speciesList, searchTerm, statusFilter, categoryFilter]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredSpecies.length / pageSize));
  const paginatedSpecies = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredSpecies.slice(start, start + pageSize);
  }, [filteredSpecies, currentPage, pageSize]);

  // Evita quedarse en una página vacía tras eliminar registros
  useEffect(() => {
    if (
      currentPage > 1 &&
      filteredSpecies.length > 0 &&
      paginatedSpecies.length === 0
    ) {
      setCurrentPage((prev) => Math.max(1, prev - 1));
    }
  }, [currentPage, filteredSpecies.length, paginatedSpecies.length]);

  const farmTitle = isRoot
    ? 'Consola Global Root'
    : activeFarm?.name || user?.farmName || (user?.farm && (user.farm as any).name) || 'Granja Agropecuaria';

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* 1. Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-[#18221F] p-6 rounded-2xl border border-gray-200 dark:border-[#263632] shadow-sm">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#4E9F3D]/10 text-[#4E9F3D] text-[11px] font-bold mb-1.5 border border-[#4E9F3D]/20">
            {isRoot ? <ShieldCheck className="w-3.5 h-3.5" /> : <Building2 className="w-3.5 h-3.5" />}
            <span>{safeText(farmTitle)}</span>
          </div>
          <h1 className="text-xl font-black text-[#1E1E1E] dark:text-gray-100 flex items-center gap-2">
            <Layers className="w-6 h-6 text-[#1B4D3E] dark:text-[#4E9F3D]" />
            Gestión de Especies Pecuarias
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Catálogo de especies animales, razas y clasificación por sector pecuario de producción.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadSpecies()}
            disabled={isLoading}
            className="whitespace-nowrap"
            icon={<RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />}
          >
            Actualizar Lista
          </Button>
          <ExportKpiPdfButton
            className="whitespace-nowrap"
            moduleTitle="Módulo de Especies Pecuarias"
            moduleSlug="especies"
            kpis={[
              {
                title: 'Total Especies',
                value: speciesList.length,
                subtitle: 'Catálogo registrado',
                tone: 'slate',
              },
              {
                title: 'Especies Activas',
                value: speciesList.filter((s) => normalizeIsActive(s.is_active)).length,
                subtitle: 'Disponibles en galpones',
                tone: 'emerald',
              },
              {
                title: 'Inactivas / Pausadas',
                value: Math.max(
                  0,
                  speciesList.length - speciesList.filter((s) => normalizeIsActive(s.is_active)).length
                ),
                subtitle: 'Fuera de producción',
                tone: 'amber',
              },
              {
                title: 'Sectores Pecuarios',
                value: new Set(speciesList.map((s) => s.category).filter(Boolean)).size || 6,
                subtitle: 'Categorías oficiales',
                tone: 'emerald',
              },
            ]}
            diagnosis={`Inventario pecuario con ${
              speciesList.filter((s) => normalizeIsActive(s.is_active)).length
            } especies activas de un total de ${
              speciesList.length
            } registradas, abarcando ${
              new Set(speciesList.map((s) => s.category).filter(Boolean)).size || 6
            } sectores pecuarios oficiales sin anomalías taxonómicas.`}
            columns={['Código', 'Nombre Común', 'Sector Pecuario', 'Estado']}
            rows={speciesList.map((s) => [
              `ESP-${s.id}`,
              s.name,
              s.category || 'General',
              normalizeIsActive(s.is_active) ? 'Activa' : 'Inactiva',
            ])}
          />
          <Button
            variant="accent"
            size="sm"
            onClick={openCreateModal}
            className="whitespace-nowrap"
            icon={<Plus className="w-4 h-4" />}
          >
            Nueva Especie
          </Button>
        </div>
      </div>

      {/* 2. Quick Summary Metrics Cards (Componente Único de KPIs) */}
      <SpeciesStatsCards stats={stats} speciesList={speciesList} isLoading={isLoading} />

      {/* Notifications */}
      {successMessage && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs text-emerald-800 dark:text-emerald-300 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#4E9F3D] shrink-0" />
            <span>{safeText(successMessage)}</span>
          </div>
          <button onClick={() => setSuccessMessage(null)} className="font-bold text-xs text-emerald-800 dark:text-emerald-300">✕</button>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 rounded-xl text-xs text-red-700 dark:text-red-300 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{safeText(errorMessage)}</span>
          </div>
          <button onClick={() => setErrorMessage(null)} className="font-bold text-xs text-red-600">✕</button>
        </div>
      )}

      {/* 3. Search and Filters Card */}
      <Card className="p-4 bg-white dark:bg-[#18221F] border border-gray-200 dark:border-[#263632]">
        <div className="flex flex-col md:flex-row items-center justify-between gap-3">
          {/* Live Search */}
          <div className="relative w-full md:w-96">
            <Search className="w-4 h-4 absolute left-3.5 top-3 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por nombre o sector pecuario..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-10 pr-4 py-2 bg-[#F9F9F9] dark:bg-[#121816] border border-gray-200 dark:border-[#263632] rounded-xl text-xs focus:ring-2 focus:ring-[#1B4D3E] text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            {/* Sector / Category Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-gray-500 font-medium">Sector:</span>
              <select
                value={categoryFilter}
                onChange={(e) => {
                  setCategoryFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="px-3 py-1.5 bg-[#F9F9F9] dark:bg-[#121816] border border-gray-200 dark:border-[#263632] rounded-xl text-xs focus:ring-2 focus:ring-[#1B4D3E] text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
              >
                <option value="all">Todos los sectores</option>
                {OFFICIAL_CATEGORIES.map((cat) => (
                  <option key={`filter-cat-${cat.id}`} value={cat.value}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Status Selector */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-gray-500 font-medium">Estado:</span>
              <select
                value={statusFilter}
                onChange={(e: any) => {
                  setStatusFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="px-3 py-1.5 bg-[#F9F9F9] dark:bg-[#121816] border border-gray-200 dark:border-[#263632] rounded-xl text-xs focus:ring-2 focus:ring-[#1B4D3E] text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
              >
                <option value="all">Todos los estados</option>
                <option value="active">Activas</option>
                <option value="inactive">Inactivas</option>
              </select>
            </div>

            {/* Root Farm Selector */}
            {isRoot && farmsList.length > 0 && (
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-gray-500 font-medium">Granja:</span>
                <select
                  value={selectedRootFarmId}
                  onChange={(e) => {
                    setSelectedRootFarmId(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="px-3 py-1.5 bg-[#F9F9F9] dark:bg-[#121816] border border-gray-200 dark:border-[#263632] rounded-xl text-xs focus:ring-2 focus:ring-[#1B4D3E] text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
                >
                  <option value="all">Todas las granjas</option>
                  {farmsList.map((f) => (
                    <option key={f.id} value={String(f.id)}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* 4. Species Clean Data Table */}
      <Card className="overflow-hidden bg-white dark:bg-[#18221F] border border-gray-200 dark:border-[#263632]">
        {isLoading ? (
          <div key="species-loading-state" className="p-16 text-center text-xs text-gray-500">
            <RefreshCw className="w-7 h-7 animate-spin mx-auto text-[#1B4D3E] dark:text-[#4E9F3D] mb-3" />
            <p className="font-bold text-sm text-[#1E1E1E] dark:text-gray-200">
              Cargando catálogo de especies...
            </p>
            <p className="text-xs text-gray-400 mt-1">Consultando información pecuaria de la granja.</p>
          </div>
        ) : (
          <div key="species-table-wrapper" className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#F9F9F9] dark:bg-[#121816] border-b border-gray-200 dark:border-[#263632] text-[11px] font-bold uppercase text-[#1E1E1E] dark:text-gray-400 tracking-wider">
                  <th className="py-3.5 px-4">Nombre</th>
                  <th className="py-3.5 px-4">Categoría / Sector Pecuario</th>
                  <th className="py-3.5 px-4 text-center">Estado</th>
                  <th className="py-3.5 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-[#263632] text-xs">
                {paginatedSpecies.length === 0 ? (
                  <tr key="species-empty-row">
                    <td colSpan={4} className="py-12 text-center text-gray-500">
                      <div className="max-w-sm mx-auto text-center space-y-2">
                        <Layers className="w-8 h-8 mx-auto text-gray-300 dark:text-gray-600" />
                        <p className="font-bold text-sm text-[#1E1E1E] dark:text-gray-200">
                          No se encontraron especies registradas
                        </p>
                        <p className="text-xs text-gray-400">
                          {searchTerm || statusFilter !== 'all' || categoryFilter !== 'all'
                            ? 'No hay registros que coincidan con los filtros aplicados.'
                            : 'Comienza creando la primera especie pecuaria de la granja.'}
                        </p>
                        <Button
                          variant="accent"
                          size="sm"
                          onClick={openCreateModal}
                          className="mt-2"
                          icon={<Plus className="w-3.5 h-3.5" />}
                        >
                          Nueva Especie
                        </Button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedSpecies.map((species) => {
                    const spName = safeText(species?.name, 'Especie sin nombre');
                    const spInitial = (spName.charAt(0) || 'E').toUpperCase();
                    const spCategory = safeText(species?.category, 'Sin sector');
                    const isActive = normalizeIsActive(species?.is_active);

                    return (
                      <tr
                        key={species.id}
                        className="hover:bg-gray-50/60 dark:hover:bg-[#18221F]/60 transition-colors"
                      >
                        {/* 1. Nombre */}
                        <td className="py-3.5 px-4 font-bold text-[#1E1E1E] dark:text-gray-100">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-[#1B4D3E]/10 dark:bg-[#4E9F3D]/20 text-[#1B4D3E] dark:text-[#4E9F3D] flex items-center justify-center font-black text-xs shrink-0">
                              {spInitial}
                            </div>
                            <div>
                              <span className="block font-bold text-xs text-[#1E1E1E] dark:text-gray-100 leading-tight">
                                {spName}
                              </span>
                              {species.farm?.name && (
                                <span className="text-[10px] text-gray-400 font-normal flex items-center gap-1 mt-0.5">
                                  <Building2 className="w-2.5 h-2.5 text-[#4E9F3D]" />
                                  {safeText(species.farm.name)}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* 2. Categoría / Sector Pecuario */}
                        <td className="py-3.5 px-4 font-medium text-gray-700 dark:text-gray-300">
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-[#121816] border border-emerald-200/60 dark:border-[#263632] text-xs font-semibold text-[#1B4D3E] dark:text-[#4E9F3D]">
                            <Tag className="w-3 h-3 text-[#4E9F3D]" />
                            <span>{spCategory}</span>
                          </div>
                        </td>

                        {/* 3. Estado */}
                        <td className="py-3.5 px-4 text-center">
                          <StatusBadge isActive={species.is_active} gender="female" />
                        </td>

                        {/* 4. Acciones (Ver, Editar, Inhabilitar, Eliminar) */}
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Ver detalle */}
                            <button
                              type="button"
                              onClick={() => openDetailModal(species)}
                              title="Ver ficha técnica"
                              className="p-1.5 text-gray-400 hover:text-[#1B4D3E] dark:hover:text-[#4E9F3D] hover:bg-gray-100 dark:hover:bg-[#263632] rounded-lg transition-colors cursor-pointer"
                            >
                              <Eye className="w-4 h-4" />
                            </button>

                            {/* Editar */}
                            <button
                              type="button"
                              onClick={() => openEditModal(species)}
                              title="Editar especie"
                              className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-[#263632] rounded-lg transition-colors cursor-pointer"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>

                            {/* Inhabilitar / Habilitar */}
                            <button
                              type="button"
                              onClick={() => openConfirmToggle(species)}
                              title={isActive ? 'Inhabilitar especie' : 'Habilitar especie'}
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
                              onClick={() => openDeleteModal(species)}
                              title="Eliminar especie"
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

        {/* Pagination Footer */}
        <div className="p-4 bg-[#F9F9F9] dark:bg-[#121816] border-t border-gray-200 dark:border-[#263632] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-500">
          <div>
            Mostrando{' '}
            <span className="font-bold text-[#1E1E1E] dark:text-gray-200">
              {paginatedSpecies.length}
            </span>{' '}
            de{' '}
            <span className="font-bold text-[#1E1E1E] dark:text-gray-200">
              {filteredSpecies.length}
            </span>{' '}
            especies
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage <= 1 || isLoading}
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              icon={<ChevronLeft className="w-3.5 h-3.5" />}
            >
              Anterior
            </Button>

            <span className="px-3 py-1 bg-white dark:bg-[#18221F] border border-gray-200 dark:border-[#263632] rounded-xl font-bold text-xs text-[#1E1E1E] dark:text-gray-200">
              {currentPage} / {totalPages}
            </span>

            <Button
              variant="outline"
              size="sm"
              disabled={currentPage >= totalPages || isLoading}
              onClick={() => setCurrentPage((prev) => prev + 1)}
            >
              Siguiente
              <ChevronRight className="w-3.5 h-3.5 ml-1 inline" />
            </Button>
          </div>
        </div>
      </Card>

      {/* 5. Modal: Registrar Nueva Especie */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => {
          setIsCreateModalOpen(false);
          setFormError(null);
          setFormNameError(null);
        }}
        title="Registrar Nueva Especie Pecuaria"
        maxWidth="xl"
      >
        <form onSubmit={handleCreateSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          {/* Banner de Error / Duplicado */}
          {formError && (
            <div className="col-span-1 md:col-span-2 p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/60 rounded-xl text-xs text-red-700 dark:text-red-300 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold">{formError}</p>
              </div>
            </div>
          )}

          {renderSpeciesFields('create')}

          {/* Farm selection for ROOT */}
          {isRoot && farmsList.length > 0 && (
            <div className="col-span-1 md:col-span-2">
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
                  <option key={f.id} value={String(f.id)}>
                    {f.name} {f.code ? `(${f.code})` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Active status */}
          <div className="col-span-1 md:col-span-2 p-3 bg-gray-50 dark:bg-[#121816] rounded-xl border border-gray-200 dark:border-[#263632] flex items-center justify-between">
            <div>
              <span className="font-bold text-xs text-[#1E1E1E] dark:text-gray-200 block">
                Estado Activo Inicial
              </span>
              <span className="text-[10px] text-gray-400">
                La especie estará disponible inmediatamente para asignación a galpones y lotes.
              </span>
            </div>
            <input
              type="checkbox"
              checked={formIsActive}
              onChange={(e) => setFormIsActive(e.target.checked)}
              className="w-4 h-4 text-[#1B4D3E] focus:ring-[#1B4D3E] rounded border-gray-300 cursor-pointer"
            />
          </div>

          {/* Buttons */}
          <div className="col-span-1 md:col-span-2 pt-3 border-t border-gray-100 dark:border-[#263632] flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setIsCreateModalOpen(false);
                setFormError(null);
                setFormNameError(null);
              }}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={isSubmitting}
              icon={<CheckCircle2 className="w-4 h-4" />}
            >
              {isSubmitting ? 'Guardando...' : 'Registrar Especie'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* 6. Modal: Editar Especie */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setFormError(null);
          setFormNameError(null);
        }}
        title="Editar Especie Pecuaria"
        maxWidth="xl"
      >
        <form onSubmit={handleEditSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          {/* Banner de Error / Duplicado */}
          {formError && (
            <div className="col-span-1 md:col-span-2 p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/60 rounded-xl text-xs text-red-700 dark:text-red-300 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold">{formError}</p>
              </div>
            </div>
          )}

          {renderSpeciesFields('edit')}

          <div className="col-span-1 md:col-span-2 p-3 bg-gray-50 dark:bg-[#121816] rounded-xl border border-gray-200 dark:border-[#263632] flex items-center justify-between">
            <div>
              <span className="font-bold text-xs text-[#1E1E1E] dark:text-gray-200 block">
                Estado Activo
              </span>
              <span className="text-[10px] text-gray-400">
                Al desmarcarla, la especie no podrá seleccionarse para nuevos lotes.
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
              onClick={() => {
                setIsEditModalOpen(false);
                setFormError(null);
                setFormNameError(null);
              }}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={isSubmitting}
              icon={<CheckCircle2 className="w-4 h-4" />}
            >
              {isSubmitting ? 'Guardando...' : 'Guardar Cambios'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* 7. Modal: Ver Detalle de Especie */}
      <Modal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        title="Ficha Técnica de Especie"
      >
        {selectedSpecies && (
          <div className="space-y-4 text-xs">
            <div className="p-4 bg-emerald-50/50 dark:bg-[#121816] rounded-2xl border border-emerald-200/60 dark:border-[#263632] flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-[#1B4D3E] text-white flex items-center justify-center font-black text-lg shrink-0 shadow-sm">
                {(selectedSpecies.name?.charAt(0) || 'E').toUpperCase()}
              </div>
              <div>
                <h3 className="text-base font-black text-[#1E1E1E] dark:text-gray-100">
                  {safeText(selectedSpecies.name)}
                </h3>
                <div className="flex items-center gap-2 mt-0.5">
                  <Badge variant="primary" icon={<Tag className="w-3 h-3" />}>
                    {safeText(selectedSpecies.category)}
                  </Badge>
                  <StatusBadge isActive={selectedSpecies.is_active} gender="female" />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-white dark:bg-[#18221F] rounded-xl border border-gray-200 dark:border-[#263632]">
                <span className="text-[10px] uppercase font-bold text-gray-400 block mb-1">
                  ID de Registro
                </span>
                <p className="font-mono font-bold text-sm text-[#1E1E1E] dark:text-gray-100">
                  #{selectedSpecies.id}
                </p>
              </div>

              <div className="p-3 bg-white dark:bg-[#18221F] rounded-xl border border-gray-200 dark:border-[#263632]">
                <span className="text-[10px] uppercase font-bold text-gray-400 block mb-1">
                  Granja Propietaria
                </span>
                <p className="font-bold text-xs text-[#1E1E1E] dark:text-gray-100">
                  {safeText(selectedSpecies.farm?.name || farmTitle)}
                </p>
              </div>
            </div>

            {selectedSpecies.created_at && (
              <div className="p-3 bg-white dark:bg-[#18221F] rounded-xl border border-gray-200 dark:border-[#263632] flex items-center justify-between">
                <span className="text-gray-500">Fecha de Registro:</span>
                <span className="font-mono font-bold text-[#1E1E1E] dark:text-gray-200 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-[#4E9F3D]" />
                  {new Date(selectedSpecies.created_at).toLocaleDateString('es-ES', {
                    day: '2-digit',
                    month: 'long',
                    year: 'numeric',
                  })}
                </span>
              </div>
            )}

            <div className="pt-2 flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsDetailModalOpen(false)}
              >
                Cerrar
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  setIsDetailModalOpen(false);
                  openEditModal(selectedSpecies);
                }}
                icon={<Edit2 className="w-3.5 h-3.5" />}
              >
                Editar Especie
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* 8. Modal: Confirmar Cambio de Estado */}
      <Modal
        isOpen={isConfirmModalOpen}
        onClose={() => setIsConfirmModalOpen(false)}
        title={normalizeIsActive(selectedSpecies?.is_active) ? 'Inhabilitar Especie' : 'Habilitar Especie'}
      >
        {selectedSpecies && (
          <div className="space-y-4 text-xs">
            <div className="p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-amber-800 dark:text-amber-200">
                  ¿Estás seguro de que deseas {normalizeIsActive(selectedSpecies.is_active) ? 'inhabilitar' : 'habilitar'}{' '}
                  esta especie?
                </p>
                <p className="text-amber-700 dark:text-amber-300 mt-1">
                  Especie: <strong className="font-semibold">{selectedSpecies.name}</strong> (
                  {selectedSpecies.category}).
                  {normalizeIsActive(selectedSpecies.is_active)
                    ? ' Al inhabilitarla, no podrá asociarse a nuevos lotes ni galpones en la granja.'
                    : ' Al habilitarla, volverá a estar disponible para todos los operadores de campo.'}
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsConfirmModalOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                variant={normalizeIsActive(selectedSpecies.is_active) ? 'danger' : 'accent'}
                size="sm"
                disabled={isSubmitting}
                onClick={handleToggleStatus}
                icon={<Power className="w-3.5 h-3.5" />}
              >
                {isSubmitting
                  ? 'Actualizando...'
                  : normalizeIsActive(selectedSpecies.is_active)
                  ? 'Confirmar Inhabilitación'
                  : 'Confirmar Habilitación'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
      {/* 9. Modal: Confirmar Eliminación de Especie */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Eliminar Especie"
      >
        {selectedSpecies && (
          <div className="space-y-4 text-xs">
            <div className="p-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-red-800 dark:text-red-200">
                  ¿Estás seguro de que deseas eliminar esta especie?
                </p>
                <p className="text-red-700 dark:text-red-300 mt-1 leading-relaxed">
                  Esta acción es <strong>irreversible</strong>. La especie{' '}
                  <strong>"{safeText(selectedSpecies.name)}"</strong> (
                  {safeText(selectedSpecies.category)}) se eliminará de forma
                  permanente del catálogo de la granja.
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

export default SpeciesView;
