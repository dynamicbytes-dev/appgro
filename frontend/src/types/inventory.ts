/**
 * Tipos del módulo de Inventario (insumos + movimientos de stock).
 */

export interface InventoryUser {
  id: number;
  name: string;
  lastname?: string | null;
  email?: string;
}

/* ------------------------------------------------------------------ */
/* Categorías                                                          */
/* ------------------------------------------------------------------ */

export type InventoryCategory =
  | 'alimentos_nutricion'
  | 'sanidad_bioseguridad'
  | 'infraestructura_repuestos'
  | 'insumos_agricolas'
  | 'insumos_empaque_operativos';

export interface InventoryCategoryOption {
  value: InventoryCategory;
  label: string;
}

export const INVENTORY_CATEGORIES: InventoryCategoryOption[] = [
  { value: 'alimentos_nutricion', label: 'Alimentos y nutrición animal' },
  { value: 'sanidad_bioseguridad', label: 'Sanidad y bioseguridad' },
  { value: 'infraestructura_repuestos', label: 'Infraestructura, equipamiento y repuestos' },
  { value: 'insumos_agricolas', label: 'Insumos agrícolas' },
  { value: 'insumos_empaque_operativos', label: 'Insumos de empaque y operativos' },
];

export const INVENTORY_CATEGORY_LABELS: Record<string, string> = INVENTORY_CATEGORIES.reduce(
  (acc, current) => ({ ...acc, [current.value]: current.label }),
  {} as Record<string, string>
);

/* ------------------------------------------------------------------ */
/* Unidades de medida                                                  */
/* ------------------------------------------------------------------ */

export interface InventoryUnitOption {
  value: string;
  label: string;
  /** Abreviatura mostrada junto a las cantidades (p. ej. «kg»). */
  short: string;
}

export const INVENTORY_UNITS: InventoryUnitOption[] = [
  { value: 'kg', label: 'Kilogramo', short: 'kg' },
  { value: 'g', label: 'Gramo', short: 'g' },
  { value: 'cc', label: 'Centímetro cúbico', short: 'cc' },
  { value: 'L', label: 'Litro', short: 'L' },
  { value: 'ml', label: 'Mililitro', short: 'ml' },
  { value: 'unidad', label: 'Unidad', short: 'und' },
  { value: 'dosis', label: 'Dosis', short: 'dosis' },
  { value: 'saco', label: 'Saco', short: 'saco' },
  { value: 'funda', label: 'Funda', short: 'funda' },
  { value: 'caja', label: 'Caja', short: 'caja' },
  { value: 'rollo', label: 'Rollo', short: 'rollo' },
  { value: 'par', label: 'Par', short: 'par' },
];

export const INVENTORY_UNIT_LABELS: Record<string, string> = INVENTORY_UNITS.reduce(
  (acc, current) => ({ ...acc, [current.value]: current.label }),
  {} as Record<string, string>
);

export const INVENTORY_UNIT_SHORTS: Record<string, string> = INVENTORY_UNITS.reduce(
  (acc, current) => ({ ...acc, [current.value]: current.short }),
  {} as Record<string, string>
);

/** Unidad por defecto al crear un insumo. */
export const DEFAULT_INVENTORY_UNIT = 'kg';

/* ------------------------------------------------------------------ */
/* Movimientos                                                         */
/* ------------------------------------------------------------------ */

export type InventoryMovementType = 'entrada' | 'salida' | 'ajuste';

export const INVENTORY_MOVEMENT_LABELS: Record<InventoryMovementType, string> = {
  entrada: 'Entrada',
  salida: 'Salida',
  ajuste: 'Ajuste',
};

export interface InventoryMovementTypeOption {
  value: InventoryMovementType;
  label: string;
  hint: string;
}

