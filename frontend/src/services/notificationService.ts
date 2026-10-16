import { api } from './api';
import type { AppNotification, NotificationListResponse } from '../types/activity';

/**
 * Servicio de la bandeja de notificaciones (campana del navbar).
 * Consume el canal "database" de Laravel (tabla `notifications`).
 */
export const notificationService = {
  /**
   * Notificaciones recientes + contador de no leídas.
   */
  getAll: async (limit = 20): Promise<NotificationListResponse> => {
    const response = await api.get('/notifications', { params: { limit } });

    return {
      data: response.data?.data ?? [],
      unread_count: response.data?.unread_count ?? response.data?.unreadCount ?? 0,
      total: response.data?.total ?? 0,
    };
  },

  /**
   * Marcar una notificación como leída.
   */
  markAsRead: async (id: string): Promise<AppNotification> => {
    const response = await api.post(`/notifications/${id}/read`);
    return response.data?.data ?? response.data;
  },

  /**
   * Marcar todas como leídas.
   */
  markAllAsRead: async (): Promise<void> => {
    await api.post('/notifications/read-all');
  },
};
