import type { ModuleConfig, ModuleId } from "../types/auth";

export const SYSTEM_MODULES: Record<ModuleId, ModuleConfig> = {
  especies: {
    id: "especies",
    name: "Especies",
    description: "Gestión de especies y tipos de animales de la granja",
    icon: "Layers",
    category: "operativo",
    roles: ["ADMIN", "ENCARGADO"],
  },
  galpones: {
    id: "galpones",
    name: "Galpones",
    description: "Control de galpones, corrales e infraestructura",
    icon: "Warehouse",
    category: "operativo",
    roles: ["ADMIN", "ENCARGADO"],
  },
  potreros: {
    id: "potreros",
    name: "Potreros",
    description: "Gestión de potreros y pastoreo (Bovino, Ovino y Caprino)",
    icon: "Fence",
    category: "operativo",
    roles: ["ADMIN", "ENCARGADO"],
  },
  lotes: {
    id: "lotes",
    name: "Lotes",
    description: "Gestión de lotes de producción y capacidad de alojamiento",
    icon: "Boxes",
    category: "operativo",
    roles: ["ADMIN", "ENCARGADO"],
  },
  actividades: {
    id: "actividades",
    name: "Actividades",
    description: "Registro de tareas de campo, alimentación y controles sanitarios",
    icon: "ClipboardList",
    category: "operativo",
    roles: ["ADMIN", "ENCARGADO"],
  },
  inventario: {
    id: "inventario",
    name: "Inventario",
    description: "Control de insumos, stock, vencimientos y movimientos",
    icon: "Package",
    category: "operativo",
    roles: ["ADMIN", "ENCARGADO"],
  },
  analitica: {
    id: "analitica",
    name: "Analítica",
    description: "Reportes, estadísticas e indicadores de rendimiento KPI",
    icon: "BarChart3",
    category: "gestion",
    roles: ["ROOT", "ADMIN", "ENCARGADO"],
  },
  historial: {
    id: "historial",
    name: "Historial",
    description: "Registro de auditoría, trazabilidad y actividades del sistema",
    icon: "History",
    category: "gestion",
    roles: ["ROOT", "ADMIN", "ENCARGADO"],
  },
};

/**
 * Orden canónico de aparición de los módulos en la barra lateral.
 *
 * Se usa para ordenar la lista de módulos habilitados, cuyo orden de
 * origen no está garantizado: el root itera las claves de
 * `SYSTEM_MODULES` y los demás roles reciben el arreglo `enabledModules`
 * desde la API (orden de la base de datos). El orden solicitado para los
 * "Módulos Agropecuarios Operativos" es:
 *
 *  1. Especies
 *  2. Galpones
 *  3. Lotes
 *  4. Inventario
 *  5. Actividades
 *  6. Analítica
 *
 * `historial` se mantiene al final: para admin y root se muestra en su
 * bloque administrativo, y para el encargado se conserva como último
 * elemento operativo (comportamiento previo).
 */
export const MODULE_DISPLAY_ORDER: ModuleId[] = [
  "especies",
  "galpones",
  "potreros",
  "lotes",
  "inventario",
  "actividades",
  "analitica",
  "historial",
];

export const MODULE_ALIAS_MAP: Record<string, ModuleId> = {
  // English backend codes mapped to canonical Spanish keys
  species: "especies",
  specie: "especies",
  barns: "galpones",
  barn: "galpones",
  potreros: "potreros",
  potrero: "potreros",
  paddocks: "potreros",
  lots: "lotes",
  lot: "lotes",
  activities: "actividades",
  activity: "actividades",
  inventory: "inventario",
  analytics: "analitica",
  analytic: "analitica",
  history: "historial",
  audit: "historial",

  // Spanish keys
  especies: "especies",
  especie: "especies",
  galpones: "galpones",
  galpon: "galpones",
  lotes: "lotes",
  lote: "lotes",
  actividades: "actividades",
  actividad: "actividades",
  inventario: "inventario",
  analitica: "analitica",
  analítica: "analitica",
  historial: "historial",
  auditoria: "historial",
  auditoría: "historial",

  // Numeric database IDs
  "1": "especies",
  "2": "especies",
  "3": "galpones",
  "4": "lotes",
  "5": "actividades",
  "6": "analitica",
  "7": "historial",
  "10": "inventario",
  "11": "potreros",
};

