import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Clock,
  Edit2,
  Eye,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Timer,
  Trash2,
  XCircle,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { activityService } from '../../services/activityService';
import { subordinateService } from '../../services/subordinateService';
import { safeText } from '../../utils/safeText';
import {
  ACTIVITY_STATUS_LABELS,
  type Activity,
  type ActivityStatus,
  type ActivityStats,
} from '../../types/activity';

interface SubordinateOption {
  id: number;
  name: string;
  lastname?: string | null;
  email?: string;
}

const STATUS_BADGE: Record<ActivityStatus, 'warning' | 'info' | 'success'> = {
  pendiente: 'warning',
  en_proceso: 'info',
  terminada: 'success',
};

const inputClasses =
  'w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-[#263632] bg-white dark:bg-[#18221F] text-sm text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-[#1B4D3E]';

const todayIso = () => new Date().toISOString().split('T')[0];

const formatDate = (iso?: string | null): string => {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return safeText(iso, '—');
  return date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
};

const fullName = (user?: { name: string; lastname?: string | null } | null): string =>
  user ? `${safeText(user.name, '')} ${safeText(user.lastname ?? '', '')}`.trim() || 'Sin asignar' : 'Sin asignar';

/**
 * Panel del administrador: creación, listado y seguimiento de las
 * actividades de su personal. El módulo 'actividades' debe estar
 * habilitado para la granja (ModuleGuard en la ruta).
 */
