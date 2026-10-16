import { api } from './api';
import type {
  Activity,
  ActivityListResponse,
  CreateActivityDTO,
  UpdateActivityDTO,
} from '../types/activity';

/**
 * Servicio del módulo operativo Actividades.
 * Endpoints disponibles en /activities y /actividades (alias).
 */
export const activityService = {
  /**
   * Lista de actividades de la granja (vista admin) con filtros y stats.
   */
  getAll: async (params?: {
    status?: string;
    assigned_to?: number | string;
    search?: string;
    overdue?: boolean;
    farm_id?: number | string;
  }): Promise<ActivityListResponse> => {
    const query: Record<string, string | number | boolean> = {};
    if (params?.status) query.status = params.status;
    if (params?.assigned_to) query.assigned_to = params.assigned_to;
    if (params?.search) query.search = params.search;
    if (params?.overdue) query.overdue = true;
    if (params?.farm_id && params.farm_id !== 'all') query.farm_id = params.farm_id;

    const response = await api.get('/activities', { params: query });

    return {
      data: response.data?.data ?? [],
      stats: response.data?.stats ?? response.data?.data?.stats,
    };
  },

  /**
   * Bandeja del subordinado: solo mis actividades asignadas.
   */
  getMy: async (params?: {
    status?: string;
    search?: string;
    overdue?: boolean;
  }): Promise<ActivityListResponse> => {
    const query: Record<string, string | boolean> = {};
    if (params?.status) query.status = params.status;
    if (params?.search) query.search = params.search;
    if (params?.overdue) query.overdue = true;

    const response = await api.get('/activities/my', { params: query });

    return {
      data: response.data?.data ?? [],
      stats: response.data?.stats,
    };
  },

  /**
   * Ficha técnica de una actividad.
   */
  getById: async (id: number | string): Promise<Activity> => {
    const response = await api.get(`/activities/${id}`);
    return response.data?.data ?? response.data;
  },

  /**
   * Registrar una nueva actividad y asignarla a un subordinado.
   * Genera la notificación en base de datos para el subordinado.
   */
  create: async (payload: CreateActivityDTO): Promise<Activity> => {
    const response = await api.post('/activities', payload);
    return response.data?.data ?? response.data;
  },

  /**
   * Actualizar título, descripción, fecha límite o reasignar.
   */
  update: async (id: number | string, payload: UpdateActivityDTO): Promise<Activity> => {
    const response = await api.put(`/activities/${id}`, payload);
    return response.data?.data ?? response.data;
  },

  /**
   * Cambiar el estado: exactamente 'en_proceso' o 'terminada'.
   */
  updateStatus: async (id: number | string, status: string): Promise<Activity> => {
    const response = await api.patch(`/activities/${id}/status`, { status });
    return response.data?.data ?? response.data;
  },

  /**
   * Eliminar una actividad (solo admin, y si no está terminada).
   */
  remove: async (id: number | string): Promise<void> => {
    await api.delete(`/activities/${id}`);
  },

  /**
   * Estadísticas del módulo.
   */
  getStats: async (farmId?: number | string) => {
    const response = await api.get('/activities/stats', {
      params: farmId && farmId !== 'all' ? { farm_id: farmId } : undefined,
    });
    return response.data?.data ?? response.data;
  },
};