export const INVENTORY_MOVEMENT_TYPES: InventoryMovementTypeOption[] = [
  { value: 'entrada', label: 'Entrada', hint: 'Ingreso de mercadería (compra/reposición).' },
  { value: 'salida', label: 'Salida', hint: 'Consumo o despacho del insumo.' },
  { value: 'ajuste', label: 'Ajuste', hint: 'Corrección por conteo físico. Acepta valores +/-.' },
];

/* ------------------------------------------------------------------ */
/* Alertas                                                             */
/* ------------------------------------------------------------------ */

export type InventoryAlertFlag = 'bajo_minimo' | 'sobre_stock' | 'por_vencer' | 'vencido';

export const INVENTORY_ALERT_LABELS: Record<InventoryAlertFlag, string> = {
  bajo_minimo: 'Bajo mínimo',
  sobre_stock: 'Sobre stock',
  por_vencer: 'Por vencer',
  vencido: 'Vencido',
};

/* ------------------------------------------------------------------ */
/* Insumo                                                              */
/* ------------------------------------------------------------------ */

export interface InventoryItem {
  id: number;
  farm_id: number;
  code: string;
  name: string;
  category: InventoryCategory | string;
  category_label?: string;
  unit: string;
  unit_label?: string;
  unit_short?: string;
  current_stock: string | number;
  min_stock: string | number;
  max_stock: string | number | null;
  batch_number: string | null;
  manufacturing_date: string | null;
  expiration_date: string | null;
  location: string | null;
  unit_cost: string | number;
  total_cost: string | number;
  supplier: string | null;
  supplier_id?: number | null;
  warehouse_id?: number | null;
  supplier_name?: string | null;
  warehouse_name?: string | null;
  last_purchase_date: string | null;
  low_stock_alerted_at?: string | null;
  created_at?: string;
  updated_at?: string | null;
  creator?: InventoryUser | null;
  alert_flags?: InventoryAlertFlag[];
  is_low_stock?: boolean;
  is_over_stock?: boolean;
  is_expired?: boolean;
  is_expiring_soon?: boolean;
}

/* ------------------------------------------------------------------ */
/* Movimiento                                                          */
/* ------------------------------------------------------------------ */

export interface InventoryMovement {
  id: number;
  farm_id: number;
  inventory_item_id: number;
  type: InventoryMovementType;
  type_label?: string;
  quantity: string | number;
  resulting_stock: string | number;
  stock_effect?: number;
  destination_lot_id: number | null;
  inventory_lot_id?: number | null;
  notes: string | null;
  movement_date: string;
  user_id: number | null;
  created_at?: string;
  item_name?: string | null;
  item_code?: string | null;
  unit?: string | null;
  unit_short?: string | null;
  lot_code?: string | null;
  inventory_lot_code?: string | null;
  inventory_lot_label?: string | null;
  responsible_name?: string | null;
  item?: { id: number; code: string; name: string; unit?: string } | null;
  lot?: { id: number; code: string } | null;
  inventory_lot?: { id: number; code: string; expiration_date?: string | null } | null;
  user?: InventoryUser | null;
}

/* ------------------------------------------------------------------ */
/* Métricas / respuestas                                               */
/* ------------------------------------------------------------------ */

export interface InventoryStats {
  total_items: number;
  total_value: number;
  low_stock: number;
  over_stock: number;
  expiring: number;
  expired: number;
}

export interface InventoryListResponse {
  data: InventoryItem[];
  stats: InventoryStats;
}

export interface InventoryAlerts {
  low_stock: InventoryItem[];
  over_stock: InventoryItem[];
  expiring: InventoryItem[];
  expired: InventoryItem[];
}

export interface InventoryFilters {
  search?: string;
  category?: string;
  alert?: '' | 'low_stock' | 'over_stock' | 'expiring' | 'expired';
  farm_id?: number | string;
}

