import React, { useCallback, useEffect, useState } from 'react';
import {
  Activity as ActivityIcon,
  AlertTriangle,
  CheckCircle2,
  Clock,
  RefreshCw,
  Users,
} from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Progress } from '../../components/charts/Progress';
import { analyticsService } from '../../services/analyticsService';
import type { AnalyticsStaff } from '../../types/analytics';
import { CHART_COLORS, formatDaysVsDue, formatHours, formatNumber, formatPercent } from './analyticsShared';
import { KpiCard } from './KpiCard';

interface AnalyticsStaffTabProps {
  farmId?: number | string;
}

/**
 * Pestaña "Personal": productividad del equipo y tiempos de respuesta.
 *
 * Un encargado (subordinate) solo ve su propio desempeño; el backend
 * fuerza ese alcance y lo indica mediante `scope === 'self'`.
 */
export const AnalyticsStaffTab: React.FC<AnalyticsStaffTabProps> = ({ farmId }) => {
  const [data, setData] = useState<AnalyticsStaff | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  const load = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage('');
    try {
      setData(await analyticsService.getStaff(farmId));
    } catch (error: any) {
      setErrorMessage(error?.response?.data?.message || 'No se pudo cargar la analítica de personal.');
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, [farmId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-400">
        <RefreshCw className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="p-3 rounded-xl bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm">
        {errorMessage}
      </div>
    );
  }

  if (!data) {
    return <p className="text-sm text-gray-400 py-10 text-center">Sin datos disponibles.</p>;
  }

  const { summary, team, scope } = data;
  const isSelf = scope === 'self';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
            <Users className="w-4 h-4 text-[#1B4D3E] dark:text-[#6DBF5C]" />
            {isSelf ? 'Mi desempeño' : 'Desempeño del equipo'}
          </h3>
          <p className="text-xs text-gray-400 mt-0.5">
            {isSelf
              ? 'Vista limitada a tus propias actividades asignadas.'
              : 'Cumplimiento, cargas de trabajo y tiempos de respuesta del personal.'}
          </p>
        </div>
        <Button variant="outline" onClick={() => void load()} icon={<RefreshCw className="w-4 h-4" />}>
          Actualizar
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Actividades totales"
          value={formatNumber(summary.total)}
          icon={ActivityIcon}
          hint={`${formatNumber(summary.completed)} terminadas`}
        />
        <KpiCard
          label="Cumplimiento"
          value={formatPercent(summary.completion_percent)}
          icon={CheckCircle2}
          color="text-[#4E9F3D]"
          bg="bg-[#4E9F3D]/10"
          hint={`${formatNumber(summary.in_progress)} en proceso`}
        />
        <KpiCard
          label="Vencidas"
          value={formatNumber(summary.overdue)}
          icon={AlertTriangle}
          color={summary.overdue > 0 ? 'text-red-600 dark:text-red-400' : 'text-[#4E9F3D]'}
          bg={summary.overdue > 0 ? 'bg-red-500/10' : 'bg-[#4E9F3D]/10'}
          hint={`${formatNumber(summary.pending)} pendientes`}
        />
        <KpiCard
          label="Tiempo de respuesta"
          value={formatHours(summary.avg_response_hours)}
          icon={Clock}
          color="text-blue-600 dark:text-blue-400"
          bg="bg-blue-500/10"
          hint={
            summary.avg_days_vs_due !== null
              ? `Entrega: ${formatDaysVsDue(summary.avg_days_vs_due)}`
              : 'Sin datos de cierre'
          }
        />
      </div>

      {/* Distribución global */}
      <Card title="Distribución de actividades" subtitle="Progreso consolidado">
        <div className="space-y-3">
          <Progress
            value={summary.completion_percent}
            color={CHART_COLORS.accent}
            label="Terminadas"
            valueLabel={`${formatNumber(summary.completed)} / ${formatNumber(summary.total)}`}
          />
          <Progress
            value={summary.total > 0 ? (summary.in_progress / summary.total) * 100 : 0}
            color={CHART_COLORS.blue}
            label="En proceso"
            valueLabel={formatNumber(summary.in_progress)}
          />
          <Progress
            value={summary.total > 0 ? (summary.pending / summary.total) * 100 : 0}
            color={CHART_COLORS.gray}
            label="Pendientes"
            valueLabel={formatNumber(summary.pending)}
          />
          <Progress
            value={summary.total > 0 ? (summary.overdue / summary.total) * 100 : 0}
            color={CHART_COLORS.red}
            label="Vencidas"
            valueLabel={formatNumber(summary.overdue)}
          />
        </div>
      </Card>

      {/* Tabla del equipo */}
      <Card
        title="Productividad por subordinado"
        subtitle={isSelf ? 'Tus indicadores personales' : 'Detalle por miembro del equipo'}
      >
        {team.length === 0 ? (
          <p className="text-xs text-gray-400 py-4">Sin actividades asignadas al personal.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-gray-100 dark:border-[#263632] text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  <th className="py-2.5 pr-3">Subordinado</th>
                  <th className="py-2.5 px-3 text-center">Total</th>
                  <th className="py-2.5 px-3 text-center">Term.</th>
                  <th className="py-2.5 px-3 text-center">Proceso</th>
                  <th className="py-2.5 px-3 text-center">Pend.</th>
                  <th className="py-2.5 px-3 text-center">Venc.</th>
                  <th className="py-2.5 px-3 min-w-[140px]">Avance</th>
                  <th className="py-2.5 px-3 text-center">Respuesta</th>
                  <th className="py-2.5 pl-3 text-center">Entrega</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-[#263632]">
                {team.map((member) => (
                  <tr key={`staff-${member.user_id}`} className="hover:bg-gray-50/70 dark:hover:bg-[#263632]/40">
                    <td className="py-3 pr-3 font-semibold text-gray-800 dark:text-gray-100">
                      {member.name}
                    </td>
                    <td className="py-3 px-3 text-center text-gray-700 dark:text-gray-200">
                      {member.total}
                    </td>
                    <td className="py-3 px-3 text-center text-[#4E9F3D] font-bold">{member.completed}</td>
                    <td className="py-3 px-3 text-center text-blue-600 dark:text-blue-400">
                      {member.in_progress}
                    </td>
                    <td className="py-3 px-3 text-center text-gray-600 dark:text-gray-300">
                      {member.pending}
                    </td>
                    <td className="py-3 px-3 text-center">
                      {member.overdue > 0 ? (
                        <Badge variant="danger" className="text-[10px]!">
                          {member.overdue}
                        </Badge>
                      ) : (
                        <span className="text-gray-400">0</span>
                      )}
                    </td>
                    <td className="py-3 px-3">
                      <Progress
                        value={member.completion_percent}
                        color={CHART_COLORS.accent}
                        valueLabel={formatPercent(member.completion_percent)}
                      />
                    </td>
                    <td className="py-3 px-3 text-center text-gray-600 dark:text-gray-300">
                      {formatHours(member.avg_response_hours)}
                    </td>
                    <td className="py-3 pl-3 text-center">
                      {member.avg_days_vs_due === null ? (
                        <span className="text-gray-400">—</span>
                      ) : (
                        <span
                          className={`font-semibold ${
                            member.avg_days_vs_due <= 0
                              ? 'text-[#4E9F3D]'
                              : 'text-red-600 dark:text-red-400'
                          }`}
                        >
                          {formatDaysVsDue(member.avg_days_vs_due)}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="flex items-center gap-2 text-xs text-gray-400 mt-4">
          <Clock className="w-3.5 h-3.5" />
          Tiempo de respuesta = promedio entre la creación de la actividad y su finalización.
        </div>
      </Card>
    </div>
  );
};

export default AnalyticsStaffTab;