export const CODE_TO_MODULE_ID: Record<string, number> = {
  species: 2,
  especies: 2,
  specie: 2,
  especie: 2,

  barns: 3,
  galpones: 3,
  barn: 3,
  galpon: 3,

  potreros: 11,
  potrero: 11,
  paddocks: 11,

  lots: 4,
  lotes: 4,
  lot: 4,
  lote: 4,

  activities: 5,
  actividades: 5,
  activity: 5,
  actividad: 5,

  inventory: 10,
  inventario: 10,

  analytics: 6,
  analitica: 6,
  analytic: 6,
  analítica: 6,

  history: 7,
  historial: 7,
  audit: 7,
  auditoria: 7,
  auditoría: 7,
};

export const normalizeModuleCode = (val: any): ModuleId | null => {
  if (val === null || val === undefined) return null;

  if (typeof val === "number" || (!isNaN(Number(val)) && String(val).trim() !== "")) {
    const key = String(val).trim();
    if (MODULE_ALIAS_MAP[key]) return MODULE_ALIAS_MAP[key];
  }

  const str = String(val).trim().toLowerCase();
  if (MODULE_ALIAS_MAP[str]) return MODULE_ALIAS_MAP[str];
  if (str in SYSTEM_MODULES) return str as ModuleId;

  return null;
};

export const isModuleItemEnabled = (m: any): boolean => {
  if (m === null || m === undefined) return false;
  if (typeof m === 'boolean') return m === true;
  if (typeof m === 'number') return m === 1;
  if (typeof m === 'string') {
    const s = m.toLowerCase().trim();
    return s === 'true' || s === '1' || s === 'active' || s === 'enabled';
  }

  const pivot = m.pivot || {};

  // 1. Explicit evaluation of is_enabled (Primary column in farm_modules table)
  const isEnabledVal = m.is_enabled !== undefined ? m.is_enabled : pivot.is_enabled;
  if (isEnabledVal !== undefined && isEnabledVal !== null) {
    if (typeof isEnabledVal === 'boolean') return isEnabledVal === true;
    if (typeof isEnabledVal === 'number') return isEnabledVal === 1;
    const str = String(isEnabledVal).toLowerCase().trim();
    return str === 'true' || str === '1' || str === 'active' || str === 'enabled';
  }

  // 2. Explicit evaluation of is_active
  const isActiveVal = m.is_active !== undefined ? m.is_active : pivot.is_active;
  if (isActiveVal !== undefined && isActiveVal !== null) {
    if (typeof isActiveVal === 'boolean') return isActiveVal === true;
    if (typeof isActiveVal === 'number') return isActiveVal === 1;
    const str = String(isActiveVal).toLowerCase().trim();
    return str === 'true' || str === '1' || str === 'active' || str === 'enabled';
  }

  // 3. Fallback to enabled
  const enabledVal = m.enabled !== undefined ? m.enabled : pivot.enabled;
  if (enabledVal !== undefined && enabledVal !== null) {
    if (typeof enabledVal === 'boolean') return enabledVal === true;
    if (typeof enabledVal === 'number') return enabledVal === 1;
    const str = String(enabledVal).toLowerCase().trim();
    return str === 'true' || str === '1' || str === 'active' || str === 'enabled';
  }

  // 4. Status string
  const statusVal = m.status !== undefined ? m.status : pivot.status;
  if (statusVal !== undefined && statusVal !== null) {
    const str = String(statusVal).toLowerCase().trim();
    return str === 'active' || str === 'enabled' || str === 'true' || str === '1';
  }

  return false;
};
