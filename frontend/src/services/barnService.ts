import { api, tokenStorage } from './api';
import type { Barn, CreateBarnDTO, UpdateBarnDTO } from '../types/auth';

const getAuthHeaders = (): Record<string, string> => {
  const token = tokenStorage.getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export interface BarnStats {
  total_barns: number;
  active_barns: number;
  total_galpones: number;
  active_galpones: number;
  global_capacity: number;
  capacidad_global: number;
  max_capacity_sum?: number;
  associated_species: number;
  especies_asociadas: number;
}

export interface BarnApiResponse {
  data: Barn[];
  stats: BarnStats;
  total?: number;
}

export interface BarnFilterParams {
  search?: string;
  species_id?: number | string;
  status?: string;
  is_active?: boolean | string;
  farm_id?: number | string;
}

export const barnService = {
  /**
   * Obtiene la lista de galpones con sus relaciones (especie, granja, lotes)
   * y las estadísticas agregadas calculadas por el backend.
   */
  getAll: async (params: BarnFilterParams = {}): Promise<BarnApiResponse> => {
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
      const response = await api.get('/barns', {
        params: cleanParams,
        headers: getAuthHeaders(),
      });
      raw = response.data;
    } catch (primaryErr: any) {
      if (primaryErr?.response?.status === 404) {
        const fallback = await api.get('/admin/barns', {
          params: cleanParams,
          headers: getAuthHeaders(),
        });
        raw = fallback.data;
      } else {
        throw primaryErr;
      }
    }

    let barnList: Barn[] = [];
    if (Array.isArray(raw)) {
      barnList = raw;
    } else if (Array.isArray(raw?.data)) {
      barnList = raw.data;
    } else if (Array.isArray(raw?.barns)) {
      barnList = raw.barns;
    } else if (Array.isArray(raw?.data?.data)) {
      barnList = raw.data.data;
    }

    // Calcular estadísticas de respaldo defensivas
    let activeCount = 0;
    let totalCap = 0;
    const speciesSet = new Set<number | string>();

    barnList.forEach((b) => {
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
    const totalBarnsVal = Number(
      rawStats?.total_galpones ??
      rawStats?.total_barns ??
      rawStats?.total ??
      barnList.length
    );
    const activeBarnsVal = Number(
      rawStats?.active_galpones ??
      rawStats?.active_barns ??
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

    const stats: BarnStats = {
      total_barns: totalBarnsVal,
      total_galpones: totalBarnsVal,
      active_barns: activeBarnsVal,
      active_galpones: activeBarnsVal,
      global_capacity: globalCapVal,
      capacidad_global: globalCapVal,
      max_capacity_sum: globalCapVal,
      associated_species: associatedSpeciesVal,
      especies_asociadas: associatedSpeciesVal,
    };

    return {
      data: barnList,
      stats,
      total: barnList.length,
    };
  },

  getStats: async (params: { farm_id?: number | string } = {}): Promise<BarnStats> => {
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
      const response = await api.get('/barns/stats', {
        params: cleanParams,
        headers: getAuthHeaders(),
      });
      const raw = response.data?.data || response.data?.stats || response.data;
      const total = Number(raw?.total_galpones ?? raw?.total_barns ?? raw?.total ?? 0);
      const active = Number(raw?.active_galpones ?? raw?.active_barns ?? raw?.active ?? 0);
      const cap = Number(raw?.global_capacity ?? raw?.capacidad_global ?? raw?.max_capacity_sum ?? 0);
      const sp = Number(raw?.associated_species ?? raw?.especies_asociadas ?? 0);

      return {
        total_barns: total,
        total_galpones: total,
        active_barns: active,
        active_galpones: active,
        global_capacity: cap,
        capacidad_global: cap,
        max_capacity_sum: cap,
        associated_species: sp,
        especies_asociadas: sp,
      };
    } catch {
      // Fallback llamando a getAll para derivar estadísticas
      const allRes = await barnService.getAll(params);
      return allRes.stats;
    }
  },

  /**
   * Obtiene un galpón por su ID.
   */
  getById: async (id: number | string): Promise<Barn> => {
    const response = await api.get(`/barns/${id}`, {
      headers: getAuthHeaders(),
    });
    return response.data?.data || response.data;
  },

  /**
   * Crea un nuevo galpón en la base de datos.
   */
  create: async (data: CreateBarnDTO): Promise<Barn> => {
    const response = await api.post('/barns', data, {
      headers: getAuthHeaders(),
    });
    return response.data?.data || response.data;
  },

  /**
   * Actualiza los datos de un galpón existente.
   */
  update: async (id: number | string, data: UpdateBarnDTO): Promise<Barn> => {
    const response = await api.put(`/barns/${id}`, data, {
      headers: getAuthHeaders(),
    });
    return response.data?.data || response.data;
  },

  /**
   * Cambia el estado de activación (habilitar/inhabilitar) de un galpón.
   */
  toggleStatus: async (id: number | string, is_active?: boolean): Promise<Barn> => {
    try {
      const response = await api.patch(
        `/barns/${id}/status`,
        is_active !== undefined ? { is_active } : {},
        { headers: getAuthHeaders() }
      );
      return response.data?.data || response.data;
    } catch {
      // Fallback usando PUT
      const response = await api.put(
        `/barns/${id}`,
        is_active !== undefined ? { is_active } : {},
        { headers: getAuthHeaders() }
      );
      return response.data?.data || response.data;
    }
  },

  /**
   * Elimina un galpón de la base de datos.
   */
  delete: async (id: number | string): Promise<void> => {
    await api.delete(`/galpones/${id}`, {
      headers: getAuthHeaders(),
    });
  },
};

export const galponService = barnService;
