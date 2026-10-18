import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { PageHeader } from '../components/ui/PageHeader';
import { Button } from '../components/ui/Button';
import { Donut } from '../components/charts/Donut';
import { Sparkline } from '../components/charts/Sparkline';
import { activityService } from '../services/activityService';
import { useNow } from '../hooks/useNow';
import { timeAgo } from '../utils/timeAgo';
import {
  ClipboardCheck,
  CheckCircle2,
  ArrowRight,
  TrendingUp,
  ShieldCheck,
  Clock,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';

import { SkeletonLoader } from '../components/ui/SkeletonLoader';
import { safeText } from '../utils/safeText';
import { ACTIVITY_STATUS_LABELS, type Activity } from '../types/activity';

const formatShortDate = (iso?: string | null): string => {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
};

export const EncargadoDashboard: React.FC = () => {
  const { user, activeFarm } = useAuth();
  const navigate = useNavigate();

  const [activities, setActivities] = useState<Activity[]>([]);
  const [isLoadingActivities, setIsLoadingActivities] = useState(true);

  // Datos en vivo: último refresco, refresco manual y muestreo de tendencia
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pendingTrend, setPendingTrend] = useState<number[]>([]);
  const now = useNow(1000);

  const loadActivities = useCallback(async (showSpinner: boolean = true) => {
    if (showSpinner) setIsLoadingActivities(true);
    try {
      const result = await activityService.getMy();
      // Ordena por estado para mostrar primero las pendientes/en proceso
      const sorted = [...(result.data || [])].sort((a, b) => {
        const order: Record<string, number> = { pendiente: 0, en_proceso: 1, terminada: 2 };
        return (order[a.status] ?? 3) - (order[b.status] ?? 3);
      });
      setActivities(sorted);
    } catch {
      // El módulo puede estar deshabilitado: el dashboard sigue funcionando
      setActivities([]);
    } finally {
      setIsLoadingActivities(false);
      setLastUpdated(new Date());
    }
  }, []);

  useEffect(() => {
    void loadActivities();
  }, [loadActivities]);

  // Auto-refresco silencioso cada 30 s (datos en vivo)
  useEffect(() => {
    const id = window.setInterval(() => {
      void loadActivities(false);
    }, 30000);
    return () => window.clearInterval(id);
  }, [loadActivities]);

  // Distribución de actividades por estado (categorías mutuamente excluyentes)
  const overdueCount = activities.filter((a) => a.is_overdue && a.status !== 'terminada').length;
  const pendingCount = activities.filter((a) => a.status === 'pendiente' && !a.is_overdue).length;
  const inProgressCount = activities.filter((a) => a.status === 'en_proceso' && !a.is_overdue).length;
  const doneCount = activities.filter((a) => a.status === 'terminada').length;
  const activitySegments = [
    { label: 'Pendientes', value: pendingCount, color: '#F59E0B' },
    { label: 'En proceso', value: inProgressCount, color: '#3B82F6' },
    { label: 'Terminadas', value: doneCount, color: '#4E9F3D' },
    { label: 'Vencidas', value: overdueCount, color: '#EF4444' },
  ];

  // Muestreo para la mini-gráfica de tendencia de la sesión
  useEffect(() => {
    if (!lastUpdated) return;
    setPendingTrend((prev) => [...prev, pendingCount].slice(-20));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastUpdated]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await loadActivities(false);
    } finally {
      setIsRefreshing(false);
    }
  };

  if (!user) {
    return <SkeletonLoader type="dashboard" />;
  }

  const assignedModules = user?.enabledModules || [];
  const topActivities = activities.slice(0, 5);

  return (
    <div className="space-y-6">
      
      {/* Top Operational Banner */}
      <PageHeader
        icon={<ClipboardCheck className="w-5 h-5" />}
        badge="Panel Operativo de Campo (Encargado)"
        title={`Hola, ${safeText(user?.name, 'Encargado')}`}
        subtitle={`${safeText(user?.farmName || activeFarm?.name, 'Granja Agropecuaria')} — Tareas de campo, registro de bitácora y monitoreo de lotes asignados por tu Administrador.`}
      >
        <div className="flex items-center gap-2">
          <div className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-[#4E9F3D]/10 text-[#1B4D3E] dark:text-[#6DBF5C] text-xs font-semibold border border-[#4E9F3D]/20">
            <Clock className="w-4 h-4" />
            <span>
              Turno Activo •{' '}
              {now.toLocaleTimeString('es-ES', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
              })}
            </span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
            icon={<RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />}
          >
            Actualizar
          </Button>
        </div>
      </PageHeader>

      {/* Security Context Banner */}
      <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 rounded-2xl border border-emerald-200 dark:border-[#263632] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ShieldCheck className="w-5 h-5 text-[#4E9F3D] shrink-0" />
          <div>
            <div className="font-bold text-xs text-[#1B4D3E] dark:text-[#6DBF5C]">
              Acceso Restringido por Rol (Encargado)
            </div>
            <div className="text-[11px] text-gray-600 dark:text-gray-400">
              Tienes acceso a <span className="font-bold text-[#4E9F3D]">{assignedModules.length} módulos</span> permitidos por tu Administrador. Las funciones de configuración global están inactivas por seguridad.
            </div>
          </div>
        </div>

        <div className="flex flex-col items-end gap-1 shrink-0">
          <Badge variant="success">Filtro de Seguridad Activo</Badge>
          {lastUpdated && (
            <span className="text-[10px] text-gray-400 dark:text-gray-500">
              Actualizado {timeAgo(lastUpdated, now)}
            </span>
          )}
        </div>
      </div>

      {/* Daily Routine / Assigned Activities */}
      <Card
        title="Mis Actividades Asignadas"
        subtitle="Tareas que tu administrador te ha asignado. Gestiona el estado desde «Mis Actividades»."
        action={
          <button
            onClick={() => navigate('/mis-actividades')}
            className="flex items-center gap-1 text-xs font-bold text-[#4E9F3D] hover:underline cursor-pointer"
          >
            <span>Ver todas</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        }
      >
        {isLoadingActivities ? (
          <div className="flex items-center justify-center py-8 text-gray-400">
            <RefreshCw className="w-5 h-5 animate-spin" />
          </div>
        ) : activities.length === 0 ? (
          <div className="py-8 text-center text-gray-400 dark:text-gray-500">
            <ClipboardCheck className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm font-semibold">No tienes actividades asignadas por ahora.</p>
            <p className="text-xs mt-1">Cuando tu administrador te asigne una tarea, aparecerá aquí.</p>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Resumen visual: distribución + tendencia de la sesión */}
            <div className="p-4 rounded-2xl bg-gray-50/60 dark:bg-[#121816] border border-gray-100 dark:border-[#263632]">
              <div className="flex flex-col lg:flex-row items-start gap-6">
                <Donut
                  segments={activitySegments}
                  size={140}
                  thickness={20}
                  centerValue={String(activities.length)}
                  showLegend={false}
                />
                <div className="flex-1 w-full">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {activitySegments.map((segment) => (
                      <div
                        key={`activity-stat-${segment.label}`}
                        className="rounded-xl bg-white dark:bg-[#18221F] border border-gray-100 dark:border-[#263632] px-3 py-2"
                      >
                        <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-gray-500">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: segment.color }} />
                          {segment.label}
                        </div>
                        <div className="text-lg font-black text-[#1E1E1E] dark:text-white">
                          {segment.value}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4">
                    <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-gray-500 mb-1">
                      <TrendingUp className="w-3.5 h-3.5 text-[#4E9F3D]" /> Tendencia de pendientes (sesión)
                    </div>
                    <Sparkline
                      data={pendingTrend}
                      color="#4E9F3D"
                      height={40}
                      ariaLabel="Tendencia de actividades pendientes"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-3">
            {topActivities.map((activity) => (
              <div
                key={activity.id}
                className="p-3 rounded-xl border border-gray-100 dark:border-[#263632] flex items-center justify-between bg-gray-50/50 dark:bg-[#121816]"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {activity.status === 'terminada' ? (
                    <CheckCircle2 className="w-5 h-5 text-[#4E9F3D] shrink-0" />
                  ) : activity.is_overdue ? (
                    <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
                  ) : (
                    <Clock className="w-5 h-5 text-blue-500 shrink-0" />
                  )}
                  <div className="min-w-0">
                    <div className="font-semibold text-xs text-gray-900 dark:text-gray-100 truncate">
                      {safeText(activity.title, `Actividad #${activity.id}`)}
                    </div>
                    <div className="text-[10px] text-gray-500">
                      Fecha límite: {formatShortDate(activity.due_date)}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {activity.is_overdue && activity.status !== 'terminada' && (
                    <Badge variant="danger" className="text-[10px]!">
                      Vencida
                    </Badge>
                  )}
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      activity.status === 'terminada'
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                        : activity.status === 'en_proceso'
                          ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                          : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                    }`}
                  >
                    {safeText(
                      ACTIVITY_STATUS_LABELS[activity.status as keyof typeof ACTIVITY_STATUS_LABELS] ??
                        activity.status_label ??
                        activity.status,
                      activity.status
                    )}
                  </span>
                </div>
              </div>
            ))}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};