export interface CreateInventoryItemDTO {
  name: string;
  category: string;
  unit: string;
  min_stock: number;
  max_stock?: number | null;
  batch_number?: string | null;
  manufacturing_date?: string | null;
  expiration_date?: string | null;
  location?: string | null;
  unit_cost: number;
  supplier?: string | null;
  supplier_id?: number | null;
  warehouse_id?: number | null;
  last_purchase_date?: string | null;
  current_stock?: number;
  farm_id?: number | string;
}

export interface UpdateInventoryItemDTO {
  name: string;
  category: string;
  unit: string;
  min_stock: number;
  max_stock?: number | null;
  batch_number?: string | null;
  manufacturing_date?: string | null;
  expiration_date?: string | null;
  location?: string | null;
  unit_cost: number;
  supplier?: string | null;
  supplier_id?: number | null;
  warehouse_id?: number | null;
  last_purchase_date?: string | null;
}

export interface CreateInventoryMovementDTO {
  inventory_item_id: number;
  type: InventoryMovementType;
  quantity: number;
  destination_lot_id?: number | null;
  inventory_lot_id?: number | null;
  notes?: string | null;
}

export interface InventoryMovementFilters {
  type?: string;
  inventory_item_id?: number | string;
  destination_lot_id?: number | string;
  inventory_lot_id?: number | string;
  from?: string;
  to?: string;
  farm_id?: number | string;
}

/* ------------------------------------------------------------------ */
/* Catálogos: proveedores y bodegas                                    */
/* ------------------------------------------------------------------ */

export interface InventorySupplier {
  id: number;
  farm_id: number;
  name: string;
  tax_id: string | null;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  is_active: boolean;
  items_count?: number;
  created_at?: string;
  updated_at?: string | null;
  creator?: InventoryUser | null;
}

export interface InventoryWarehouse {
  id: number;
  farm_id: number;
  name: string;
  code: string | null;
  address: string | null;
  manager_name: string | null;
  notes: string | null;
  is_active: boolean;
  items_count?: number;
  created_at?: string;
  updated_at?: string | null;
  creator?: InventoryUser | null;
}

export interface InventoryCatalogFilters {
  search?: string;
  is_active?: boolean;
  farm_id?: number | string;
}

export interface CreateInventorySupplierDTO {
  name: string;
  tax_id?: string | null;
  contact_name?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  notes?: string | null;
  is_active?: boolean;
  farm_id?: number | string;
}

export type UpdateInventorySupplierDTO = Partial<CreateInventorySupplierDTO>;

export interface CreateInventoryWarehouseDTO {
  name: string;
  code?: string | null;
  address?: string | null;
  manager_name?: string | null;
  notes?: string | null;
  is_active?: boolean;
  farm_id?: number | string;
}

export type UpdateInventoryWarehouseDTO = Partial<CreateInventoryWarehouseDTO>;

/* ------------------------------------------------------------------ */
/* Catálogo: lotes de insumos                                          */
/* ------------------------------------------------------------------ */

export interface InventoryLot {
  id: number;
  farm_id: number;
  inventory_item_id: number | null;
  code: string;
  supplier_id: number | null;
  manufacturing_date: string | null;
  expiration_date: string | null;
  notes: string | null;
  label?: string;
  item_code?: string | null;
  item_name?: string | null;
  item_unit?: string | null;
  supplier_name?: string | null;
  is_expired?: boolean;
  is_expiring_soon?: boolean;
  created_at?: string;
  updated_at?: string | null;
  creator?: InventoryUser | null;
}

export interface InventoryLotFilters {
  search?: string;
  inventory_item_id?: number | string;
  farm_id?: number | string;
}

export interface CreateInventoryLotDTO {
  /** Si se omite, el backend genera un código LOTE-XXXXX. */
  code?: string | null;
  inventory_item_id?: number | null;
  supplier_id?: number | null;
  manufacturing_date?: string | null;
  expiration_date?: string | null;
  notes?: string | null;
  farm_id?: number | string;
}

export type UpdateInventoryLotDTO = Partial<CreateInventoryLotDTO>;
