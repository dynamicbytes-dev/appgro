import React, { useEffect, useState } from 'react';
import { BarChart3, Building2, History, Package, Truck, Warehouse } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { farmService } from '../../services/farmService';
import type { Farm } from '../../types/auth';
import { PageHeader } from '../../components/ui/PageHeader';
import { InventoryItemsTab } from './InventoryItemsTab';
import { InventoryMovementsTab } from './InventoryMovementsTab';
import { InventorySuppliersTab } from './InventorySuppliersTab';
import { InventoryWarehousesTab } from './InventoryWarehousesTab';
import { InventoryPanelTab } from './InventoryPanelTab';

type InventoryTab = 'items' | 'movements' | 'suppliers' | 'warehouses' | 'panel';

const TABS: { id: InventoryTab; label: string; icon: React.ReactNode }[] = [
  { id: 'items', label: 'Insumos', icon: <Package className="w-4 h-4" /> },
  { id: 'movements', label: 'Movimientos', icon: <History className="w-4 h-4" /> },
  { id: 'suppliers', label: 'Proveedores', icon: <Truck className="w-4 h-4" /> },
  { id: 'warehouses', label: 'Bodega', icon: <Warehouse className="w-4 h-4" /> },
  { id: 'panel', label: 'Panel', icon: <BarChart3 className="w-4 h-4" /> },
];

/**
 * Módulo operativo Inventario.
 *
 * Organizado en cinco pestañas:
 *  - Insumos:     catálogo (CRUD para admin; lectura + movimiento para el encargado).
 *  - Movimientos: entradas, salidas y ajustes de stock.
 *  - Proveedores: catálogo de proveedores (CRUD admin/root; lectura encargado).
 *  - Bodega:      catálogo de bodegas / ubicaciones (CRUD admin/root; lectura encargado).
 *  - Panel:       KPIs y alertas (bajo mínimo, sobre stock, por vencer, vencidos).
 *
 * Soporte Multi-Granja para rol `root`:
 *  - Consulta de cualquier granja individual o vista global consolidada (`all`).
 *  - Sincronización en tiempo real con el selector global de granja activa.
 */
export const InventoryView: React.FC = () => {
  const { user, activeFarm, farms } = useAuth();
  const [activeTab, setActiveTab] = useState<InventoryTab>('items');

  const roleUpper = user?.role ? user.role.toUpperCase() : '';
  const isRoot = roleUpper === 'ROOT' || user?.role === 'root';
  const isAdmin = roleUpper === 'ADMIN' || isRoot;

  // Granjas disponibles para consulta root
  const [availableFarms, setAvailableFarms] = useState<Farm[]>([]);
  const [selectedFarmId, setSelectedFarmId] = useState<string>(() => {
    if (isRoot) {
      return activeFarm?.id ? String(activeFarm.id) : 'all';
    }
    return activeFarm?.id ? String(activeFarm.id) : '';
  });

  // Carga del catálogo completo de granjas si el usuario es root
  useEffect(() => {
    if (!isRoot) return;
    if (Array.isArray(farms) && farms.length > 0) {
      setAvailableFarms(farms);
      return;
    }
    farmService
      .getFarmsSelect()
      .then((list) => {
        if (Array.isArray(list) && list.length > 0) {
          setAvailableFarms(list);
        }
      })
      .catch((err) => {
        console.warn('No se pudo cargar la lista de granjas para Inventario:', err);
      });
  }, [isRoot, farms]);

  // Sincronización automática si el root cambia la granja activa en el selector global superior
  useEffect(() => {
    if (isRoot && activeFarm?.id) {
      setSelectedFarmId(String(activeFarm.id));
    }
  }, [isRoot, activeFarm?.id]);

  const selectedFarmObj = availableFarms.find((f) => String(f.id) === String(selectedFarmId));
  const farmBadgeText = isRoot
    ? selectedFarmId === 'all'
      ? 'Vista Global: Todas las Granjas'
      : `Granja: ${selectedFarmObj?.name ?? 'Sede Seleccionada'}`
    : activeFarm?.name ?? 'Mi Granja';

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        icon={<Package className="w-5 h-5" />}
        badge={isRoot ? farmBadgeText : undefined}
        badgeIcon={<Building2 className="w-3.5 h-3.5" />}
        title="Inventario"
        subtitle="Control de insumos, stock, vencimientos y movimientos de la granja."
      >
          {(TABS || []).map((tab) => (
            <button
              key={`inv-tab-${tab.id}`}
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-full text-xs font-bold border transition-colors cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-[#1B4D3E] text-white border-[#1B4D3E]'
                  : 'bg-white dark:bg-[#18221F] text-gray-600 dark:text-gray-300 border-gray-300 dark:border-[#263632] hover:bg-gray-50 dark:hover:bg-[#263632]'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
      </PageHeader>

      {/* Contenido de la pestaña activa protegido en contenedor único sin nodos huérfanos */}
      <div className="w-full">
        {activeTab === 'items' ? (
          <InventoryItemsTab
            key={`tab-items-${selectedFarmId}`}
            isAdmin={isAdmin}
            isRoot={isRoot}
            selectedFarmId={selectedFarmId}
            setSelectedFarmId={setSelectedFarmId}
            availableFarms={availableFarms}
          />
        ) : activeTab === 'movements' ? (
          <InventoryMovementsTab
            key={`tab-movements-${selectedFarmId}`}
            isAdmin={isAdmin}
            isRoot={isRoot}
            selectedFarmId={selectedFarmId}
            availableFarms={availableFarms}
          />
        ) : activeTab === 'suppliers' ? (
          <InventorySuppliersTab
            key={`tab-suppliers-${selectedFarmId}`}
            isAdmin={isAdmin}
          />
        ) : activeTab === 'warehouses' ? (
          <InventoryWarehousesTab
            key={`tab-warehouses-${selectedFarmId}`}
            isAdmin={isAdmin}
          />
        ) : activeTab === 'panel' ? (
          <InventoryPanelTab
            key={`tab-panel-${selectedFarmId}`}
            isAdmin={isAdmin}
            isRoot={isRoot}
            selectedFarmId={selectedFarmId}
            availableFarms={availableFarms}
          />
        ) : null}
      </div>
    </div>
  );
};

export default InventoryView;
