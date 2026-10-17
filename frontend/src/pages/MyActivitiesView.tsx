import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Eye,
  Filter,
  Loader2,
  RefreshCw,
  Search,
  Timer,
} from 'lucide-react';
import { useToast } from '../context/ToastContext';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { PageHeader } from '../components/ui/PageHeader';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { activityService } from '../services/activityService';
import { safeText } from '../utils/safeText';
import {
  ACTIVITY_STATUS_LABELS,
  SUBORDINATE_STATUS_OPTIONS,
  type Activity,
  type ActivityStats,
  type ActivityStatus,
} from '../types/activity';

type StatusFilter = '' | ActivityStatus;

const STATUS_BADGE: Record<ActivityStatus, 'warning' | 'info' | 'success'> = {
  pendiente: 'warning',
  en_proceso: 'info',
  terminada: 'success',
};

const formatDate = (iso?: string | null): string => {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return safeText(iso, '—');
  return date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
};

/**
 * Bandeja de actividades del subordinado (encargado).
 *
 * Lista las tareas asignadas al usuario autenticado y permite
 * cambiar el estado con exactamente dos opciones:
 * «En proceso» y «Terminada».
 */
export const MyActivitiesView: React.FC = () => {
  const { toastSuccess, toastError } = useToast();

  const [activities, setActivities] = useState<Activity[]>([]);
  const [stats, setStats] = useState<ActivityStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('');
  const [searchTerm, setSearchTerm] = useState('');

  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [savingId, setSavingId] = useState<number | null>(null);

  const loadActivities = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage('');

    try {
      const result = await activityService.getMy({
        status: statusFilter || undefined,
        search: searchTerm || undefined,
      });

      setActivities(Array.isArray(result.data) ? result.data : []);
      setStats(result.stats ?? null);
    } catch (error: any) {
      setErrorMessage(error?.response?.data?.message || 'No se pudieron cargar tus actividades.');
      setActivities([]);
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, searchTerm]);

  useEffect(() => {
    void loadActivities();
  }, [loadActivities]);

  const filteredActivities = useMemo(() => {
    if (!searchTerm && !statusFilter) return activities;

    return activities.filter((activity) => {
      const matchesSearch =
        !searchTerm ||
        activity.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (activity.description ?? '').toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = !statusFilter || activity.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [activities, searchTerm, statusFilter]);

  const handleStatusChange = async (activity: Activity, status: ActivityStatus) => {
    setSavingId(activity.id);

    try {
      const updated = await activityService.updateStatus(activity.id, status);

      setActivities((prev) =>
        prev.map((item) => (item.id === activity.id ? { ...item, ...updated } : item))
      );

      if (selectedActivity?.id === activity.id) {
        setSelectedActivity((prev) => (prev ? { ...prev, ...updated } : prev));
      }

      toastSuccess(
        'Estado actualizado',
        `La actividad «${safeText(activity.title, '')}» quedó en «${ACTIVITY_STATUS_LABELS[status]}».`
      );

      // Refrescar stats y lista para reflejar el cambio del backend
      void loadActivities();
    } catch (error: any) {
      toastError('Error', error?.response?.data?.message || 'No se pudo cambiar el estado.');
    } finally {
      setSavingId(null);
    }
  };

  const filterChips: { label: string; value: StatusFilter; count?: number }[] = [
    { label: 'Todas', value: '', count: stats?.total },
    { label: 'Pendientes', value: 'pendiente', count: stats?.pending },
    { label: 'En proceso', value: 'en_proceso', count: stats?.in_progress },
    { label: 'Terminadas', value: 'terminada', count: stats?.completed },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        icon={<ClipboardList className="w-5 h-5" />}
        title="Mis Actividades"
        subtitle={`Tareas asignadas por el administrador. ${stats ? `${stats.total} en total.` : ''}`}
      >
        <Button variant="outline" size="sm" onClick={() => void loadActivities()} icon={<RefreshCw className="w-4 h-4" />}>
          Actualizar
        </Button>
      </PageHeader>

      {/* Resumen */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Pendientes', value: stats?.pending ?? 0, icon: ClipboardList, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-500/10' },
          { label: 'En proceso', value: stats?.in_progress ?? 0, icon: Timer, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-500/10' },
          { label: 'Terminadas', value: stats?.completed ?? 0, icon: CheckCircle2, color: 'text-[#4E9F3D]', bg: 'bg-[#4E9F3D]/10' },
          { label: 'Vencidas', value: stats?.overdue ?? 0, icon: AlertTriangle, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-500/10' },
        ].map((card) => (
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
        <div className="flex flex-col md:flex-row md:items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar actividad..."
              className="w-full px-3 py-2 pl-9 rounded-xl border border-gray-300 dark:border-[#263632] bg-white dark:bg-[#18221F] text-sm text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-[#1B4D3E]"
            />
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <Filter className="w-4 h-4 text-gray-400 mr-1" />
            {filterChips.map((chip) => (
              <button
                key={chip.label}
                onClick={() => setStatusFilter(chip.value)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                  statusFilter === chip.value
                    ? 'bg-[#1B4D3E] text-white border-[#1B4D3E]'
                    : 'bg-white dark:bg-[#18221F] text-gray-600 dark:text-gray-300 border-gray-300 dark:border-[#263632] hover:bg-gray-50 dark:hover:bg-[#263632]'
                }`}
              >
                {chip.label}
                {chip.count !== undefined && <span className="ml-1 opacity-70">({chip.count})</span>}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* Lista de actividades */}
      {errorMessage && (
        <div className="p-3 rounded-xl bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm">
          {errorMessage}
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-gray-400">
          <RefreshCw className="w-6 h-6 animate-spin" />
        </div>
      ) : filteredActivities.length === 0 ? (
        <Card>
          <div className="py-12 text-center text-gray-400 dark:text-gray-500">
            <ClipboardList className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p className="font-semibold">
              {statusFilter || searchTerm ? 'No hay actividades con esos filtros.' : 'No tienes actividades asignadas.'}
            </p>
            <p className="text-xs mt-1">
              {statusFilter || searchTerm
                ? 'Prueba con otro filtro o limpialo.'
                : 'El administrador te asignará tareas que aparecerán aquí.'}
            </p>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredActivities.map((activity) => {
            const isSaving = savingId === activity.id;

            return (
              <Card key={activity.id} className="flex flex-col gap-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-[#1E1E1E] dark:text-gray-100 truncate">
                        {safeText(activity.title, `Actividad #${activity.id}`)}
                      </h3>
                      <Badge variant={STATUS_BADGE[activity.status] ?? 'primary'} className="text-[10px]!">
                        {safeText(activity.status_label ?? ACTIVITY_STATUS_LABELS[activity.status], activity.status)}
                      </Badge>
                      {activity.is_overdue && activity.status !== 'terminada' && (
                        <Badge variant="danger" className="text-[10px]!">
                          Vencida
                        </Badge>
                      )}
                    </div>

                    {activity.description && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                        {safeText(activity.description, '')}
                      </p>
                    )}
                  </div>

                  <button
                    onClick={() => {
                      setSelectedActivity(activity);
                      setIsDetailModalOpen(true);
                    }}
                    className="p-1.5 rounded-lg text-gray-500 hover:text-[#1B4D3E] hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-colors shrink-0"
                    title="Ver detalle"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                  <span className="font-semibold uppercase tracking-wider text-[10px]">Fecha límite:</span>
                  <span className="text-gray-700 dark:text-gray-200">{formatDate(activity.due_date)}</span>
                </div>

                {/* Selector de estado: exactamente dos opciones */}
                <div className="flex items-center gap-2 pt-2 border-t border-gray-100 dark:border-[#263632]">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mr-1">
                    Estado:
                  </span>

                  <div className="flex gap-1.5">
                    {SUBORDINATE_STATUS_OPTIONS.map((option) => {
                      const isActive = activity.status === option;

                      return (
                        <button
                          key={option}
                          onClick={() => !isActive && !isSaving && void handleStatusChange(activity, option)}
                          disabled={isSaving}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition-all disabled:opacity-60 ${
                            isActive
                              ? option === 'terminada'
                                ? 'bg-[#4E9F3D] text-white border-[#4E9F3D] shadow-sm'
                                : 'bg-blue-600 text-white border-blue-600 shadow-sm'
                              : 'bg-white dark:bg-[#18221F] text-gray-600 dark:text-gray-300 border-gray-300 dark:border-[#263632] hover:bg-gray-50 dark:hover:bg-[#263632]'
                          }`}
                          title={
                            option === 'en_proceso'
                              ? 'Marcar como En proceso'
                              : 'Marcar como Terminada'
                          }
                        >
                          {isSaving && isActive === false ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : option === 'terminada' ? (
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          ) : (
                            <Timer className="w-3.5 h-3.5" />
                          )}
                          {ACTIVITY_STATUS_LABELS[option]}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

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

            {selectedActivity.creator && (
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-1">Asignada por</p>
                <p className="text-sm text-gray-700 dark:text-gray-200">
                  {safeText(
                    `${selectedActivity.creator.name ?? ''} ${selectedActivity.creator.lastname ?? ''}`.trim(),
                    'Administración'
                  )}
                </p>
              </div>
            )}

            {selectedActivity.completed_at && (
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-1">Terminada el</p>
                <p className="text-sm text-gray-700 dark:text-gray-200">
                  {new Date(selectedActivity.completed_at).toLocaleString('es-ES')}
                </p>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default MyActivitiesView;
