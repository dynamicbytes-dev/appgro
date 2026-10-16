import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { notificationService } from '../services/notificationService';
import { useAuth } from './AuthContext';
import type { AppNotification } from '../types/activity';

/**
 * Estado global de notificaciones del usuario autenticado.
 *
 * Polling cada 45 s sobre GET /notifications (no hay websockets en el
 * stack): mantiene el contador de la campana del navbar y la lista del
 * dropdown, y expone markAsRead / markAllAsRead / refresh.
 */

interface NotificationsContextValue {
  notifications: AppNotification[];
  unreadCount: number;
  isLoading: boolean;
  refresh: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
}

const POLL_INTERVAL_MS = 45_000;

const NotificationsContext = createContext<NotificationsContextValue | undefined>(undefined);

export const NotificationsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isAuthenticated } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const mountedRef = useRef(true);

  const refresh = useCallback(async () => {
    if (!isAuthenticated || !user) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    try {
      const result = await notificationService.getAll(20);
      if (!mountedRef.current) return;
      setNotifications(result.data);
      setUnreadCount(result.unread_count);
    } catch {
      // Silencioso: el polling no debe romper la UI si falla una ronda
    } finally {
      if (mountedRef.current) setIsLoading(false);
    }
  }, [isAuthenticated, user]);

  const markAsRead = useCallback(
    async (id: string) => {
      try {
        await notificationService.markAsRead(id);
        if (!mountedRef.current) return;
        setNotifications((prev) =>
          prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n))
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      } catch {
        await refresh();
      }
    },
    [refresh]
  );

  const markAllAsRead = useCallback(async () => {
    try {
      await notificationService.markAllAsRead();
      if (!mountedRef.current) return;
      const now = new Date().toISOString();
      setNotifications((prev) => prev.map((n) => ({ ...n, read_at: n.read_at ?? now })));
      setUnreadCount(0);
    } catch {
      await refresh();
    }
  }, [refresh]);

  // Carga inicial + polling periódico
  useEffect(() => {
    mountedRef.current = true;

    if (!isAuthenticated || !user) {
      setNotifications([]);
      setUnreadCount(0);
      return () => {
        mountedRef.current = false;
      };
    }

    setIsLoading(true);
    void refresh();

    const intervalId = setInterval(() => {
      void refresh();
    }, POLL_INTERVAL_MS);

    return () => {
      mountedRef.current = false;
      clearInterval(intervalId);
    };
  }, [isAuthenticated, user, refresh]);

  const value = useMemo(
    () => ({ notifications, unreadCount, isLoading, refresh, markAsRead, markAllAsRead }),
    [notifications, unreadCount, isLoading, refresh, markAsRead, markAllAsRead]
  );

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
};

export const useNotifications = (): NotificationsContextValue => {
  const context = useContext(NotificationsContext);

  if (!context) {
    throw new Error('useNotifications debe usarse dentro de <NotificationsProvider>');
  }

  return context;
};
