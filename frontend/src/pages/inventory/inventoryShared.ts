import { safeText } from '../../utils/safeText';
import {
  INVENTORY_UNIT_SHORTS,
  type InventoryAlertFlag,
  type InventoryMovementType,
} from '../../types/inventory';

export const inputClasses =
  'w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-[#263632] bg-white dark:bg-[#18221F] text-sm text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-[#1B4D3E]';

/** Convierte cualquier valor del backend (string decimal) a número. */
export const toNumber = (value: unknown): number => {
  if (value === null || value === undefined || value === '') return 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

/** Formatea una cantidad de stock sin decimales innecesarios. */
export const formatQty = (value: unknown): string => {
  const n = toNumber(value);
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
};

/** Abreviatura legible de una unidad de medida (p. ej. «kg»). */
export const unitShortOf = (unit?: string | null): string => {
  if (!unit) return '';
  return INVENTORY_UNIT_SHORTS[unit] ?? unit;
};

/** Formatea una cantidad junto a su unidad: «12 kg». */
export const formatQtyWithUnit = (value: unknown, unit?: string | null): string => {
  const qty = formatQty(value);
  const short = unitShortOf(unit);
  return short ? `${qty} ${short}` : qty;
};

/** Formatea un monto monetario en USD. */
export const formatMoney = (value: unknown): string => {
  const n = toNumber(value);
  try {
    return new Intl.NumberFormat('es-EC', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(n);
  } catch {
    return `$${n.toFixed(2)}`;
  }
};

export const formatDate = (iso?: string | null): string => {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return safeText(iso, '—');
  return date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
};

export const formatDateTime = (iso?: string | null): string => {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return safeText(iso, '—');
  return date.toLocaleString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const todayIso = (): string => new Date().toISOString().split('T')[0];

/** Variante de Badge por tipo de alerta. */
export const ALERT_BADGE_VARIANT: Record<
  InventoryAlertFlag,
  'success' | 'warning' | 'danger' | 'info' | 'primary'
> = {
  bajo_minimo: 'danger',
  sobre_stock: 'warning',
  por_vencer: 'warning',
  vencido: 'danger',
};

/** Variante de Badge por tipo de movimiento. */
export const MOVEMENT_BADGE_VARIANT: Record<
  InventoryMovementType,
  'success' | 'warning' | 'danger' | 'info' | 'primary'
> = {
  entrada: 'success',
  salida: 'info',
  ajuste: 'warning',
};
