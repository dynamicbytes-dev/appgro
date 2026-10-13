import { api } from "./api";
import type { User, CreateAdminDTO, UpdateAdminDTO } from "../types/auth";

export type { CreateAdminDTO, UpdateAdminDTO };

export const adminService = {
  // Get all registered farm owners/admins
  getAllAdmins: async (): Promise<any> => {
    const response = await api.get('/root/admins');
    const raw = response.data;
    let list: any[] = [];
    if (Array.isArray(raw)) {
      list = raw;
    } else if (Array.isArray(raw?.data)) {
      list = raw.data;
    } else if (raw?.data && Array.isArray(raw.data.data)) {
      list = raw.data.data;
    } else if (Array.isArray(raw?.admins)) {
      list = raw.admins;
    } else if (Array.isArray(raw?.users)) {
      list = raw.users;
    } else if (raw?.data !== undefined) {
      list = Array.isArray(raw.data) ? raw.data : [];
    }

    const total =
      typeof raw?.total === 'number'
        ? raw.total
        : typeof raw?.total_admins === 'number'
        ? raw.total_admins
        : typeof raw?.adminsCount === 'number'
        ? raw.adminsCount
        : typeof raw?.data?.total === 'number'
        ? raw.data.total
        : list.length;

    const activeCount =
      typeof raw?.active_admins === 'number'
        ? raw.active_admins
        : typeof raw?.activeAdmins === 'number'
        ? raw.activeAdmins
        : list.filter((a: any) => a && (a.is_active === true || a.is_active === 1 || a.status === 'active')).length;

    (list as any).total = Math.max(total, list.length);
    (list as any).active_count = activeCount;
    (list as any).raw = raw;

    return list;
  },

  // Get single admin by ID
  getAdminById: async (id: number | string): Promise<User> => {
    const response = await api.get(`/root/admins/${id}`);
    return response.data.data;
  },

  // Create new farm administrator
  createAdmin: async (data: CreateAdminDTO): Promise<User> => {
    const response = await api.post("/root/admins", data);
    return response.data.data;
  },

  // Update administrator details
  updateAdmin: async (id: number | string, data: UpdateAdminDTO): Promise<User> => {
    const response = await api.put(`/root/admins/${id}`, data);
    return response.data.data;
  },

  // Toggle administrator active status
  toggleStatus: async (id: number | string, isActive?: boolean): Promise<any> => {
    const payload = isActive !== undefined ? { is_active: isActive } : {};
    const endpoints = [
      `/admin-users/${id}/toggle-status`,
      `/root/admins/${id}/status`,
      `/root/admins/${id}/toggle-status`,
      `/admins/${id}/status`,
      `/admins/${id}/toggle-status`,
    ];

    let lastError: any = null;

    for (const endpoint of endpoints) {
      try {
        const response = await api.patch(endpoint, payload);
        return response;
      } catch (err: any) {
        lastError = err;
        if (err?.response?.status === 404 || err?.response?.status === 405) {
          continue;
        }
        // Try PUT as fallback on the same endpoint
        try {
          const putRes = await api.put(endpoint, payload);
          return putRes;
        } catch (putErr: any) {
          lastError = putErr;
          continue;
        }
      }
    }

    throw lastError || new Error('No se pudo actualizar el estado del administrador.');
  },

  // Alias for toggleStatus
  toggleAdminStatus: async (id: number | string, isActive?: boolean): Promise<any> => {
    return adminService.toggleStatus(id, isActive);
  },
};