export const AdminActivitiesView: React.FC = () => {
  const { user, activeFarm } = useAuth();
  const { toastSuccess, toastError } = useToast();

  const [activities, setActivities] = useState<Activity[]>([]);
  const [stats, setStats] = useState<ActivityStats | null>(null);
  const [subordinates, setSubordinates] = useState<SubordinateOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [assigneeFilter, setAssigneeFilter] = useState('');

  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [form, setForm] = useState({ title: '', description: '', due_date: '', assigned_to: '' });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const isAdmin = user?.role === 'admin' || user?.role === 'ADMIN';

  const loadSubordinates = useCallback(async () => {
    try {
      const list = await subordinateService.getAllSubordinates();
      const normalized = (Array.isArray(list) ? list : [])
        .filter((sub: any) => sub?.is_active === undefined || sub.is_active === true || sub.is_active === 1)
        .map((sub: any) => ({
          id: Number(sub.id),
          name: safeText(sub.name, `Subordinado #${sub.id}`),
          lastname: sub.lastname ?? null,
          email: sub.email,
        }))
        .filter((sub: SubordinateOption) => !Number.isNaN(sub.id));
      setSubordinates(normalized);
    } catch {
      setSubordinates([]);
    }
  }, []);

  const loadActivities = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage('');

    try {
      const result = await activityService.getAll({
        status: statusFilter || undefined,
        assigned_to: assigneeFilter || undefined,
        search: searchTerm || undefined,
        farm_id: (activeFarm?.id as number) || (user?.farm_id as number) || undefined,
      });

      setActivities(Array.isArray(result.data) ? result.data : []);
      setStats(result.stats ?? null);
    } catch (error: any) {
      const message =
        error?.response?.data?.message || 'No se pudieron cargar las actividades.';
      setErrorMessage(message);
      setActivities([]);
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, assigneeFilter, searchTerm, activeFarm?.id, user?.farm_id]);

  useEffect(() => {
    void loadActivities();
  }, [loadActivities]);

  useEffect(() => {
    void loadSubordinates();
  }, [loadSubordinates]);

  const filteredActivities = useMemo(() => {
    if (!searchTerm && !statusFilter && !assigneeFilter) return activities;

    return activities.filter((activity) => {
      const matchesSearch =
        !searchTerm ||
        activity.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (activity.description ?? '').toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = !statusFilter || activity.status === statusFilter;
      const matchesAssignee = !assigneeFilter || String(activity.assigned_to) === String(assigneeFilter);

      return matchesSearch && matchesStatus && matchesAssignee;
    });
  }, [activities, searchTerm, statusFilter, assigneeFilter]);

  const openCreateModal = () => {
    setForm({ title: '', description: '', due_date: '', assigned_to: '' });
    setFormErrors({});
    setSelectedActivity(null);
    setIsFormModalOpen(true);
  };

  const openEditModal = (activity: Activity) => {
    setForm({
      title: activity.title,
      description: activity.description ?? '',
      due_date: (activity.due_date ?? '').split('T')[0],
      assigned_to: String(activity.assigned_to),
    });
    setFormErrors({});
    setSelectedActivity(activity);
    setIsFormModalOpen(true);
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!form.title.trim()) errors.title = 'El título es obligatorio.';
    if (!form.due_date) errors.due_date = 'La fecha límite es obligatoria.';
    if (!form.assigned_to) errors.assigned_to = 'Debe seleccionar un subordinado.';

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!validateForm()) return;

    setIsSaving(true);
    try {
      if (selectedActivity) {
        await activityService.update(selectedActivity.id, {
          title: form.title.trim(),
          description: form.description.trim() || null,
          due_date: form.due_date,
          assigned_to: Number(form.assigned_to),
        });
        toastSuccess('Actividad actualizada', 'Los cambios se guardaron correctamente.');
      } else {
        await activityService.create({
          title: form.title.trim(),
          description: form.description.trim() || null,
          due_date: form.due_date,
          assigned_to: Number(form.assigned_to),
        });
        toastSuccess(
          'Actividad asignada',
          'Se registró la actividad y se notificó al encargado.'
        );
      }

      setIsFormModalOpen(false);
      await loadActivities();
    } catch (error: any) {
      const payload = error?.response?.data;
      const backendErrors = payload?.errors;

      if (backendErrors && typeof backendErrors === 'object') {
        const mapped: Record<string, string> = {};
        Object.entries(backendErrors).forEach(([field, messages]) => {
          mapped[field] = Array.isArray(messages) ? String(messages[0]) : String(messages);
        });
        setFormErrors(mapped);
      }

      toastError('Error', payload?.message || 'No se pudo guardar la actividad.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleStatusChange = async (activity: Activity, status: ActivityStatus) => {
    try {
      await activityService.updateStatus(activity.id, status);
      toastSuccess('Estado actualizado', `La actividad quedó en «${ACTIVITY_STATUS_LABELS[status]}».`);
      await loadActivities();
    } catch (error: any) {
      toastError('Error', error?.response?.data?.message || 'No se pudo cambiar el estado.');
    }
  };

  const handleDelete = async () => {
    if (!selectedActivity) return;

    try {
      await activityService.remove(selectedActivity.id);
      toastSuccess('Actividad eliminada', 'El registro fue eliminado correctamente.');
      setIsDeleteModalOpen(false);
      setSelectedActivity(null);
      await loadActivities();
    } catch (error: any) {
      toastError('Error', error?.response?.data?.message || 'No se pudo eliminar la actividad.');
      setIsDeleteModalOpen(false);
    }
  };

  const statsCards = [
    { label: 'Pendientes', value: stats?.pending ?? 0, icon: Clock, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-500/10' },
    { label: 'En proceso', value: stats?.in_progress ?? 0, icon: Timer, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-500/10' },
    { label: 'Terminadas', value: stats?.completed ?? 0, icon: CheckCircle2, color: 'text-[#4E9F3D]', bg: 'bg-[#4E9F3D]/10' },
    { label: 'Vencidas', value: stats?.overdue ?? 0, icon: AlertTriangle, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-500/10' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <ClipboardList className="w-6 h-6 text-[#1B4D3E] dark:text-[#6DBF5C]" />
            <h1 className="text-2xl font-extrabold text-[#1E1E1E] dark:text-gray-100 tracking-tight">
              Actividades
            </h1>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Crea tareas y asígnalas a tu personal. {stats ? `${stats.total} en total.` : ''}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => void loadActivities()} icon={<RefreshCw className="w-4 h-4" />}>
            Actualizar
          </Button>
          {isAdmin && (
            <Button variant="accent" onClick={openCreateModal} icon={<Plus className="w-4 h-4" />}>
              Nueva Actividad
            </Button>
          )}
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statsCards.map((card) => (
          <Card key={card.label} className="p-4!">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl ${card.bg} flex items-center justify-center`}>
                <card.icon className={`w-5 h-5 ${card.color}`} />
              </div>
              <div>
                <p className="text-2xl font-extrabold text-[#1E1E1E] dark:text-gray-100">{card.value}</p>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  {card.label}
                </p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Filtros */}
      <Card>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por título o descripción..."
              className={`${inputClasses} pl-9`}
            />
          </div>

          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={inputClasses}>
            <option value="">Todos los estados</option>
            <option value="pendiente">Pendiente</option>
            <option value="en_proceso">En proceso</option>
            <option value="terminada">Terminada</option>
          </select>

          <select value={assigneeFilter} onChange={(e) => setAssigneeFilter(e.target.value)} className={inputClasses}>
            <option value="">Todo el personal</option>
            {subordinates.map((subordinate) => (
              <option key={subordinate.id} value={subordinate.id}>
                {safeText(subordinate.name, `Subordinado #${subordinate.id}`)} {safeText(subordinate.lastname ?? '', '')}
              </option>
            ))}
          </select>
        </div>
      </Card>

      {/* Tabla de actividades */}
      <Card className="overflow-hidden p-0!">
        {errorMessage && (
          <div className="m-4 p-3 rounded-xl bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm">
            {errorMessage}
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-gray-400">
            <RefreshCw className="w-6 h-6 animate-spin" />
          </div>
        ) : filteredActivities.length === 0 ? (
          <div className="py-16 text-center text-gray-400 dark:text-gray-500">
            <ClipboardList className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p className="font-semibold">No hay actividades registradas.</p>
            <p className="text-xs mt-1">Crea la primera actividad con el botón «Nueva Actividad».</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 dark:bg-[#263632] text-[11px] uppercase tracking-wider text-gray-500 dark:text-gray-300">
                  <th className="px-4 py-3 font-bold">Actividad</th>
                  <th className="px-4 py-3 font-bold">Asignada a</th>
                  <th className="px-4 py-3 font-bold">Fecha límite</th>
                  <th className="px-4 py-3 font-bold">Estado</th>
                  <th className="px-4 py-3 font-bold text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-[#263632]">
                {filteredActivities.map((activity) => (
                  <tr
                    key={activity.id}
                    className="hover:bg-gray-50 dark:hover:bg-[#263632]/40 transition-colors"
                  >
                    <td className="px-4 py-3 max-w-[280px]">
                      <p className="font-semibold text-sm text-[#1E1E1E] dark:text-gray-100 truncate">
                        {safeText(activity.title, `Actividad #${activity.id}`)}
                      </p>
                      {activity.description && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
                          {safeText(activity.description, '')}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-200">
                      {safeText(fullName(activity.assignee), 'Sin asignar')}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-gray-700 dark:text-gray-200">{formatDate(activity.due_date)}</span>
                        {activity.is_overdue && activity.status !== 'terminada' && (
                          <Badge variant="danger" className="text-[10px]!">
                            Vencida
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={STATUS_BADGE[activity.status] ?? 'primary'}>
                        {safeText(activity.status_label ?? ACTIVITY_STATUS_LABELS[activity.status], activity.status)}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => {
                            setSelectedActivity(activity);
                            setIsDetailModalOpen(true);
                          }}
                          className="p-1.5 rounded-lg text-gray-500 hover:text-[#1B4D3E] hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-colors"
                          title="Ver detalle"
                        >
                          <Eye className="w-4 h-4" />
                        </button>

                        {isAdmin && activity.status !== 'terminada' && (
                          <>
                            <button
                              onClick={() => openEditModal(activity)}
                              className="p-1.5 rounded-lg text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors"
                              title="Editar actividad"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>

                            <button
                              onClick={() => {
                                setSelectedActivity(activity);
                                setIsDeleteModalOpen(true);
                              }}
                              className="p-1.5 rounded-lg text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
                              title="Eliminar actividad"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Modal Crear / Editar */}
      <Modal
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        title={selectedActivity ? 'Editar Actividad' : 'Nueva Actividad'}
        subtitle={selectedActivity ? 'Actualiza los datos de la tarea' : 'Asigna una tarea a tu personal'}
        maxWidth="md"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">
              Título *
            </label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Ej: Alimentar cerdos de la mañana"
              className={inputClasses}
            />
            {formErrors.title && <p className="text-xs text-red-600 mt-1">{formErrors.title}</p>}
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">
              Descripción
            </label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Detalles adicionales de la tarea..."
              rows={3}
              className={`${inputClasses} resize-none`}
            />
            {formErrors.description && <p className="text-xs text-red-600 mt-1">{formErrors.description}</p>}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">
                Fecha límite *
              </label>
              <input
                type="date"
                value={form.due_date}
                min={selectedActivity ? undefined : todayIso()}
                onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                className={inputClasses}
              />
              {formErrors.due_date && <p className="text-xs text-red-600 mt-1">{formErrors.due_date}</p>}
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">
                Asignar a *
              </label>
              <select
                value={form.assigned_to}
                onChange={(e) => setForm({ ...form, assigned_to: e.target.value })}
                className={inputClasses}
              >
                <option value="">Seleccionar encargado...</option>
                {subordinates.map((subordinate) => (
                  <option key={subordinate.id} value={subordinate.id}>
                    {safeText(subordinate.name, `Subordinado #${subordinate.id}`)} {safeText(subordinate.lastname ?? '', '')}
                  </option>
                ))}
              </select>
              {formErrors.assigned_to && <p className="text-xs text-red-600 mt-1">{formErrors.assigned_to}</p>}
              {subordinates.length === 0 && (
                <p className="text-xs text-amber-600 mt-1">
                  No hay encargados activos en tu granja. Crea uno desde «Encargados».
                </p>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-gray-100 dark:border-[#263632]">
            <Button type="button" variant="outline" onClick={() => setIsFormModalOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="accent" disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Guardando...
                </>
              ) : selectedActivity ? (
                'Guardar Cambios'
              ) : (
                'Crear Actividad'
              )}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal Detalle */}
      <Modal
        isOpen={isDetailModalOpen}
        onClose={() => {
          setIsDetailModalOpen(false);
          setSelectedActivity(null);
        }}
        title="Detalle de la Actividad"
        subtitle={selectedActivity ? `#${selectedActivity.id}` : undefined}
        maxWidth="md"
      >
        {selectedActivity && (
          <div className="space-y-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-1">Título</p>
              <p className="font-semibold text-[#1E1E1E] dark:text-gray-100">
                {safeText(selectedActivity.title, 'Sin título')}
              </p>
            </div>

            {selectedActivity.description && (
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-1">Descripción</p>
                <p className="text-sm text-gray-700 dark:text-gray-200 whitespace-pre-wrap">
                  {safeText(selectedActivity.description, '')}
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-1">Asignada a</p>
                <p className="text-sm text-gray-700 dark:text-gray-200">
                  {safeText(fullName(selectedActivity.assignee), 'Sin asignar')}
                </p>
                <p className="text-xs text-gray-400">{safeText(selectedActivity.assignee?.email ?? '', '')}</p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-1">Creada por</p>
                <p className="text-sm text-gray-700 dark:text-gray-200">
                  {safeText(fullName(selectedActivity.creator), 'Sistema')}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-1">Fecha límite</p>
                <div className="flex items-center gap-2">
                  <p className="text-sm text-gray-700 dark:text-gray-200">{formatDate(selectedActivity.due_date)}</p>
                  {selectedActivity.is_overdue && selectedActivity.status !== 'terminada' && (
                    <Badge variant="danger" className="text-[10px]!">
                      Vencida
                    </Badge>
                  )}
                </div>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-1">Estado</p>
                <Badge variant={STATUS_BADGE[selectedActivity.status] ?? 'primary'}>
                  {safeText(selectedActivity.status_label ?? ACTIVITY_STATUS_LABELS[selectedActivity.status], selectedActivity.status)}
                </Badge>
              </div>
            </div>

            {selectedActivity.completed_at && (
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-1">Terminada el</p>
                <p className="text-sm text-gray-700 dark:text-gray-200">
                  {new Date(selectedActivity.completed_at).toLocaleString('es-ES')}
                </p>
              </div>
            )}

            {/* Acciones rápidas de estado (solo si no está terminada) */}
            {isAdmin && selectedActivity.status !== 'terminada' && (
              <div className="pt-3 border-t border-gray-100 dark:border-[#263632]">
                <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
                  Cambiar estado manualmente
                </p>
                <div className="flex gap-2">
                  {selectedActivity.status !== 'en_proceso' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        await handleStatusChange(selectedActivity, 'en_proceso');
                        setIsDetailModalOpen(false);
                      }}
                    >
                      En proceso
                    </Button>
                  )}
                  <Button
                    variant="accent"
                    size="sm"
                    onClick={async () => {
                      await handleStatusChange(selectedActivity, 'terminada');
                      setIsDetailModalOpen(false);
                    }}
                  >
                    Terminada
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Modal Eliminar */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setSelectedActivity(null);
        }}
        title="Eliminar Actividad"
        maxWidth="sm"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center shrink-0">
              <XCircle className="w-5 h-5 text-red-600" />
            </div>
            <p className="text-sm text-gray-700 dark:text-gray-200">
              ¿Seguro que deseas eliminar la actividad{' '}
              <span className="font-semibold">«{safeText(selectedActivity?.title, '')}»</span>? Esta acción no se
              puede deshacer.
            </p>
          </div>

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsDeleteModalOpen(false);
                setSelectedActivity(null);
              }}
            >
              Cancelar
            </Button>
            <Button type="button" variant="danger" onClick={() => void handleDelete()}>
              Eliminar
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default AdminActivitiesView;
