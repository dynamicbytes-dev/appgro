import { api } from './api';
import type { Farm } from '../types/auth';

export interface CreateFarmDTO {
  name: string;
  code?: string;
  sector?: string;
  location?: string;
  ownerName?: string;
  ownerEmail?: string;
  ownerPhone?: string;
  is_active?: boolean;
}

export interface UpdateFarmDTO {
  name?: string;
  code?: string;
  sector?: string;
  location?: string;
  ownerName?: string;
  ownerEmail?: string;
  ownerPhone?: string;
  is_active?: boolean;
}

export interface FarmModuleStatus {
  module_id: number;
  is_enabled: boolean;
}

export const farmService = {
  // Get active farms for dropdown selects
  getFarmsSelect: async (includeInactive: boolean = false): Promise<Farm[]> => {
    try {
      const response = await api.get('/farms/select', {
        params: includeInactive ? { include_inactive: 1 } : {},
      });
      const data = response.data?.data || response.data?.farms || response.data;
      return Array.isArray(data) ? data : [];
    } catch (e) {
      try {
        const fallback = await api.get('/root/farms/select');
        const data = fallback.data?.data || fallback.data?.farms || fallback.data;
        return Array.isArray(data) ? data : [];
      } catch {
        return [];
      }
    }
  },

  // Get all registered farms (Root view)
  getAllFarms: async (): Promise<any> => {
    const response = await api.get('/root/farms');
    const raw = response.data;
    let list: any[] = [];
    if (Array.isArray(raw)) {
      list = raw;
    } else if (Array.isArray(raw?.data)) {
      list = raw.data;
    } else if (raw?.data && Array.isArray(raw.data.data)) {
      list = raw.data.data;
    } else if (Array.isArray(raw?.farms)) {
      list = raw.farms;
    } else if (raw?.data !== undefined) {
      list = Array.isArray(raw.data) ? raw.data : [];
    }

    const total =
      typeof raw?.total === 'number'
        ? raw.total
        : typeof raw?.total_farms === 'number'
        ? raw.total_farms
        : typeof raw?.farmsCount === 'number'
        ? raw.farmsCount
        : typeof raw?.data?.total === 'number'
        ? raw.data.total
        : list.length;

    const activeCount =
      typeof raw?.active_farms === 'number'
        ? raw.active_farms
        : typeof raw?.activeFarms === 'number'
        ? raw.activeFarms
        : list.filter((f: any) => f && (f.is_active === true || f.is_active === 1 || f.status === 'active')).length;

    (list as any).total = Math.max(total, list.length);
    (list as any).active_count = activeCount;
    (list as any).raw = raw;

    return list;
  },

  // Get farm details by ID
  getFarmById: async (id: number | string): Promise<Farm> => {
    const response = await api.get(`/root/farms/${id}`);
    return response.data.data;
  },

  // Create new farm
  createFarm: async (data: CreateFarmDTO): Promise<Farm> => {
    const response = await api.post('/root/farms', data);
    return response.data.data;
  },

  // Update farm details or state
  updateFarm: async (id: number | string, data: UpdateFarmDTO): Promise<Farm> => {
    const response = await api.put(`/root/farms/${id}`, data);
    return response.data.data;
  },

  // Get modules for a farm (lectura: root cualquiera; admin/encargado solo su granja)
  getFarmModules: async (id: number | string): Promise<any> => {
    try {
      const response = await api.get(`/farms/${id}/modules`);
      return response.data;
    } catch (err) {
      // Fallback exclusivo para Root (ruta protegida por root.access)
      const response = await api.get(`/root/farms/${id}/modules`);
      return response.data;
    }
  },

  // Update enabled modules for a farm (supports array of modules or single module payload)
  updateFarmModules: async (id: number | string, payloadOrModules: any): Promise<any> => {
    let body: any;

    if (Array.isArray(payloadOrModules)) {
      body = { modules: payloadOrModules };
    } else if (payloadOrModules && typeof payloadOrModules === 'object') {
      if (Array.isArray(payloadOrModules.modules)) {
        body = payloadOrModules;
      } else {
        // Single module payload ({ module_id, is_enabled, code })
        body = payloadOrModules;
      }
    } else {
      body = payloadOrModules;
    }

    const response = await api.put(`/root/farms/${id}/modules`, body);
    return response.data?.data || response.data;
  },
};
