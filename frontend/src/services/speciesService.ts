import { api } from './api';
import type { Species, CreateSpeciesDTO, UpdateSpeciesDTO } from '../types/auth';

export interface SpeciesStats {
  total_species: number;
  active_species: number;
  inactive_species?: number;
  categories_count: number;
  totalSpecies?: number;
  activeSpecies?: number;
  inactiveSpecies?: number;
  categoriesCount?: number;
  farm_id?: number | null;
}

export interface SpeciesApiResponse {
  data: Species[];
  stats: SpeciesStats;
  total_species?: number;
  active_species?: number;
  inactive_species?: number;
  categories_count?: number;
}

export interface SpeciesFilterParams {
  search?: string;
  is_active?: boolean | string;
  farm_id?: number | string;
}

export const speciesService = {
  /**
   * Obtiene la lista de especies filtrada según los privilegios del usuario (por granja o global),
   * junto con las estadísticas agregadas calculadas por el backend.
   */
  getAll: async (params: SpeciesFilterParams = {}): Promise<SpeciesApiResponse> => {
    const cleanParams: Record<string, any> = {};
    if (params.search && params.search.trim()) {
      cleanParams.search = params.search.trim();
    }
    if (params.is_active !== undefined && params.is_active !== 'all') {
      cleanParams.is_active = params.is_active;
    }
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

    const response = await api.get('/species', { params: cleanParams });
    const raw = response.data;

    let speciesList: Species[] = [];
    if (Array.isArray(raw)) {
      speciesList = raw;
    } else if (Array.isArray(raw?.data)) {
      speciesList = raw.data;
    } else if (Array.isArray(raw?.species)) {
      speciesList = raw.species;
    } else if (Array.isArray(raw?.data?.data)) {
      speciesList = raw.data.data;
    }

    const rawStats = raw?.stats || raw;
    const totalSpecies =
      typeof rawStats?.total_species === 'number'
        ? rawStats.total_species
        : typeof rawStats?.totalSpecies === 'number'
        ? rawStats.totalSpecies
        : speciesList.length;

    const activeSpecies =
      typeof rawStats?.active_species === 'number'
        ? rawStats.active_species
        : typeof rawStats?.activeSpecies === 'number'
        ? rawStats.activeSpecies
        : speciesList.filter((s) => {
            const val = (s as any)?.is_active;
            return val === true || val === 1 || val === '1' || val === 'true' || val === 'active';
          }).length;

    const inactiveSpecies =
      typeof rawStats?.inactive_species === 'number'
        ? rawStats.inactive_species
        : typeof rawStats?.inactiveSpecies === 'number'
        ? rawStats.inactiveSpecies
        : Math.max(0, totalSpecies - activeSpecies);

    const categoriesCount =
      typeof rawStats?.categories_count === 'number'
        ? rawStats.categories_count
        : typeof rawStats?.categoriesCount === 'number'
        ? rawStats.categoriesCount
        : new Set(speciesList.map((s) => (s.category || '').trim().toLowerCase()).filter(Boolean)).size;

    const stats: SpeciesStats = {
      total_species: totalSpecies,
      active_species: activeSpecies,
      inactive_species: inactiveSpecies,
      categories_count: categoriesCount,
      totalSpecies,
      activeSpecies,
      inactiveSpecies,
      categoriesCount,
    };

    return {
      data: speciesList,
      stats,
      total_species: totalSpecies,
      active_species: activeSpecies,
      inactive_species: inactiveSpecies,
      categories_count: categoriesCount,
    };
  },

  /**
   * Obtiene el detalle de una especie por ID.
   */
  getById: async (id: number | string): Promise<Species> => {
    const response = await api.get(`/species/${id}`);
    return response.data?.data || response.data;
  },

  /**
   * Registra una nueva especie pecuaria.
   */
  create: async (data: CreateSpeciesDTO): Promise<Species> => {
    const response = await api.post('/species', data);
    return response.data?.data || response.data;
  },

  /**
   * Actualiza el nombre o categoría de una especie.
   */
  update: async (id: number | string, data: UpdateSpeciesDTO): Promise<Species> => {
    const response = await api.put(`/species/${id}`, data);
    return response.data?.data || response.data;
  },

  /**
   * Alterna o establece el estado activo/inactivo de la especie.
   */
  toggleStatus: async (id: number | string, isActive?: boolean): Promise<Species> => {
    const payload = isActive !== undefined ? { is_active: isActive } : {};
    try {
      const response = await api.patch(`/species/${id}/status`, payload);
      return response.data?.data || response.data;
    } catch {
      const fallbackRes = await api.patch(`/species/${id}/toggle-status`, payload);
      return fallbackRes.data?.data || fallbackRes.data;
    }
  },

  /**
   * Elimina una especie de la granja.
   */
  delete: async (id: number | string): Promise<void> => {
    await api.delete(`/species/${id}`);
  },
};
