import { api } from './api';
import type {
  CreateInventoryItemDTO,
  CreateInventoryMovementDTO,
  CreateInventorySupplierDTO,
  CreateInventoryWarehouseDTO,
  InventoryAlerts,
  InventoryCatalogFilters,
  InventoryFilters,
  InventoryItem,
  InventoryListResponse,
  InventoryMovement,
  InventoryMovementFilters,
  InventoryStats,
  InventorySupplier,
  InventoryWarehouse,
  UpdateInventoryItemDTO,
  UpdateInventorySupplierDTO,
  UpdateInventoryWarehouseDTO,
} from '../types/inventory';

const buildItemQuery = (params?: InventoryFilters): Record<string, string | number> => {
  const query: Record<string, string | number> = {};
  if (params?.search) query.search = params.search;
  if (params?.category) query.category = params.category;
  if (params?.alert) query.alert = params.alert;
  if (params?.farm_id && params.farm_id !== 'all') query.farm_id = params.farm_id;
  return query;
};

const buildCatalogQuery = (params?: InventoryCatalogFilters): Record<string, string | number> => {
  const query: Record<string, string | number> = {};
  if (params?.search) query.search = params.search;
  if (params?.is_active !== undefined) query.is_active = params.is_active ? 1 : 0;
  if (params?.farm_id && params.farm_id !== 'all') query.farm_id = params.farm_id;
  return query;
};

/**
 * Servicio del módulo operativo Inventario.
 * Endpoints disponibles en /inventory y /inventario (alias).
 */
export const inventoryService = {
  /**
   * Catálogo completo de la granja (vista admin) con filtros y stats.
   */
  getAll: async (params?: InventoryFilters): Promise<InventoryListResponse> => {
    const response = await api.get('/inventory', { params: buildItemQuery(params) });
    return {
      data: response.data?.data ?? [],
      stats: response.data?.stats ?? {
        total_items: 0,
        total_value: 0,
        low_stock: 0,
        over_stock: 0,
        expiring: 0,
        expired: 0,
      },
    };
  },

  /**
   * Inventario de la granja para cualquier rol (bandeja del encargado).
   */
  getMy: async (params?: InventoryFilters): Promise<InventoryListResponse> => {
    const response = await api.get('/inventory/my', { params: buildItemQuery(params) });
    return {
      data: response.data?.data ?? [],
      stats: response.data?.stats ?? {
        total_items: 0,
        total_value: 0,
        low_stock: 0,
        over_stock: 0,
        expiring: 0,
        expired: 0,
      },
    };
  },

  /**
   * Ficha técnica de un insumo.
   */
  getById: async (id: number | string): Promise<InventoryItem> => {
    const response = await api.get(`/inventory/${id}`);
    return response.data?.data ?? response.data;
  },

  /**
   * Registrar un insumo (código autogenerado por el backend).
   */
  create: async (payload: CreateInventoryItemDTO): Promise<InventoryItem> => {
    const response = await api.post('/inventory', payload);
    return response.data?.data ?? response.data;
  },

  /**
   * Actualizar los datos del insumo (el stock sólo cambia con movimientos).
   */
  update: async (id: number | string, payload: UpdateInventoryItemDTO): Promise<InventoryItem> => {
    const response = await api.put(`/inventory/${id}`, payload);
    return response.data?.data ?? response.data;
  },

  /**
   * Eliminar un insumo.
   */
  remove: async (id: number | string): Promise<void> => {
    await api.delete(`/inventory/${id}`);
  },

  /**
   * Estadísticas KPI del inventario.
   */
  getStats: async (farmId?: number | string): Promise<InventoryStats> => {
    const response = await api.get('/inventory/stats', {
      params: farmId && farmId !== 'all' ? { farm_id: farmId } : undefined,
    });
    return response.data?.data ?? response.data;
  },

  /**
   * Listados de alerta: bajo mínimo, sobre stock, por vencer y vencidos.
   */
  getAlerts: async (farmId?: number | string): Promise<InventoryAlerts> => {
    const response = await api.get('/inventory/alerts', {
      params: farmId && farmId !== 'all' ? { farm_id: farmId } : undefined,
    });
    return (
      response.data?.data ?? {
        low_stock: [],
        over_stock: [],
        expiring: [],
        expired: [],
      }
    );
  },

  /**
   * Historial de movimientos de la granja.
   */
  getMovements: async (params?: InventoryMovementFilters): Promise<InventoryMovement[]> => {
    const query: Record<string, string | number> = {};
    if (params?.type) query.type = params.type;
    if (params?.inventory_item_id) query.inventory_item_id = params.inventory_item_id;
    if (params?.destination_lot_id) query.destination_lot_id = params.destination_lot_id;
    if (params?.from) query.from = params.from;
    if (params?.to) query.to = params.to;
    if (params?.farm_id && params.farm_id !== 'all') query.farm_id = params.farm_id;

    const response = await api.get('/inventory/movements', { params: query });
    return response.data?.data ?? [];
  },

  /**
   * Registrar una entrada, salida o ajuste de stock.
   */
  createMovement: async (payload: CreateInventoryMovementDTO): Promise<InventoryMovement> => {
    const response = await api.post('/inventory/movements', payload);
    return response.data?.data ?? response.data;
  },

  /* ------------------------------------------------------------------ */
  /* Proveedores                                                         */
  /* ------------------------------------------------------------------ */

  getSuppliers: async (params?: InventoryCatalogFilters): Promise<InventorySupplier[]> => {
    const response = await api.get('/inventory/suppliers', { params: buildCatalogQuery(params) });
    return response.data?.data ?? [];
  },

  createSupplier: async (payload: CreateInventorySupplierDTO): Promise<InventorySupplier> => {
    const response = await api.post('/inventory/suppliers', payload);
    return response.data?.data ?? response.data;
  },

  updateSupplier: async (
    id: number | string,
    payload: UpdateInventorySupplierDTO
  ): Promise<InventorySupplier> => {
    const response = await api.put(`/inventory/suppliers/${id}`, payload);
    return response.data?.data ?? response.data;
  },

  removeSupplier: async (id: number | string): Promise<void> => {
    await api.delete(`/inventory/suppliers/${id}`);
  },

  /* ------------------------------------------------------------------ */
  /* Bodegas                                                             */
  /* ------------------------------------------------------------------ */

  getWarehouses: async (params?: InventoryCatalogFilters): Promise<InventoryWarehouse[]> => {
    const response = await api.get('/inventory/warehouses', { params: buildCatalogQuery(params) });
    return response.data?.data ?? [];
  },

  createWarehouse: async (payload: CreateInventoryWarehouseDTO): Promise<InventoryWarehouse> => {
    const response = await api.post('/inventory/warehouses', payload);
    return response.data?.data ?? response.data;
  },

  updateWarehouse: async (
    id: number | string,
    payload: UpdateInventoryWarehouseDTO
  ): Promise<InventoryWarehouse> => {
    const response = await api.put(`/inventory/warehouses/${id}`, payload);
    return response.data?.data ?? response.data;
  },

  removeWarehouse: async (id: number | string): Promise<void> => {
    await api.delete(`/inventory/warehouses/${id}`);
  },
};
