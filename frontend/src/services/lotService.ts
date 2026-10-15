import { api, tokenStorage } from './api';
import type {
  Lot,
  LotStats,
  CreateLotDTO,
  UpdateLotDTO,
  HarvestLotDTO,
  RegisterEggsDTO,
  LoteAnimal,
  CreateLoteAnimalDTO,
  UpdateLoteAnimalDTO,
  AnimalService,
  CreateAnimalServiceDTO,
} from '../types/auth';

const getAuthHeaders = (): Record<string, string> => {
  const token = tokenStorage.getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const normalizeFarmId = (
  farmId: number | string | undefined
): number | string | undefined => {
  if (farmId === undefined || farmId === null || farmId === '' || farmId === 'all') {
    return undefined;
  }
  const str = String(farmId).toLowerCase();
  if (str === 'all') return undefined;
  return Number.isInteger(Number(farmId)) ? Number(farmId) : farmId;
};

export interface LotFilterParams {
  search?: string;
  status?: string;
  galpon_id?: number | string;
  species_id?: number | string;
  purpose?: string;
  farm_id?: number | string;
}

export interface LotApiResponse {
  data: Lot[];
  stats: LotStats;
}

/**
 * Servicio del módulo operativo Lotes.
 * Todos los endpoints están disponibles en /lots y /lotes (alias).
 */
export const lotService = {
  /**
   * Lista de lotes con filtros y estadísticas, con aislamiento
   * estricto por granja en el backend.
   */
  getAll: async (params: LotFilterParams = {}): Promise<LotApiResponse> => {
    const cleanParams: Record<string, any> = {};
    if (params.search && params.search.trim()) cleanParams.search = params.search.trim();
    if (params.status && params.status !== 'all') cleanParams.status = params.status;
    if (params.galpon_id && params.galpon_id !== 'all') cleanParams.galpon_id = params.galpon_id;
    if (params.species_id && params.species_id !== 'all') cleanParams.species_id = params.species_id;
    if (params.purpose && params.purpose !== 'all') cleanParams.purpose = params.purpose;

    const farmId = normalizeFarmId(params.farm_id);
    if (farmId !== undefined) cleanParams.farm_id = farmId;

    const response = await api.get('/lots', {
      params: cleanParams,
      headers: getAuthHeaders(),
    });
    return response.data;
  },

  /**
   * Estadísticas agregadas del módulo (targets del panel).
   */
  getStats: async (farmId?: number | string): Promise<LotStats> => {
    const cleanParams: Record<string, any> = {};
    const normalized = normalizeFarmId(farmId);
    if (normalized !== undefined) cleanParams.farm_id = normalized;

    const response = await api.get('/lots/stats', {
      params: cleanParams,
      headers: getAuthHeaders(),
    });
    return response.data?.data ?? response.data;
  },

  /**
   * Ficha técnica de un lote.
   */
  getById: async (id: number | string): Promise<Lot> => {
    const response = await api.get(`/lots/${id}`, { headers: getAuthHeaders() });
    return response.data?.data ?? response.data;
  },

  /**
   * Registrar un nuevo lote (código autogenerado, herencia de
   * sector/propósito y validación de cupo en el backend).
   */
  create: async (payload: CreateLotDTO): Promise<Lot> => {
    const response = await api.post('/lots', payload, { headers: getAuthHeaders() });
    return response.data?.data ?? response.data;
  },

  /**
   * Actualizar un lote (cantidad, propósito, estado).
   */
  update: async (id: number | string, payload: UpdateLotDTO): Promise<Lot> => {
    const response = await api.put(`/lots/${id}`, payload, { headers: getAuthHeaders() });
    return response.data?.data ?? response.data;
  },

  /**
   * Cosechar un lote: calcula pesos y precios totales, libera cupo
   * e inactiva el lote (baja lógica).
   */
  harvest: async (id: number | string, payload: HarvestLotDTO): Promise<any> => {
    const response = await api.post(
      `/lots/${id}/harvest`,
      payload,
      { headers: getAuthHeaders() }
    );
    return response.data;
  },

  /**
   * Registrar producción de huevos sin liberar cupo del galpón.
   */
  registerEggs: async (id: number | string, payload: RegisterEggsDTO): Promise<any> => {
    const response = await api.post(
      `/lots/${id}/eggs`,
      payload,
      { headers: getAuthHeaders() }
    );
    return response.data;
  },

  /**
   * Eliminar un lote (solo inactivo y sin animales individuales).
   */
  delete: async (id: number | string): Promise<void> => {
    await api.delete(`/lots/${id}`, { headers: getAuthHeaders() });
  },

  /* ---------------- Animales individuales (porcinos) ---------------- */

  /**
   * Animales registrados individualmente en un lote.
   */
  getAnimals: async (
    lotId: number | string,
    filters: { status?: string; gender?: string; search?: string } = {}
  ): Promise<LoteAnimal[]> => {
    const cleanParams: Record<string, any> = {};
    if (filters.status && filters.status !== 'all') cleanParams.status = filters.status;
    if (filters.gender && filters.gender !== 'all') cleanParams.gender = filters.gender;
    if (filters.search && filters.search.trim()) cleanParams.search = filters.search.trim();

    const response = await api.get(
      `/lots/${lotId}/animals`,
      { params: cleanParams, headers: getAuthHeaders() }
    );
    return response.data?.data ?? response.data;
  },

  /**
   * Registrar un animal individual en un lote de reproducción
   * (identificador automático de 5 dígitos).
   */
  createAnimal: async (
    lotId: number | string,
    payload: CreateLoteAnimalDTO
  ): Promise<LoteAnimal> => {
    const response = await api.post(
      `/lots/${lotId}/animals`,
      payload,
      { headers: getAuthHeaders() }
    );
    return response.data?.data ?? response.data;
  },

  /**
   * Lechones destetados pendientes de formar un lote.
   *
   * Persistidos en backend (`animal_services.pending_piglets`):
   * la alerta de "lechones pendientes" sobrevive a un refresco
   * de página y solo desaparece cuando se crea el lote de
   * lechones vinculado.
   */
  getWeanedPending: async (
    lotId: number | string
  ): Promise<{ pending_piglets: number; services: Array<{ id: number }> }> => {
    const response = await api.get(
      `/lots/${lotId}/weaned-pending`,
      { headers: getAuthHeaders() }
    );
    return response.data?.data ?? { pending_piglets: 0, services: [] };
  },

  /**
   * Ficha de un animal individual.
   */
  getAnimal: async (animalId: number | string): Promise<LoteAnimal> => {
    const response = await api.get(
      `/lots/animals/${animalId}`,
      { headers: getAuthHeaders() }
    );
    return response.data?.data ?? response.data;
  },

  /**
   * Editar un animal individual (incluye cosecha/venta y transición de estado).
   */
  updateAnimal: async (
    animalId: number | string,
    payload: UpdateLoteAnimalDTO
  ): Promise<LoteAnimal> => {
    const response = await api.put(
      `/lots/animals/${animalId}`,
      payload,
      { headers: getAuthHeaders() }
    );
    return response.data?.data ?? response.data;
  },

  /**
   * Eliminar un animal individual (solo sin servicios registrados).
   */
  deleteAnimal: async (animalId: number | string): Promise<void> => {
    await api.delete(`/lots/animals/${animalId}`, { headers: getAuthHeaders() });
  },

  /**
   * Historial de servicios reproductivos de un animal.
   */
  getServices: async (animalId: number | string): Promise<AnimalService[]> => {
    const response = await api.get(
      `/lots/animals/${animalId}/services`,
      { headers: getAuthHeaders() }
    );
    return response.data?.data ?? response.data;
  },

  /**
   * Registrar un servicio (inseminación / monta).
   */
  createService: async (
    animalId: number | string,
    payload: CreateAnimalServiceDTO
  ): Promise<AnimalService> => {
    const response = await api.post(
      `/lots/animals/${animalId}/services`,
      payload,
      { headers: getAuthHeaders() }
    );
    return response.data?.data ?? response.data;
  },

  /**
   * Eliminar un registro de servicio.
   */
  deleteService: async (serviceId: number | string): Promise<void> => {
    await api.delete(`/lots/services/${serviceId}`, { headers: getAuthHeaders() });
  },
};
