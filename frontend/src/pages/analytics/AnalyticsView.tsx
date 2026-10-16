import React, { useEffect, useState } from 'react';
import { BarChart3, TrendingUp, Users, Warehouse } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { farmService } from '../../services/farmService';
import type { Farm } from '../../types/auth';
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-[#1B4D3E] dark:text-[#6DBF5C]" />
            <h1 className="text-2xl font-extrabold text-[#1E1E1E] dark:text-gray-100 tracking-tight">
              Analítica y Reportes
            </h1>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Indicadores financieros, de producción, ocupación, inventario y personal.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
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
          </div>
        </div>
      </div>

      {/* Contenido de la pestaña activa */}
      <div className="w-full">{renderTab()}</div>
    </div>
  );
};

export default AnalyticsView;
