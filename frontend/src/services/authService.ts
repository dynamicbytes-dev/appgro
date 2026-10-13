import { api, tokenStorage } from './api';
import type { LoginCredentials, User } from '../types/auth';

export interface UpdateProfileDTO {
  name?: string;
  email?: string;
  password?: string;
}

export const authService = {
  login: async (credentials: LoginCredentials): Promise<{ user: User; token: string; modules?: any[] }> => {
    const response = await api.post('/auth/login', credentials);
    const data = response.data;

    const token = data.data?.access_token || data.access_token;
    const user = data.data?.user || data.user;
    const modules =
      data.data?.modules ||
      data.data?.farm_modules ||
      data.data?.subordinate_modules ||
      data.modules ||
      data.farm_modules ||
      data.subordinate_modules ||
      (user && (user.modules || user.farm_modules || user.subordinate_modules)) ||
      [];

    if (token) {
      tokenStorage.setToken(token);
    }

    return { user, token, modules };
  },

  logout: async (): Promise<void> => {
    try {
      await api.post('/auth/logout');
    } catch {
      // Ignore logout API failures
    } finally {
      tokenStorage.clearTokens();
    }
  },

  getCurrentUser: async (): Promise<{ user: User; modules: any[] } | null> => {
    try {
      const response = await api.get('/auth/me');
      const raw = response.data;
      const data = raw?.data !== undefined ? raw.data : raw;
      const user = data?.user || (data?.id ? data : raw?.user);
      const modules =
        data?.modules ||
        data?.farm_modules ||
        data?.subordinate_modules ||
        raw?.modules ||
        raw?.farm_modules ||
        raw?.subordinate_modules ||
        (user && (user.modules || user.farm_modules || user.subordinate_modules)) ||
        [];
      return {
        user,
        modules,
      };
    } catch {
      return null;
    }
  },

  updateProfile: async (data: UpdateProfileDTO): Promise<User> => {
    const response = await api.put('/auth/profile', data);
    return response.data.data.user;
  },
};
