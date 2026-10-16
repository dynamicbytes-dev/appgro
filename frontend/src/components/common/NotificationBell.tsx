import React, { useEffect, useRef, useState } from 'react';
import { Bell, Check, CheckCheck, ClipboardList, Clock } from 'lucide-react';
import { useNotifications } from '../../context/NotificationsContext';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { safeText } from '../../utils/safeText';

const formatRelativeTime = (iso?: string | null): string => {
  if (!iso) return '';

  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';

  const diffMs = Date.now() - then;
  const minutes = Math.floor(diffMs / 60000);

  if (minutes < 1) return 'Ahora';
  if (minutes < 60) return `Hace ${minutes} min`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Hace ${hours} h`;

  const days = Math.floor(hours / 24);
  return `Hace ${days} d`;
};

/**
 * Campana de notificaciones del navbar: contador de no leídas y
 * dropdown con la bandeja (patrón click-outside + cierre al navegar,
 * igual que el menú de granjas).
 */
export const NotificationBell: React.FC = () => {
  const { notifications, unreadCount, refresh, markAsRead, markAllAsRead } = useNotifications();
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const bellRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const roleUpper = user?.role ? user.role.toUpperCase() : '';
  // El encargado entra a SU bandeja; el admin al panel de gestión.
  const activitiesPath = roleUpper === 'SUBORDINATE' || roleUpper === 'ENCARGADO'
    ? '/mis-actividades'
    : '/admin/actividades';

  // Cerrar al hacer click fuera
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (bellRef.current && !bellRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleItemClick = (notification: (typeof notifications)[number]) => {
    if (!notification.read_at) {
      void markAsRead(notification.id);
    }

    const activityId = notification.data?.activity_id;
    const type = notification.data?.type ?? notification.type;

    setIsOpen(false);

    if (activityId && (type === 'activity_assigned' || type === 'activity_completed')) {
      navigate(activitiesPath);
    }
  };

  return (
    <div ref={bellRef} className="relative">
      <button
        onClick={() => {
          setIsOpen(!isOpen);
          void refresh();
        }}
        className="relative p-2 rounded-lg bg-[#143A2F] hover:bg-[#0E2C23] border border-[#256653] text-emerald-100 hover:text-white transition-colors"
        title="Notificaciones"
        aria-label="Notificaciones"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center border-2 border-[#1B4D3E]">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-[#18221F] rounded-xl shadow-2xl border border-gray-200 dark:border-[#263632] z-50 text-gray-800 dark:text-gray-100 overflow-hidden">
          <div className="px-3 py-2.5 flex items-center justify-between border-b border-gray-100 dark:border-gray-800 bg-[#1B4D3E] text-white">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-[#6DBF5C]" />
              <span className="text-sm font-semibold">Notificaciones</span>
            </div>
            {unreadCount > 0 && (
              <button
                onClick={() => void markAllAsRead()}
                className="text-[11px] text-emerald-200 hover:text-white flex items-center gap-1 transition-colors"
                title="Marcar todas como leídas"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                Marcar todas
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-gray-400 dark:text-gray-500">
                <Bell className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">No tienes notificaciones.</p>
              </div>
            ) : (
              notifications.map((notification) => {
                const data = notification.data ?? {};
                const isUnread = !notification.read_at;

                return (
                  <button
                    key={notification.id}
                    onClick={() => handleItemClick(notification)}
                    className={`w-full text-left px-4 py-3 flex gap-3 border-b border-gray-50 dark:border-gray-800/60 last:border-b-0 transition-colors ${
                      isUnread
                        ? 'bg-emerald-50/70 dark:bg-emerald-950/30 hover:bg-emerald-100/70 dark:hover:bg-emerald-950/50'
                        : 'hover:bg-gray-50 dark:hover:bg-gray-800/40'
                    }`}
                  >
                    <div
                      className={`mt-0.5 shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                        data.type === 'activity_completed'
                          ? 'bg-[#4E9F3D]/15 text-[#4E9F3D]'
                          : 'bg-blue-500/15 text-blue-600 dark:text-blue-400'
                      }`}
                    >
                      {data.type === 'activity_completed' ? (
                        <Check className="w-4 h-4" />
                      ) : (
                        <ClipboardList className="w-4 h-4" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className={`text-xs truncate ${isUnread ? 'font-bold' : 'font-medium'}`}>
                          {safeText(data.title, 'Notificación')}
                        </p>
                        {isUnread && (
                          <span className="shrink-0 w-2 h-2 rounded-full bg-blue-500" aria-label="No leída" />
                        )}
                      </div>
                      <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">
                        {safeText(data.message, '')}
                      </p>
                      <div className="flex items-center gap-1 mt-1 text-[10px] text-gray-400 dark:text-gray-500">
                        <Clock className="w-3 h-3" />
                        {formatRelativeTime(notification.created_at)}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
