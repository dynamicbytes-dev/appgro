import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Egg,
  Layers,
  Package,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { TrendChart } from '../../components/charts/TrendChart';
import { Bars } from '../../components/charts/Bars';
import { Progress } from '../../components/charts/Progress';
import { analyticsService } from '../../services/analyticsService';
import type { AnalyticsFinancial } from '../../types/analytics';
import {
  CHART_COLORS,
  SECTOR_COLORS,
  colorForKey,
  formatMoney,
  formatNumber,
  formatPercent,
  formatShortDate,
} from './analyticsShared';
import { KpiCard } from './KpiCard';

interface AnalyticsFinancialTabProps {
  farmId?: number | string;
}

interface CostRow {
  label: string;
  value: number;
  color: string;
}

/**
 * Pestaña "Financiera": costo total de producción vs. cosecha global,
 * desglose de mermas, rendimiento por sector y por lote, y serie
 * temporal de huevos buenos vs. rotos.
 */
export const AnalyticsFinancialTab: React.FC<AnalyticsFinancialTabProps> = ({ farmId }) => {
  const [data, setData] = useState<AnalyticsFinancial | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  const load = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage('');
    try {
      setData(await analyticsService.getFinancial(farmId));
    } catch (error: any) {
      setErrorMessage(error?.response?.data?.message || 'No se pudo cargar la analítica financiera.');
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, [farmId]);

  useEffect(() => {
    void load();
  }, [load]);

  const costRows = useMemo<CostRow[]>(() => {
    if (!data) return [];
    return [
      { label: 'Inversión en animales', value: data.costs.investment, color: CHART_COLORS.primary },
      { label: 'Alimentación e insumos', value: data.costs.inputs, color: CHART_COLORS.amber },
      { label: 'Costo huevos buenos', value: data.costs.eggs, color: CHART_COLORS.accent },
      { label: 'Costo mermas (rotos)', value: data.costs.eggs_broken, color: CHART_COLORS.red },
    ];
  }, [data]);

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

  const maxCost = Math.max(1, ...costRows.map((row) => row.value));
  const marginPositive = data.profit >= 0;

  const seriesLabels = data.eggs_series.map((point) => formatShortDate(point.date));
  const goodSeries = data.eggs_series.map((point) => point.good_eggs);
  const brokenSeries = data.eggs_series.map((point) => point.broken_eggs);

  // Merma de huevos: fuente única desde el backend (acumuladores de lote),
  // idéntica al Resumen Ejecutivo. La serie (`eggs_series`) se usa sólo para
  // el gráfico de tendencia, que puede estar limitado a la ventana reciente.
  const totalBroken = data.eggs.broken;
  const totalGood = data.eggs.good;
  const brokenRatio = data.eggs.broken_percent;

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button variant="outline" onClick={() => void load()} icon={<RefreshCw className="w-4 h-4" />}>
          Actualizar
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Costo total de producción"
          value={formatMoney(data.costs.total)}
          icon={Wallet}
          hint="Todas las categorías"
        />
        <KpiCard
          label="Cosecha global"
          value={formatMoney(data.revenue.total)}
          icon={TrendingUp}
          color="text-[#4E9F3D]"
          bg="bg-[#4E9F3D]/10"
          hint="Valor de venta de animales"
        />
        <KpiCard
          label={marginPositive ? 'Utilidad' : 'Pérdida'}
          value={formatMoney(Math.abs(data.profit))}
          icon={marginPositive ? TrendingUp : TrendingDown}
          color={marginPositive ? 'text-[#4E9F3D]' : 'text-red-600 dark:text-red-400'}
          bg={marginPositive ? 'bg-[#4E9F3D]/10' : 'bg-red-500/10'}
          hint={`Margen ${formatPercent(data.margin_percent)}`}
        />
        <KpiCard
          label="Merma de huevos"
          value={formatPercent(brokenRatio)}
          icon={AlertTriangle}
          color={brokenRatio > 10 ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'}
          bg={brokenRatio > 10 ? 'bg-red-500/10' : 'bg-amber-500/10'}
          hint={`${formatNumber(totalBroken)} rotos de ${formatNumber(totalGood + totalBroken)}`}
        />
      </div>

      {/* Desglose de costos + tendencia */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card title="Desglose de costos" subtitle="Composición del costo total de producción">
          <ul className="space-y-4">
            {costRows.map((row) => (
              <li key={`cost-${row.label}`}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-semibold text-gray-700 dark:text-gray-200">{row.label}</span>
                  <span className="font-bold text-gray-800 dark:text-gray-100">
                    {formatMoney(row.value)}
                  </span>
                </div>
                <Progress
                  value={(row.value / maxCost) * 100}
                  color={row.color}
                  valueLabel={`${data.costs.total > 0 ? formatPercent((row.value / data.costs.total) * 100) : '0.0%'}`}
                />
              </li>
            ))}
          </ul>
        </Card>

        <Card
          className="lg:col-span-2"
          title="Tendencia de mermas (huevos)"
          subtitle="Evolución histórica de huevos buenos vs. rotos"
        >
          {data.eggs_series.length > 0 ? (
            <TrendChart
              labels={seriesLabels}
              series={[
                { name: 'Buenos', color: CHART_COLORS.accent, data: goodSeries },
                { name: 'Rotos', color: CHART_COLORS.red, data: brokenSeries },
              ]}
              formatValue={(v) => formatNumber(v)}
            />
          ) : (
            <div className="flex items-center gap-2 text-xs text-gray-400 py-16 justify-center">
              <Egg className="w-4 h-4" />
              <span>Aún no hay registros de producción de huevos.</span>
            </div>
          )}
        </Card>
      </div>

      {/* Rendimiento por sector */}
      <Card title="Rendimiento por sector" subtitle="Costo, ingreso y utilidad consolidados por sector (sin insumos de granja)">
        {data.by_sector.length === 0 ? (
          <p className="text-xs text-gray-400 py-4">Sin lotes registrados.</p>
        ) : (
          <div className="space-y-4">
            {data.by_sector.map((sector) => {
              const maxValue = Math.max(1, sector.cost, sector.revenue);
              return (
                <div key={`sector-${sector.sector}`} className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
                      <span
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: colorForKey(SECTOR_COLORS, sector.sector) }}
                      />
                      {sector.sector_label}
                      <Badge variant="primary" className="text-[10px]!">
                        {sector.lots} lote(s)
                      </Badge>
                    </span>
                    <span
                      className={`text-xs font-bold ${
                        sector.profit >= 0
                          ? 'text-[#4E9F3D]'
                          : 'text-red-600 dark:text-red-400'
                      }`}
                    >
                      {sector.profit >= 0 ? '+' : ''}
                      {formatMoney(sector.profit)}
                    </span>
                  </div>
                  <Progress
                    value={(sector.cost / maxValue) * 100}
                    color={CHART_COLORS.amber}
                    height={7}
                    label="Costo"
                    valueLabel={formatMoney(sector.cost)}
                  />
                  <Progress
                    value={(sector.revenue / maxValue) * 100}
                    color={CHART_COLORS.accent}
                    height={7}
                    label="Ingreso"
                    valueLabel={formatMoney(sector.revenue)}
                  />
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Rendimiento por lote + insumos */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card
          className="lg:col-span-2"
          title="Rendimiento por lote"
          subtitle="Lotes con mayor costo de producción (sin insumos de granja)"
        >
          {data.by_lot.length === 0 ? (
            <p className="text-xs text-gray-400 py-4">Sin costos registrados por lote.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-[#263632] text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    <th className="py-2.5 pr-3">Lote</th>
                    <th className="py-2.5 px-3">Sector / Propósito</th>
                    <th className="py-2.5 px-3 text-right">Costo</th>
                    <th className="py-2.5 px-3 text-right">Ingreso</th>
                    <th className="py-2.5 pl-3 text-right">Utilidad</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-[#263632]">
                  {data.by_lot.map((lot) => (
                    <tr key={`lot-${lot.id}`} className="hover:bg-gray-50/70 dark:hover:bg-[#263632]/40">
                      <td className="py-2.5 pr-3 font-mono font-bold text-[#1B4D3E] dark:text-[#6DBF5C]">
                        {lot.code}
                      </td>
                      <td className="py-2.5 px-3 text-gray-600 dark:text-gray-300">
                        <span className="block">{lot.sector_label}</span>
                        <span className="text-[10px] text-gray-400">{lot.purpose_label}</span>
                      </td>
                      <td className="py-2.5 px-3 text-right text-gray-700 dark:text-gray-200">
                        {formatMoney(lot.cost)}
                      </td>
                      <td className="py-2.5 px-3 text-right text-gray-700 dark:text-gray-200">
                        {formatMoney(lot.revenue)}
                      </td>
                      <td
                        className={`py-2.5 pl-3 text-right font-bold ${
                          lot.profit >= 0 ? 'text-[#4E9F3D]' : 'text-red-600 dark:text-red-400'
                        }`}
                      >
                        {formatMoney(lot.profit)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card title="Mayor consumo de insumos" subtitle="Costo por insumo (nivel granja)">
          <Bars
            data={data.inputs_top.map((input) => ({
              label: `${input.code} · ${input.name}`,
              value: input.cost,
              color: CHART_COLORS.primary,
            }))}
            formatValue={(v) => formatMoney(v)}
            emptyText="Sin movimientos de salida registrados."
          />
          <div className="flex items-center gap-2 text-xs text-gray-400 mt-4">
            <Layers className="w-3.5 h-3.5" />
            Costo calculado con el costo unitario actual del insumo.
          </div>
        </Card>
      </div>

      <div className="flex items-start gap-2 text-xs text-gray-400 dark:text-gray-500">
        <Package className="w-3.5 h-3.5 shrink-0 mt-0.5" />
        <span>
          El costo por lote y por sector = inversión en animales + costo de huevos (buenos y rotos).
          Los insumos se consolidan a nivel de granja y no se reparten entre lotes, por lo que la suma
          de utilidades por sector/lote no incluye ese rubro; el <strong>Costo total de producción</strong>{' '}
          y la utilidad global sí lo incluyen.
        </span>
      </div>
    </div>
  );
};

export default AnalyticsFinancialTab;
