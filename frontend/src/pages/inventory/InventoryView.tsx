import React, { useState } from 'react';
import { BarChart3, History, Package, Truck, Warehouse } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
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
 */
export const InventoryView: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<InventoryTab>('items');

  const roleUpper = user?.role ? user.role.toUpperCase() : '';
  const isAdmin = roleUpper === 'ADMIN' || roleUpper === 'ROOT';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Package className="w-6 h-6 text-[#1B4D3E] dark:text-[#6DBF5C]" />
            <h1 className="text-2xl font-extrabold text-[#1E1E1E] dark:text-gray-100 tracking-tight">
              Inventario
            </h1>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Control de insumos, stock, vencimientos y movimientos de la granja.
          </p>
        </div>

        {/* Pestañas */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {(TABS || []).map((tab) => (
            <button
              key={`inv-tab-${tab.id}`}
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

      {/* Contenido de la pestaña activa protegido en contenedor único sin nodos huérfanos */}
      <div className="w-full">
        {activeTab === 'items' ? (
          <InventoryItemsTab key="tab-items" isAdmin={isAdmin} />
        ) : activeTab === 'movements' ? (
          <InventoryMovementsTab key="tab-movements" isAdmin={isAdmin} />
        ) : activeTab === 'suppliers' ? (
          <InventorySuppliersTab key="tab-suppliers" isAdmin={isAdmin} />
        ) : activeTab === 'warehouses' ? (
          <InventoryWarehousesTab key="tab-warehouses" isAdmin={isAdmin} />
        ) : activeTab === 'panel' ? (
          <InventoryPanelTab key="tab-panel" isAdmin={isAdmin} />
        ) : null}
      </div>
    </div>
  );
};

export default InventoryView;
