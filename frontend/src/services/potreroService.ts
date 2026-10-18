import { api, tokenStorage } from './api';
import type {
  Potrero,
  CreatePotreroDTO,
  UpdatePotreroDTO,
  PotreroFeatureCollection,
} from '../types/auth';

const getAuthHeaders = (): Record<string, string> => {
  const token = tokenStorage.getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export interface PotreroStats {
  total_potreros: number;
  active_potreros: number;
  global_capacity: number;
  capacidad_global: number;
  max_capacity_sum?: number;
  associated_species: number;
  especies_asociadas: number;
}

export interface PotreroApiResponse {
  data: Potrero[];
  stats: PotreroStats;
  total?: number;
}

export interface PotreroFilterParams {
  search?: string;
  species_id?: number | string;
  status?: string;
  is_active?: boolean | string;
  farm_id?: number | string;
}

export const potreroService = {
  /**
   * Obtiene la lista de potreros con sus relaciones (especie, granja, lotes)
   * y las estadísticas agregadas calculadas por el backend.
   */
  getAll: async (params: PotreroFilterParams = {}): Promise<PotreroApiResponse> => {
    const cleanParams: Record<string, any> = {};
    if (params.search && params.search.trim()) {
      cleanParams.search = params.search.trim();
    }
    if (params.species_id !== undefined && params.species_id !== 'all' && params.species_id !== '') {
      cleanParams.species_id = params.species_id;
    }
    if (params.status !== undefined && params.status !== 'all' && params.status !== '') {
      cleanParams.status = params.status;
    }
    // Strict payload filtering: omit farm_id if empty, null, undefined, or 'all'
    if (
      params.farm_id !== undefined &&
      params.farm_id !== null &&
      params.farm_id !== '' &&
      params.farm_id !== 'all' &&
      String(params.farm_id).toLowerCase() !== 'all'
    ) {
      cleanParams.farm_id = Number.isInteger(Number(params.farm_id))
        ? Number(params.farm_id)
        : params.farm_id;
    }

    let raw: any = null;
    try {
      const response = await api.get('/potreros', {
        params: cleanParams,
        headers: getAuthHeaders(),
      });
      raw = response.data;
    } catch (primaryErr: any) {
      if (primaryErr?.response?.status === 404) {
        const fallback = await api.get('/admin/potreros', {
          params: cleanParams,
          headers: getAuthHeaders(),
        });
        raw = fallback.data;
      } else {
        throw primaryErr;
      }
    }

    let potreroList: Potrero[] = [];
    if (Array.isArray(raw)) {
      potreroList = raw;
    } else if (Array.isArray(raw?.data)) {
      potreroList = raw.data;
    } else if (Array.isArray(raw?.potreros)) {
      potreroList = raw.potreros;
    } else if (Array.isArray(raw?.data?.data)) {
      potreroList = raw.data.data;
    }

    // Calcular estadísticas de respaldo defensivas
    let activeCount = 0;
    let totalCap = 0;
    const speciesSet = new Set<number | string>();

    potreroList.forEach((b) => {
      const isActive =
        b.is_active === true ||
        (b.is_active as any) === 1 ||
        (b.is_active as any) === '1' ||
        (b.is_active as any) === 'active';
      if (isActive) {
        activeCount++;
        totalCap += Number(b.max_capacity || 0);
      }
      if (b.species_id) {
        speciesSet.add(b.species_id);
      }
    });

    const rawStats = raw?.stats || raw?.data?.stats || {};
    const totalPotrerosVal = Number(
      rawStats?.total_potreros ??
      rawStats?.total ??
      potreroList.length
    );
    const activePotrerosVal = Number(
      rawStats?.active_potreros ??
      rawStats?.active ??
      activeCount
    );
    const globalCapVal = Number(
      rawStats?.global_capacity ??
      rawStats?.capacidad_global ??
      rawStats?.max_capacity_sum ??
      totalCap
    );
    const associatedSpeciesVal = Number(
      rawStats?.associated_species ??
      rawStats?.especies_asociadas ??
      speciesSet.size
    );

    const stats: PotreroStats = {
      total_potreros: totalPotrerosVal,
      active_potreros: activePotrerosVal,
      global_capacity: globalCapVal,
      capacidad_global: globalCapVal,
      max_capacity_sum: globalCapVal,
      associated_species: associatedSpeciesVal,
      especies_asociadas: associatedSpeciesVal,
    };

    return {
      data: potreroList,
      stats,
      total: potreroList.length,
    };
  },

  getStats: async (params: { farm_id?: number | string } = {}): Promise<PotreroStats> => {
    const cleanParams: Record<string, any> = {};
    if (
      params.farm_id !== undefined &&
      params.farm_id !== null &&
      params.farm_id !== '' &&
      params.farm_id !== 'all' &&
      String(params.farm_id).toLowerCase() !== 'all'
    ) {
      cleanParams.farm_id = Number.isInteger(Number(params.farm_id))
        ? Number(params.farm_id)
        : params.farm_id;
    }

    try {
      const response = await api.get('/potreros/stats', {
        params: cleanParams,
        headers: getAuthHeaders(),
      });
      const raw = response.data?.data || response.data?.stats || response.data;
      const total = Number(raw?.total_potreros ?? raw?.total ?? 0);
      const active = Number(raw?.active_potreros ?? raw?.active ?? 0);
      const cap = Number(raw?.global_capacity ?? raw?.capacidad_global ?? raw?.max_capacity_sum ?? 0);
      const sp = Number(raw?.associated_species ?? raw?.especies_asociadas ?? 0);

      return {
        total_potreros: total,
        active_potreros: active,
        global_capacity: cap,
        capacidad_global: cap,
        max_capacity_sum: cap,
        associated_species: sp,
        especies_asociadas: sp,
      };
    } catch {
      // Fallback llamando a getAll para derivar estadísticas
      const allRes = await potreroService.getAll(params);
      return allRes.stats;
    }
  },

  /**
   * Obtiene un potrero por su ID.
   */
  getById: async (id: number | string): Promise<Potrero> => {
    const response = await api.get(`/potreros/${id}`, {
      headers: getAuthHeaders(),
    });
    return response.data?.data || response.data;
  },

  /**
   * Obtiene la capa GeoJSON (FeatureCollection) de potreros para el croquis.
   */
  getGeojson: async (
    params: { farm_id?: number | string } = {}
  ): Promise<PotreroFeatureCollection> => {
    const cleanParams: Record<string, any> = {};
    if (
      params.farm_id !== undefined &&
      params.farm_id !== null &&
      params.farm_id !== '' &&
      params.farm_id !== 'all' &&
      String(params.farm_id).toLowerCase() !== 'all'
    ) {
      cleanParams.farm_id = Number.isInteger(Number(params.farm_id))
        ? Number(params.farm_id)
        : params.farm_id;
    }

    const response = await api.get('/potreros/geojson', {
      params: cleanParams,
      headers: getAuthHeaders(),
    });
    const raw = response.data?.data || response.data;

    return raw?.type === 'FeatureCollection'
      ? raw
      : { type: 'FeatureCollection', features: [] };
  },

  /**
   * Crea un nuevo potrero en la base de datos.
   */
  create: async (data: CreatePotreroDTO): Promise<Potrero> => {
    const response = await api.post('/potreros', data, {
      headers: getAuthHeaders(),
    });
    return response.data?.data || response.data;
  },

  /**
   * Actualiza los datos de un potrero existente.
   */
  update: async (id: number | string, data: UpdatePotreroDTO): Promise<Potrero> => {
    const response = await api.put(`/potreros/${id}`, data, {
      headers: getAuthHeaders(),
    });
    return response.data?.data || response.data;
  },

  /**
   * Cambia el estado de activación (habilitar/inhabilitar) de un potrero.
   */
  toggleStatus: async (id: number | string, is_active?: boolean): Promise<Potrero> => {
    try {
      const response = await api.patch(
        `/potreros/${id}/status`,
        is_active !== undefined ? { is_active } : {},
        { headers: getAuthHeaders() }
      );
      return response.data?.data || response.data;
    } catch {
      // Fallback usando PUT
      const response = await api.put(
        `/potreros/${id}`,
        is_active !== undefined ? { is_active } : {},
        { headers: getAuthHeaders() }
      );
      return response.data?.data || response.data;
    }
  },

  /**
   * Elimina un potrero de la base de datos.
   */
  delete: async (id: number | string): Promise<void> => {
    await api.delete(`/potreros/${id}`, {
      headers: getAuthHeaders(),
    });
  },
};
