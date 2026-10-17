import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Building2,
  CalendarClock,
  CheckCircle2,
  Layers,
  Package,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { ExportKpiPdfButton } from '../../components/common/ExportKpiPdfButton';
import { Badge } from '../../components/ui/Badge';
import { inventoryService } from '../../services/inventoryService';
import { safeText } from '../../utils/safeText';
import type { Farm } from '../../types/auth';
import {
  INVENTORY_ALERT_LABELS,
  type InventoryAlerts,
  type InventoryItem,
} from '../../types/inventory';
import { ALERT_BADGE_VARIANT, formatDate, formatMoney, formatQtyWithUnit, toNumber } from './inventoryShared';

export interface InventoryPanelTabProps {
  isAdmin: boolean;
  isRoot?: boolean;
  selectedFarmId?: string;
  setSelectedFarmId?: (id: string) => void;
  availableFarms?: Farm[];
}

type AlertSectionKey = keyof InventoryAlerts;

const EMPTY_ALERTS: InventoryAlerts = {
  low_stock: [],
  over_stock: [],
  expiring: [],
  expired: [],
};

const SECTION_META: Record<
  AlertSectionKey,
  { title: string; description: string; icon: React.ReactNode; accent: string }
> = {
  low_stock: {
    title: 'Bajo mínimo',
    description: 'Insumos que alcanzaron el stock mínimo — requieren compra.',
    icon: <TrendingDown className="w-4 h-4 text-red-600 dark:text-red-400" />,
    accent: 'border-l-red-500',
  },
  over_stock: {
    title: 'Sobre stock',
    description: 'Insumos por encima del máximo — posible merma.',
    icon: <TrendingUp className="w-4 h-4 text-amber-600 dark:text-amber-400" />,
    accent: 'border-l-amber-500',
  },
  expiring: {
    title: 'Por vencer',
    description: 'Insumos que vencen en los próximos 15 días.',
    icon: <CalendarClock className="w-4 h-4 text-amber-600 dark:text-amber-400" />,
    accent: 'border-l-amber-500',
  },
  expired: {
    title: 'Vencidos',
    description: 'Insumos cuya fecha de vencimiento ya pasó.',
    icon: <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400" />,
    accent: 'border-l-red-500',
  },
};

