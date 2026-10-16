/**
 * Tipos del módulo de Actividades (tareas asignadas a subordinados)
 * y de la bandeja de notificaciones.
 */

export type ActivityStatus = 'pendiente' | 'en_proceso' | 'terminada';

/** Estados que el subordinado puede elegir (exactamente dos). */
export const SUBORDINATE_STATUS_OPTIONS: ActivityStatus[] = ['en_proceso', 'terminada'];

export const ACTIVITY_STATUS_LABELS: Record<ActivityStatus, string> = {
  pendiente: 'Pendiente',
  en_proceso: 'En proceso',
  terminada: 'Terminada',
};

export interface ActivityUser {
  id: number;
  name: string;
  lastname?: string | null;
  email?: string;
}

export interface Activity {
  id: number;
  farm_id: number;
  created_by: number | null;
  assigned_to: number;
  title: string;
  description?: string | null;
  due_date: string;
  status: ActivityStatus;
  status_label: string;
  is_overdue: boolean;
  completed_at?: string | null;
  created_at?: string;
  updated_at?: string | null;
  assignee?: ActivityUser | null;
  creator?: ActivityUser | null;
  farm?: { id: number; name?: string } | null;
  farm_name?: string | null;
}

export interface ActivityStats {
  total: number;
  pending: number;
  in_progress: number;
  completed: number;
  overdue: number;
}

export interface CreateActivityDTO {
  title: string;
  description?: string | null;
  due_date: string;
  assigned_to: number;
  farm_id?: number;
}

export interface UpdateActivityDTO {
  title: string;
  description?: string | null;
  due_date: string;
  assigned_to: number;
}

export interface ActivityListResponse {
  data: Activity[];
  stats?: ActivityStats;
}

/**
 * Notificación persistida en la tabla `notifications` (canal database
 * de Laravel). El `data` del backend se envía "plano" al hacer el
 * mapeo, por eso se expone con `type`, `title`, `message`, etc.
 */
export interface AppNotification {
  id: string;
  type: string;
  data?: {
    type?: string;
    title?: string;
    message?: string;
    activity_id?: number;
    activity_title?: string;
    status?: string;
    due_date?: string;
    farm_id?: number;
  };
  created_at?: string;
  read_at?: string | null;
}

export interface NotificationListResponse {
  data: AppNotification[];
  unread_count: number;
  total: number;
}
