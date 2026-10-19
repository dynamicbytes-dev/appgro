/**
 * Tipos del módulo Analítica y Reportes.
 *
 * Reflejan la estructura devuelta por `AnalyticsController`:
 *  - Resumen ejecutivo (KPIs consolidados).
 *  - Analítica financiera (costos, mermas, rentabilidad).
 *  - Analítica operativa (ocupación, lotes, inventario crítico).
 *  - Analítica de personal (productividad y tiempos de respuesta).
 */

/* ------------------------------------------------------------------ */
/* Resumen ejecutivo                                                   */
/* ------------------------------------------------------------------ */

export interface AnalyticsSummary {
  total_cost: number;
  total_revenue: number;
  profit: number;
  margin_percent: number | null;
  occupancy_percent: number;
  capacity: number;
  occupied: number;
  eggs_total: number;
  eggs_good: number;
  eggs_broken: number;
  broken_percent: number;
  activities_percent: number;
  activities_total: number;
  activities_completed: number;
  items_at_risk: number;
  lots_total: number;
  farm_id: number | null;
}

/* ------------------------------------------------------------------ */
/* Analítica financiera                                                */
/* ------------------------------------------------------------------ */

export interface FinancialCosts {
  investment: number;
  inputs: number;
  eggs: number;
  eggs_broken: number;
  total: number;
}

export interface FinancialRevenue {
  harvest: number;
  total: number;
}

export interface FinancialSector {
  sector: string;
  sector_label: string;
  lots: number;
  cost: number;
  revenue: number;
  profit: number;
}

export interface FinancialLot {
  id: number;
  code: string;
  purpose: string;
  purpose_label: string;
  sector_label: string;
  cost: number;
  revenue: number;
  profit: number;
}

export interface FinancialInput {
  item_id: number;
  code: string;
  name: string;
  consumed: number;
  unit_cost: number;
  cost: number;
}

export interface EggsSeriesPoint {
  date: string;
  good_eggs: number;
  broken_eggs: number;
  good_cost: number;
  broken_cost: number;
}

export interface EggsTotals {
  good: number;
  broken: number;
  total: number;
  broken_percent: number;
}

export interface AnalyticsFinancial {
  costs: FinancialCosts;
  revenue: FinancialRevenue;
  profit: number;
  margin_percent: number | null;
  by_sector: FinancialSector[];
  by_lot: FinancialLot[];
  inputs_top: FinancialInput[];
  eggs: EggsTotals;
  eggs_series: EggsSeriesPoint[];
}

/* ------------------------------------------------------------------ */
/* Analítica operativa                                                 */
/* ------------------------------------------------------------------ */

export interface ShedOccupancy {
  id: number;
  name: string;
  sector_label: string;
  purpose_label: string;
  capacity: number;
  occupied: number;
  percent: number;
}

export interface CapacitySnapshot {
  capacity: number;
  occupied: number;
  percent: number;
  galpones_active: number;
  sheds: ShedOccupancy[];
}

export interface CountByKey {
  [key: string]: any;
}

export interface StatusCount {
  status: string;
  count: number;
}

export interface PurposeCount {
  purpose: string;
  label: string;
  count: number;
  quantity: number;
}

export interface SectorCount {
  sector: string;
  label: string;
  count: number;
  quantity: number;
}

export interface LowStockItem {
  id: number;
  code: string;
  name: string;
  current_stock: number;
  min_stock: number;
  unit_short: string;
}

export interface ExpiringItem {
  id: number;
  code: string;
  name: string;
  expiration_date: string | null;
  is_expired: boolean;
}

export interface RecentEntry {
  id: number;
  code: string;
  item_code: string | null;
  item_name: string | null;
  expiration_date: string | null;
  created_at: string | null;
}

export interface InventorySnapshot {
  available: boolean;
  low_stock: LowStockItem[];
  expiring: ExpiringItem[];
  recent_entries: RecentEntry[];
  total_items: number;
  stock_value: number;
}

export interface AnalyticsOperations {
  capacity: CapacitySnapshot;
  lots: {
    total: number;
    by_status: StatusCount[];
    by_purpose: PurposeCount[];
    by_sector: SectorCount[];
  };
  inventory: InventorySnapshot;
  items_at_risk: number;
}

/* ------------------------------------------------------------------ */
/* Analítica de personal                                               */
/* ------------------------------------------------------------------ */

export interface StaffMember {
  user_id: number;
  name: string;
  total: number;
  completed: number;
  in_progress: number;
  pending: number;
  overdue: number;
  completion_percent: number;
  avg_response_hours: number | null;
  avg_days_vs_due: number | null;
}

export interface StaffSummaryKpi {
  total: number;
  completed: number;
  in_progress: number;
  pending: number;
  overdue: number;
  completion_percent: number;
  avg_response_hours: number | null;
  avg_days_vs_due: number | null;
}

export type StaffScope = 'global' | 'farm' | 'self';

export interface AnalyticsStaff {
  scope: StaffScope;
  team: StaffMember[];
  summary: StaffSummaryKpi;
}

/* ------------------------------------------------------------------ */
/* Utilidades                                                          */
/* ------------------------------------------------------------------ */

/** Etiquetas legibles de los estados de lote normalizados. */
export const LOT_STATUS_LABELS: Record<string, string> = {
  activo: 'Activo',
  inactivo: 'Inactivo',
  sin_estado: 'Sin estado',
};
