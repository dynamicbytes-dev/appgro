import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  Activity as ActivityIcon,
  Egg,
  Layers,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  Wallet,
  Warehouse,
} from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Gauge } from '../../components/charts/Gauge';
import { Donut } from '../../components/charts/Donut';
import { analyticsService } from '../../services/analyticsService';
import type { AnalyticsOperations, AnalyticsSummary } from '../../types/analytics';
import { LOT_STATUS_LABELS } from '../../types/analytics';
import {
  CHART_COLORS,
  PURPOSE_COLORS,
  STATUS_COLORS,
  colorForKey,
  formatMoney,
  formatNumber,
  formatPercent,
} from './analyticsShared';
import { KpiCard } from './KpiCard';

interface AnalyticsExecutiveTabProps {
  farmId?: number | string;
}

/**
 * Pestaña "Resumen Ejecutivo": KPIs de alto nivel, ocupación global y
 * composición de lotes. Es la vista de entrada para administradores.
 */
export const AnalyticsExecutiveTab: React.FC<AnalyticsExecutiveTabProps> = ({ farmId }) => {
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [operations, setOperations] = useState<AnalyticsOperations | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  const load = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage('');
    try {
      const [summaryResult, operationsResult] = await Promise.all([
        analyticsService.getSummary(farmId),
        analyticsService.getOperations(farmId),
      ]);
      setSummary(summaryResult);
      setOperations(operationsResult);
    } catch (error: any) {
      setErrorMessage(error?.response?.data?.message || 'No se pudo cargar el resumen ejecutivo.');
      setSummary(null);
      setOperations(null);
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

  if (!summary) {
    return <p className="text-sm text-gray-400 py-10 text-center">Sin datos disponibles.</p>;
  }

  const statusSegments = (operations?.lots.by_status ?? []).map((row) => ({
    label: LOT_STATUS_LABELS[row.status] ?? row.status,
    value: row.count,
    color: colorForKey(STATUS_COLORS, row.status, CHART_COLORS.gray),
  }));

  const purposeSegments = (operations?.lots.by_purpose ?? []).map((row) => ({
    label: row.label,
    value: row.count,
    color: colorForKey(PURPOSE_COLORS, row.purpose, CHART_COLORS.gray),
  }));

  const marginPositive = summary.profit >= 0;

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={() => void load()} icon={<RefreshCw className="w-4 h-4" />}>
          Actualizar
        </Button>
      </div>

      {/* KPIs financieros */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <KpiCard
          label="Costo total de producción"
          value={formatMoney(summary.total_cost)}
          icon={Wallet}
          color="text-[#1B4D3E] dark:text-[#6DBF5C]"
          bg="bg-[#1B4D3E]/10"
          hint="Inversión + insumos + huevos"
        />
        <KpiCard
          label="Cosecha global (ingreso)"
          value={formatMoney(summary.total_revenue)}
          icon={TrendingUp}
          color="text-[#4E9F3D]"
          bg="bg-[#4E9F3D]/10"
          hint="Valor de venta de animales"
        />
        <KpiCard
          label={marginPositive ? 'Utilidad' : 'Pérdida'}
          value={formatMoney(Math.abs(summary.profit))}
          icon={marginPositive ? TrendingUp : TrendingDown}
          color={marginPositive ? 'text-[#4E9F3D]' : 'text-red-600 dark:text-red-400'}
          bg={marginPositive ? 'bg-[#4E9F3D]/10' : 'bg-red-500/10'}
          hint={`Margen ${formatPercent(summary.margin_percent)}`}
        />
      </div>

      {/* KPIs operativos */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Ocupación de galpones"
          value={formatPercent(summary.occupancy_percent)}
          icon={Warehouse}
          hint={`${formatNumber(summary.occupied)} / ${formatNumber(summary.capacity)} cupos`}
        />
        <KpiCard
          label="Huevos recolectados"
          value={formatNumber(summary.eggs_total)}
          icon={Egg}
          color="text-amber-600 dark:text-amber-400"
          bg="bg-amber-500/10"
          hint={`${formatNumber(summary.eggs_good)} buenos · ${formatNumber(summary.eggs_broken)} rotos`}
        />
        <KpiCard
          label="Merma de huevos"
          value={formatPercent(summary.broken_percent)}
          icon={AlertTriangle}
          color={summary.broken_percent > 10 ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'}
          bg={summary.broken_percent > 10 ? 'bg-red-500/10' : 'bg-amber-500/10'}
          hint="Rotos sobre el total recolectado"
        />
        <KpiCard
          label="Actividades terminadas"
          value={formatPercent(summary.activities_percent)}
          icon={ActivityIcon}
          color="text-blue-600 dark:text-blue-400"
          bg="bg-blue-500/10"
          hint={`${formatNumber(summary.activities_completed)} de ${formatNumber(summary.activities_total)}`}
        />
      </div>

      {summary.items_at_risk > 0 ? (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>
            {summary.items_at_risk} insumo(s) en riesgo por bajo stock o próximo vencimiento. Revísalos en
            la pestaña Operativa.
          </span>
        </div>
      ) : null}

      {/* Gráficas */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card title="Ocupación global" subtitle="Capacidad de galpones activos">
          <Gauge
            value={summary.occupancy_percent}
            color={CHART_COLORS.accent}
            centerLabel={`${formatNumber(summary.occupied)}/${formatNumber(summary.capacity)}`}
          />
        </Card>

        <Card title="Lotes por estado" subtitle={`${formatNumber(summary.lots_total)} lotes registrados`}>
          <Donut
            segments={statusSegments}
            centerValue={formatNumber(summary.lots_total)}
            size={168}
          />
        </Card>

        <Card title="Lotes por propósito" subtitle="Carne, postura y reproducción">
          {purposeSegments.length > 0 ? (
            <Donut segments={purposeSegments} size={168} />
          ) : (
            <div className="flex items-center gap-2 text-xs text-gray-400 py-10">
              <Layers className="w-4 h-4" />
              <span>Sin lotes para clasificar.</span>
            </div>
          )}
        </Card>
      </div>

      <p className="text-xs text-gray-400 dark:text-gray-500">
        El costo de insumos se agrega a nivel de granja (los movimientos de inventario no se
        atribuyen a un lote específico). Los lotes sin costo de inversión registrado se excluyen de
        los totales de inversión.
      </p>
    </div>
  );
};

export default AnalyticsExecutiveTab;