export const InventoryPanelTab: React.FC<InventoryPanelTabProps> = ({
  isAdmin,
  isRoot = false,
  selectedFarmId = 'all',
  availableFarms = [],
}) => {
  const { user, activeFarm } = useAuth();

  const [items, setItems] = useState<InventoryItem[]>([]);
  const [alerts, setAlerts] = useState<InventoryAlerts>(EMPTY_ALERTS);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  const defaultFarmId = (activeFarm?.id as number) || (user?.farm_id as number) || undefined;
  const effectiveFarmId = isRoot ? selectedFarmId : defaultFarmId;

  const selectedFarmName = useMemo(() => {
    if (!isRoot) return activeFarm?.name || 'Granja Principal';
    if (selectedFarmId === 'all') return 'Consolidado Multigranja (Todas las Sedes)';
    const found = (availableFarms || []).find((f) => String(f.id) === String(selectedFarmId));
    return found?.name || `Granja #${selectedFarmId}`;
  }, [isRoot, selectedFarmId, availableFarms, activeFarm]);

  const loadPanel = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage('');

    try {
      const [itemsResult, alertsResult] = await Promise.all([
        isAdmin ? inventoryService.getAll({ farm_id: effectiveFarmId }) : inventoryService.getMy(),
        inventoryService.getAlerts(effectiveFarmId),
      ]);

      setItems(Array.isArray(itemsResult.data) ? itemsResult.data : []);
      setAlerts(alertsResult ?? EMPTY_ALERTS);
    } catch (error: any) {
      setErrorMessage(error?.response?.data?.message || 'No se pudo cargar el panel de inventario.');
      setItems([]);
      setAlerts(EMPTY_ALERTS);
    } finally {
      setIsLoading(false);
    }
  }, [isAdmin, effectiveFarmId]);

  useEffect(() => {
    void loadPanel();
  }, [loadPanel]);

  const stats = useMemo(() => {
    const list = Array.isArray(items) ? items : [];
    const totalValue = list.reduce((sum, item) => sum + toNumber(item?.total_cost), 0);
    const low = list.filter((item) => (item?.alert_flags ?? []).includes('bajo_minimo')).length;
    const over = list.filter((item) => (item?.alert_flags ?? []).includes('sobre_stock')).length;
    const expiring = list.filter((item) => (item?.alert_flags ?? []).includes('por_vencer')).length;
    const expired = list.filter((item) => (item?.alert_flags ?? []).includes('vencido')).length;

    return { total: list.length, totalValue, low, over, expiring, expired };
  }, [items]);

  const kpiCards = [
    { id: 'kpi-total', label: 'Insumos totales', value: String(stats.total), icon: Package, color: 'text-[#1B4D3E] dark:text-[#6DBF5C]', bg: 'bg-[#1B4D3E]/10' },
    { id: 'kpi-value', label: 'Valor del inventario', value: formatMoney(stats.totalValue), icon: Wallet, color: 'text-[#4E9F3D]', bg: 'bg-[#4E9F3D]/10' },
    { id: 'kpi-low', label: 'Bajo mínimo', value: String(stats.low), icon: TrendingDown, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-500/10' },
    { id: 'kpi-over', label: 'Sobre stock', value: String(stats.over), icon: TrendingUp, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-500/10' },
    { id: 'kpi-expiring', label: 'Por vencer', value: String(stats.expiring), icon: CalendarClock, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-500/10' },
    { id: 'kpi-expired', label: 'Vencidos', value: String(stats.expired), icon: AlertTriangle, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-500/10' },
  ];

  const sectionKeys: AlertSectionKey[] = ['low_stock', 'over_stock', 'expiring', 'expired'];

  return (
    <div className="space-y-6">
      <div className="flex justify-end gap-2">
        <ExportKpiPdfButton
          moduleTitle="Módulo de Inventario e Insumos"
          moduleSlug="inventario"
          farmName={selectedFarmName}
          kpis={[
            {
              title: 'Insumos Totales',
              value: stats.total,
              subtitle: isRoot && selectedFarmId === 'all' ? 'Consolidado todas las sedes' : 'Catálogo registrado',
              tone: 'slate',
            },
            {
              title: 'Valorización',
              value: formatMoney(stats.totalValue),
              subtitle: 'Capital en bodega',
              tone: 'emerald',
            },
            {
              title: 'Stock Crítico',
              value: stats.low,
              subtitle: 'Insumos bajo mínimo',
              tone: stats.low > 0 ? 'red' : 'emerald',
            },
            {
              title: 'Vencimientos',
              value: `${stats.expiring} / ${stats.expired}`,
              subtitle: 'Por vencer / Vencidos',
              tone: stats.expired > 0 ? 'red' : stats.expiring > 0 ? 'amber' : 'emerald',
            },
          ]}
          diagnosis={
            stats.low > 0 || stats.expired > 0
              ? `Atención (${selectedFarmName}): Existen insumos bajo stock crítico o con fecha de caducidad superada. Se requiere reposición de quiebres e inmovilización de lotes caducados para preservar la bioseguridad agropecuaria.`
              : `Salud de inventario óptima (${selectedFarmName}): Los niveles de insumos se encuentran dentro de las bandas de reposición y no se registran pérdidas por caducidad.`
          }
          columns={
            isRoot
              ? ['Granja', 'Insumo', 'Categoría', 'Stock Actual', 'Mínimo', 'Costo Unit.', 'Valor Total', 'Alertas']
              : ['Insumo', 'Categoría', 'Stock Actual', 'Mínimo', 'Costo Unit.', 'Valor Total', 'Alertas']
          }
          rows={(Array.isArray(items) ? items : []).map((item) => {
            const baseRow = [
              item.name || '-',
              typeof item.category === 'object' && item.category !== null ? (item.category as any).name || 'General' : (item.category || 'General'),
              formatQtyWithUnit(item.current_stock, item.unit),
              formatQtyWithUnit(item.min_stock, item.unit),
              formatMoney(item.unit_cost),
              formatMoney(item.total_cost),
              (item.alert_flags || []).join(', ') || 'Normal',
            ];
            return isRoot ? [item.farm?.name || item.farm_name || 'Granja', ...baseRow] : baseRow;
          })}
        />
        <Button variant="outline" size="sm" onClick={() => void loadPanel()} icon={<RefreshCw className="w-3.5 h-3.5" />}>
          Actualizar
        </Button>
      </div>

      {errorMessage ? (
        <div className="p-3 rounded-xl bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm">
          {errorMessage}
        </div>
      ) : null}

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {(kpiCards || []).map((card) => (
          <Card key={card.id} className="p-4!">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl ${card.bg} flex items-center justify-center shrink-0`}>
                <card.icon className={`w-5 h-5 ${card.color}`} />
              </div>
              <div className="min-w-0">
                <p className="text-lg font-extrabold text-[#1E1E1E] dark:text-gray-100 truncate">{card.value}</p>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  {card.label}
                </p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Alertas */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-gray-400">
          <RefreshCw className="w-6 h-6 animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {(sectionKeys || []).map((key) => {
            const meta = SECTION_META[key];
            const list = Array.isArray(alerts?.[key]) ? alerts[key] : [];

            return (
              <Card key={`alert-section-${key}`} className={`border-l-4 ${meta.accent}`}>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <h3 className="text-sm font-bold text-[#1E1E1E] dark:text-gray-100 flex items-center gap-2">
                      {meta.icon}
                      <span>{meta.title}</span>
                      <Badge variant="primary" className="text-[10px]!">
                        {list.length}
                      </Badge>
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{meta.description}</p>
                  </div>
                </div>

                {list.length === 0 ? (
                  <div className="flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500 py-3">
                    <CheckCircle2 className="w-4 h-4 text-[#4E9F3D]" />
                    <span>Sin incidencias en esta categoría.</span>
                  </div>
                ) : (
                  <ul className="divide-y divide-gray-100 dark:divide-[#263632]">
                    {(list || []).map((item) => {
                      const itemId = item.id ? String(item.id) : `pitem-${item.code || Math.random()}`;

                      return (
                        <li key={`panel-item-${itemId}`} className="py-2.5 flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              {isRoot ? (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 dark:bg-emerald-950/50 text-[#064E3B] dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800/60 shadow-xs">
                                  <Building2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
                                  <span>{item.farm?.name || item.farm_name || 'Granja'}</span>
                                </span>
                              ) : null}
                              <span className="font-mono text-[11px] font-bold text-[#1B4D3E] dark:text-[#6DBF5C]">
                                {safeText(item.code, '')}
                              </span>
                              {(item.alert_flags ?? []).map((flag, flagIdx) => (
                                <Badge
                                  key={`${itemId}-flag-${flag}-${flagIdx}`}
                                  variant={ALERT_BADGE_VARIANT[flag] ?? 'warning'}
                                  className="text-[10px]!"
                                >
                                  {INVENTORY_ALERT_LABELS[flag] ?? flag}
                                </Badge>
                              ))}
                            </div>
                            <p className="text-sm text-gray-700 dark:text-gray-200 truncate">
                              {safeText(item.name, `Insumo #${item.id}`)}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-sm font-bold text-[#1E1E1E] dark:text-gray-100">
                              {formatQtyWithUnit(item.current_stock, item.unit)}
                            </p>
                            <p className="text-[11px] text-gray-500 dark:text-gray-400">
                              {formatDate(item.expiration_date)}
                            </p>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Nota de alcance */}
      <div className="flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500">
        <Layers className="w-3.5 h-3.5" />
        Límite de aviso de vencimiento: 15 días. La alerta de compra se notifica al administrador de la granja.
      </div>
    </div>
  );
};

export default InventoryPanelTab;
