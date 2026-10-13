import { api } from './api';

export interface CreateSubordinatePayload {
  name: string;
  lastname?: string;
  email: string;
  phone?: string;
  password: string;
  is_active?: boolean;
  module_ids?: number[];
  modules?: string[];
}

export interface UpdateSubordinatePayload {
  name?: string;
  lastname?: string;
  email?: string;
  phone?: string;
  password?: string;
  is_active?: boolean;
  module_ids?: number[];
  modules?: string[];
}

export const subordinateService = {
  // Get all subordinates belonging to the authenticated admin's farm
  getAllSubordinates: async (farmId?: number | string | null): Promise<any[]> => {
    const params = farmId ? { farm_id: farmId } : {};
    const response = await api.get('/subordinates', { params });
    const raw = response.data;
    if (Array.isArray(raw)) return raw;
    if (Array.isArray(raw?.data)) return raw.data;
    if (Array.isArray(raw?.subordinates)) return raw.subordinates;
    if (Array.isArray(raw?.data?.data)) return raw.data.data;
    return [];
  },

  // Get available farm modules for the authenticated admin
  getAvailableModules: async (farmId?: number | string | null): Promise<any[]> => {
    try {
      const params = farmId ? { farm_id: farmId } : {};
      const response = await api.get('/subordinates/available-modules', { params });
      const raw = response.data;
      if (Array.isArray(raw)) return raw;
      if (Array.isArray(raw?.data)) return raw.data;
      if (Array.isArray(raw?.modules)) return raw.modules;
      return [];
    } catch {
      try {
        const params = farmId ? { farm_id: farmId } : {};
        const fallback = await api.get('/admin/available-modules', { params });
        const raw = fallback.data;
        if (Array.isArray(raw)) return raw;
        if (Array.isArray(raw?.data)) return raw.data;
        return [];
      } catch {
        return [];
      }
    }
  },

  // Create a new subordinate
  createSubordinate: async (payload: CreateSubordinatePayload): Promise<any> => {
    const response = await api.post('/subordinates', payload);
    return response.data?.data || response.data;
  },

  // Get subordinate details
  getSubordinateById: async (id: number | string): Promise<any> => {
    const response = await api.get(`/subordinates/${id}`);
    return response.data?.data || response.data;
  },

  // Update subordinate
  updateSubordinate: async (id: number | string, payload: UpdateSubordinatePayload): Promise<any> => {
    const response = await api.put(`/subordinates/${id}`, payload);
    return response.data?.data || response.data;
  },
};
