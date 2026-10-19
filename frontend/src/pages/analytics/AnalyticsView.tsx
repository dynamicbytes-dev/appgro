import React, { useEffect, useState } from 'react';
import { BarChart3, TrendingUp, Users, Warehouse } from 'lucide-react';
import { ExportKpiPdfButton } from '../../components/common/ExportKpiPdfButton';
import { useAuth } from '../../context/AuthContext';
import { farmService } from '../../services/farmService';
import { analyticsService } from '../../services/analyticsService';
import type { Farm } from '../../types/auth';
import { PageHeader } from '../../components/ui/PageHeader';
import { AnalyticsExecutiveTab } from './AnalyticsExecutiveTab';
import { AnalyticsFinancialTab } from './AnalyticsFinancialTab';
import { AnalyticsOperationsTab } from './AnalyticsOperationsTab';
import { AnalyticsStaffTab } from './AnalyticsStaffTab';

type AnalyticsTab = 'resumen' | 'financiera' | 'operativa' | 'personal';

const TABS: { id: AnalyticsTab; label: string; icon: React.ReactNode }[] = [
  { id: 'resumen', label: 'Resumen Ejecutivo', icon: <BarChart3 className="w-4 h-4" /> },
  { id: 'financiera', label: 'Financiera', icon: <TrendingUp className="w-4 h-4" /> },
  { id: 'operativa', label: 'Operativa', icon: <Warehouse className="w-4 h-4" /> },
  { id: 'personal', label: 'Personal', icon: <Users className="w-4 h-4" /> },
];

const FARM_SELECT_CLASSES =
  'w-full sm:w-56 px-3 py-2 bg-white dark:bg-[#121816] border border-gray-200 dark:border-[#263632] rounded-xl text-xs font-medium text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-[#1B4D3E]';

/**
 * Módulo Analítica y Reportes.
 *
 * Cuatro pestañas consolidan la información gerencial y operativa:
 *  - Resumen Ejecutivo: KPIs financieros, de producción y ocupación.
 *  - Financiera:       costos vs. cosecha, mermas y rendimiento.
 *  - Operativa:        ocupación de galpones e inventario crítico.
 *  - Personal:         productividad y tiempos del equipo.
 *
 * El root puede alternar entre todas las granjas o filtrar por una.
 * Un encargado (encargado/subordinate) solo ve Analítica si su granja la
 * tiene habilitada, y su pestaña de Personal se limita a su desempeño.
 */
