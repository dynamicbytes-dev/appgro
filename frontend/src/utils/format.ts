/**
 * Utilidades de formato centralizadas de Zootika.
 *
 * Un único origen de verdad para montos, números, porcentajes, fechas y horas.
 * Evita las ~6 copias de `formatDate` y las múltiples variantes de formateadores
 * repartidas por el proyecto.
 */

/** Convierte cualquier valor del backend (string decimal, null, undefined) a número seguro. */
export const toNumber = (value: unknown): number => {
  if (value === null || value === undefined || value === '') return 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

/** Indica si un valor es numérico "real" (no null/undefined/vacío). */
export const isPresent = (value: unknown): value is string | number =>
  value !== null && value !== undefined && value !== '';

/** Formatea un entero/decimal con separador de miles: `1.234,5`. */
export const formatNumber = (value: unknown, decimals = 0): string => {
  const n = toNumber(value);
  try {
    return new Intl.NumberFormat('es-EC', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(n);
  } catch {
    return n.toFixed(decimals);
  }
};

/** Formatea un monto monetario: `$1.234,50`. */
export const formatMoney = (
  value: unknown,
  currency = 'USD',
  locale = 'es-EC'
): string => {
  const n = toNumber(value);
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
    }).format(n);
  } catch {
    return `$${n.toFixed(2)}`;
  }
};

/**
 * Formatea un porcentaje: `42.5%`.
 * Devuelve `—` cuando el valor es nulo (p. ej. un margen sin ingresos).
 */
export const formatPercent = (value: unknown, decimals = 1): string => {
  if (!isPresent(value)) return '—';
  return `${formatNumber(value, decimals)}%`;
};

/** Fecha corta legible: `15 oct 2026`. */
export const formatDate = (iso?: string | null): string => {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return String(iso);
  return date.toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

/** Fecha + hora: `15 oct 2026, 14:30`. */
export const formatDateTime = (iso?: string | null): string => {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return String(iso);
  return date.toLocaleString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

/** Fecha numérica corta: `15/10/2026`. */
export const formatDateShort = (iso?: string | null): string => {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return String(iso);
  return date.toLocaleDateString('es-ES');
};

/** Convierte una fecha a `YYYY-MM-DD` para inputs type="date". */
export const toDateInput = (value?: string | Date | null): string => {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
};
