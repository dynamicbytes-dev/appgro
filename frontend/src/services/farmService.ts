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

  // Get modules for a farm
  getFarmModules: async (id: number | string): Promise<any> => {
    try {
      const response = await api.get(`/farms/${id}/modules`);
      console.log('DATOS CRUDOS DE LA API (/farms/' + id + '/modules):', response.data);
      return response.data;
    } catch (err) {
      console.warn('Fallo /farms/' + id + '/modules, intentando /root/farms/' + id + '/modules...', err);
      try {
        const response = await api.get(`/root/farms/${id}/modules`);
        console.log('DATOS CRUDOS DE LA API (/root/farms/' + id + '/modules):', response.data);
        return response.data;
      } catch (err2) {
        console.error('DATOS CRUDOS DE LA API ERROR:', err2);
        throw err2;
      }
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

    try {
      const response = await api.put(`/root/farms/${id}/modules`, body);
      return response.data?.data || response.data;
    } catch (err: any) {
      if (err?.response?.status === 404 || err?.response?.status === 405) {
        const fallbackRes = await api.put(`/farms/${id}/modules`, body);
        return fallbackRes.data?.data || fallbackRes.data;
      }
      throw err;
    }
  },
};