export const AnalyticsView: React.FC = () => {
  const { user, activeFarm, farms } = useAuth();
  const [activeTab, setActiveTab] = useState<AnalyticsTab>('resumen');

  const roleUpper = (user?.role || '').toUpperCase();
  const isRoot = roleUpper === 'ROOT';

  const [availableFarms, setAvailableFarms] = useState<Farm[]>([]);
  const [rootFarmFilter, setRootFarmFilter] = useState<string>('all');

  useEffect(() => {
    if (!isRoot) return;
    if (Array.isArray(farms) && farms.length > 0) {
      setAvailableFarms(farms);
      return;
    }
    farmService
      .getFarmsSelect()
      .then((list) => {
        if (Array.isArray(list) && list.length > 0) setAvailableFarms(list);
      })
      .catch((err) => {
        console.warn('No se pudo cargar la lista de granjas para el filtro de Analítica:', err);
      });
  }, [isRoot, farms]);

  const farmId = isRoot
    ? rootFarmFilter
    : (activeFarm?.id as number) || (user?.farm_id as number) || undefined;

  const renderTab = () => {
    switch (activeTab) {
      case 'financiera':
        return <AnalyticsFinancialTab key="analytics-financiera" farmId={farmId} />;
      case 'operativa':
        return <AnalyticsOperationsTab key="analytics-operativa" farmId={farmId} />;
      case 'personal':
        return <AnalyticsStaffTab key="analytics-personal" farmId={farmId} />;
      case 'resumen':
      default:
        return <AnalyticsExecutiveTab key="analytics-resumen" farmId={farmId} />;
    }
  };

  const activeTabMeta = TABS.find((t) => t.id === activeTab);
  const activeFarmObj = availableFarms.find((f) => String(f.id) === String(rootFarmFilter));
  const activeFarmDisplayName = isRoot
    ? rootFarmFilter === 'all'
      ? 'Consolidado Multigranja Zootika'
      : activeFarmObj?.name || 'Granja Seleccionada'
    : activeFarm?.name || 'Granja Activa';

  /**
   * Carga los KPIs reales del período desde el endpoint ejecutivo y los adapta
   * al formato del PDF (label/value/status -> title/value/tone).
   */
  const buildAnalyticsPdfData = async () => {
    const report = await analyticsService.getExecutiveKpis(
      'analitica',
      isRoot ? rootFarmFilter : farmId
    );
    const payload = report?.data?.kpis ? report.data : report;
    const rawKpis: any[] = Array.isArray(payload?.kpis) ? payload.kpis : [];

    const toneFromStatus: Record<string, 'emerald' | 'amber' | 'red' | 'slate'> = {
      success: 'emerald',
      warning: 'amber',
      danger: 'red',
      info: 'slate',
    };

    const evalFromStatus: Record<string, string> = {
      danger: 'Crítico',
      warning: 'Atención',
      success: 'Óptimo',
    };

    const kpis = rawKpis.map((k) => ({
      title: String(k.title ?? k.label ?? ''),
      value: String(k.value ?? ''),
      subtitle: k.subtitle ? String(k.subtitle) : undefined,
      tone: (k.tone ?? toneFromStatus[String(k.status)]) || 'emerald',
    }));

    const rows = rawKpis.map((k) => [
      activeTabMeta?.label || 'General',
      String(k.title ?? k.label ?? ''),
      String(k.value ?? ''),
      String(k.subtitle ?? '—'),
      evalFromStatus[String(k.status)] || 'Óptimo',
    ]);

    return {
      kpis,
      columns: ['Dimensión', 'Indicador Clave', 'Valor Actual', 'Detalle', 'Evaluación'],
      rows,
      diagnosis: typeof payload?.diagnosis === 'string' ? payload.diagnosis : undefined,
    };
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        icon={<BarChart3 className="w-5 h-5" />}
        title="Analítica y Reportes"
        subtitle="Indicadores financieros, de producción, ocupación, inventario y personal."
      >
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 justify-end">
          {isRoot && (
            <select
              value={rootFarmFilter}
              onChange={(e) => setRootFarmFilter(e.target.value)}
              className={FARM_SELECT_CLASSES}
              aria-label="Filtrar por granja"
            >
              <option value="all">Todas las granjas</option>
              {availableFarms.map((farm) => (
                <option key={`analytics-farm-${farm.id}`} value={farm.id}>
                  {farm.name} {farm.code ? `(${farm.code})` : ''}
                </option>
              ))}
            </select>
          )}

          <div className="flex items-center gap-1.5 flex-wrap">
            {TABS.map((tab) => (
              <button
                key={`analytics-tab-${tab.id}`}
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-full text-xs font-bold border transition-colors ${
                  activeTab === tab.id
                    ? 'bg-[#1B4D3E] text-white border-[#1B4D3E]'
                    : 'bg-white dark:bg-[#18221F] text-gray-600 dark:text-gray-300 border-gray-300 dark:border-[#263632] hover:bg-gray-50 dark:hover:bg-[#263632]'
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            ))}

            <ExportKpiPdfButton
              moduleTitle={`Módulo de Analítica y Reportes - ${activeTabMeta?.label || 'Ejecutivo'}`}
              moduleSlug="analitica"
              farmName={activeFarmDisplayName}
              kpis={[]}
              columns={['Dimensión', 'Indicador Clave', 'Valor Actual', 'Detalle', 'Evaluación']}
              rows={[]}
              fetchData={buildAnalyticsPdfData}
            />
          </div>
          </div>
      </PageHeader>

      {/* Contenido de la pestaña activa */}
      <div className="w-full">{renderTab()}</div>
    </div>
  );
};

export default AnalyticsView;
