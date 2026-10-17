import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Layers,
  Package,
  PackageCheck,
  RefreshCw,
  TrendingDown,
  Warehouse,
} from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Gauge } from '../../components/charts/Gauge';
import { Donut } from '../../components/charts/Donut';
import { analyticsService } from '../../services/analyticsService';
import type { AnalyticsOperations } from '../../types/analytics';
import { LOT_STATUS_LABELS } from '../../types/analytics';
import {
  CHART_COLORS,
  SECTOR_COLORS,
  STATUS_COLORS,
  colorForKey,
  formatDate,
  formatMoney,
  formatNumber,
  formatPercent,
} from './analyticsShared';
import { KpiCard } from './KpiCard';

interface AnalyticsOperationsTabProps {
  farmId?: number | string;
}

/**
 * Pestaña "Operativa / Zootécnica": ocupación real de galpones activos,
 * distribución de lotes e inventario crítico (stock y vencimientos).
 */
export const AnalyticsOperationsTab: React.FC<AnalyticsOperationsTabProps> = ({ farmId }) => {
  const [data, setData] = useState<AnalyticsOperations | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  const load = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage('');
    try {
      setData(await analyticsService.getOperations(farmId));
    } catch (error: any) {
      setErrorMessage(error?.response?.data?.message || 'No se pudo cargar la analítica operativa.');
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

  const { capacity, lots, inventory } = data;

  const statusSegments = lots.by_status.map((row) => ({
    label: LOT_STATUS_LABELS[row.status] ?? row.status,
    value: row.count,
    color: colorForKey(STATUS_COLORS, row.status, CHART_COLORS.gray),
  }));

  const sectorSegments = lots.by_sector.map((row) => ({
    label: row.label,
    value: row.count,
    color: colorForKey(SECTOR_COLORS, row.sector, CHART_COLORS.gray),
  }));

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={() => void load()} icon={<RefreshCw className="w-3.5 h-3.5" />}>
          Actualizar
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Ocupación global"
          value={formatPercent(capacity.percent)}
          icon={Warehouse}
          hint={`${formatNumber(capacity.occupied)} / ${formatNumber(capacity.capacity)} cupos`}
        />
        <KpiCard
          label="Galpones activos"
          value={formatNumber(capacity.galpones_active)}
          icon={Layers}
          color="text-blue-600 dark:text-blue-400"
          bg="bg-blue-500/10"
          hint="Infraestructura en operación"
        />
        <KpiCard
          label="Lotes registrados"
          value={formatNumber(lots.total)}
          icon={Package}
          color="text-purple-600 dark:text-purple-400"
          bg="bg-purple-500/10"
          hint="Activos, inactivos y sin estado"
        />
        <KpiCard
          label="Insumos en riesgo"
          value={inventory.available ? formatNumber(data.items_at_risk) : '—'}
          icon={AlertTriangle}
          color="text-amber-600 dark:text-amber-400"
          bg="bg-amber-500/10"
          hint={inventory.available ? 'Bajo stock o por vencer' : 'Módulo de inventario inactivo'}
        />
      </div>

      {/* Ocupación + composición */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card title="Ocupación de galpones" subtitle={`${formatNumber(capacity.capacity)} cupos instalados`}>
          <Gauge
            value={capacity.percent}
            color={CHART_COLORS.accent}
            centerLabel={`${formatNumber(capacity.occupied)}/${formatNumber(capacity.capacity)}`}
          />
        </Card>

        <Card title="Lotes por estado" subtitle="Distribución de la operación">
          {statusSegments.length > 0 ? (
            <Donut segments={statusSegments} centerValue={formatNumber(lots.total)} size={168} />
          ) : (
            <p className="text-xs text-gray-400 py-10 text-center">Sin lotes registrados.</p>
          )}
        </Card>

        <Card title="Lotes por sector" subtitle="Porcino, avícola y otros">
          {sectorSegments.length > 0 ? (
            <Donut segments={sectorSegments} centerValue={formatNumber(lots.total)} size={168} />
          ) : (
            <p className="text-xs text-gray-400 py-10 text-center">Sin lotes registrados.</p>
          )}
        </Card>
      </div>

      {/* Detalle de ocupación por galpón */}
      <Card title="Detalle por galpón" subtitle="Calibre y progreso de ocupación de cada galpón activo">
        {capacity.sheds.length === 0 ? (
          <p className="text-xs text-gray-400 py-4">No hay galpones activos registrados.</p>
        ) : (
          <div className="space-y-4">
            {capacity.sheds.map((shed) => (
              <div key={`shed-${shed.id}`} className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2 truncate">
                    <Warehouse className="w-4 h-4 text-[#1B4D3E] dark:text-[#6DBF5C] shrink-0" />
                    {shed.name}
                    <Badge variant="info" className="text-[10px]!">
                      {shed.sector_label}
                    </Badge>
                  </span>
                  <span className="text-xs font-bold text-gray-700 dark:text-gray-200 shrink-0">
                    {formatNumber(shed.occupied)} / {formatNumber(shed.capacity)}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-2.5 rounded-full bg-gray-100 dark:bg-[#263632] overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.min(100, shed.percent)}%`,
                        backgroundColor: shed.percent >= 90 ? CHART_COLORS.red : CHART_COLORS.accent,
                      }}
                    />
                  </div>
                  <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 w-12 text-right">
                    {formatPercent(shed.percent)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Inventario crítico */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card title="Bajo stock" subtitle="Insumos que alcanzaron el mínimo">
          {!inventory.available ? (
            <p className="text-xs text-gray-400 py-4">El módulo de inventario no está habilitado.</p>
          ) : inventory.low_stock.length === 0 ? (
            <div className="flex items-center gap-2 text-xs text-gray-400 py-3">
              <CheckCircle2 className="w-4 h-4 text-[#4E9F3D]" />
              <span>Sin insumos bajo mínimo.</span>
            </div>
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-[#263632]">
              {inventory.low_stock.map((item) => (
                <li key={`low-${item.id}`} className="py-2.5 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <span className="font-mono text-[11px] font-bold text-[#1B4D3E] dark:text-[#6DBF5C]">
                      {item.code}
                    </span>
                    <p className="text-sm text-gray-700 dark:text-gray-200 truncate">{item.name}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-red-600 dark:text-red-400 flex items-center gap-1">
                      <TrendingDown className="w-3.5 h-3.5" />
                      {formatNumber(item.current_stock, 2)} {item.unit_short}
                    </p>
                    <p className="text-[10px] text-gray-400">
                      mín. {formatNumber(item.min_stock, 2)} {item.unit_short}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Por vencer" subtitle="Próximos 15 días o vencidos">
          {!inventory.available ? (
            <p className="text-xs text-gray-400 py-4">El módulo de inventario no está habilitado.</p>
          ) : inventory.expiring.length === 0 ? (
            <div className="flex items-center gap-2 text-xs text-gray-400 py-3">
              <CheckCircle2 className="w-4 h-4 text-[#4E9F3D]" />
              <span>Sin vencimientos próximos.</span>
            </div>
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-[#263632]">
              {inventory.expiring.map((item) => (
                <li key={`exp-${item.id}`} className="py-2.5 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <span className="font-mono text-[11px] font-bold text-[#1B4D3E] dark:text-[#6DBF5C]">
                      {item.code}
                    </span>
                    <p className="text-sm text-gray-700 dark:text-gray-200 truncate">{item.name}</p>
                  </div>
                  <Badge variant={item.is_expired ? 'danger' : 'warning'} className="text-[10px]! shrink-0">
                    <CalendarClock className="w-3 h-3 mr-1" />
                    {formatDate(item.expiration_date)}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card
          title="Entradas recientes"
          subtitle={`${formatNumber(inventory.total_items)} insumos · ${formatMoney(inventory.stock_value)}`}
        >
          {!inventory.available ? (
            <p className="text-xs text-gray-400 py-4">El módulo de inventario no está habilitado.</p>
          ) : inventory.recent_entries.length === 0 ? (
            <p className="text-xs text-gray-400 py-4">Sin lotes de insumo registrados.</p>
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-[#263632]">
              {inventory.recent_entries.map((entry) => (
                <li key={`entry-${entry.id}`} className="py-2.5 flex items-center justify-between gap-3">
                  <div className="min-w-0 flex items-center gap-2">
                    <PackageCheck className="w-4 h-4 text-[#4E9F3D] shrink-0" />
                    <div className="min-w-0">
                      <span className="font-mono text-[11px] font-bold text-[#1B4D3E] dark:text-[#6DBF5C]">
                        {entry.code}
                      </span>
                      <p className="text-sm text-gray-700 dark:text-gray-200 truncate">
                        {entry.item_name ?? 'Insumo'}
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] text-gray-400 shrink-0">
                    {formatDate(entry.created_at)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
};

export default AnalyticsOperationsTab;
