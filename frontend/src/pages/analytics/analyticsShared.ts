/**
 * Utilidades y paleta compartida del módulo Analítica.
 */

/** Convierte cualquier valor del backend (string decimal) a número. */
export const toNumber = (value: unknown): number => {
  if (value === null || value === undefined || value === '') return 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
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

/** Formatea un entero/decimal con separador de miles. */
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

/** Formatea un porcentaje: `42.5%`. */
export const formatPercent = (value: unknown): string => `${formatNumber(value, 1)}%`;

/** Fecha larga legible: `15 oct 2026`. */
export const formatDate = (iso?: string | null): string => {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return String(iso);
  return date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
};

/** Etiqueta compacta para ejes de gráficas: `15/10`. */
export const formatShortDate = (iso?: string | null): string => {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return String(iso);
  return date.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' });
};

/**
 * Convierte horas a un texto legible:
 *  - `null` → `—`
 *  - < 48 h → `12.5 h`
 *  - ≥ 48 h → `3.2 d`
 */
export const formatHours = (value: number | null | undefined): string => {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  if (Math.abs(value) >= 48) return `${formatNumber(value / 24, 1)} d`;
  return `${formatNumber(value, 1)} h`;
};

/**
 * Convierte una diferencia en días (vs. fecha límite) a texto:
 *  - Negativo → entregado X días ANTES.
 *  - Positivo → entregado X días DESPUÉS (retraso).
 */
export const formatDaysVsDue = (value: number | null | undefined): string => {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  if (value <= 0) return `${formatNumber(Math.abs(value), 1)} d antes`;
  return `${formatNumber(value, 1)} d de retraso`;
};

/** Paleta corporativa consistente con el resto de la aplicación. */
export const CHART_COLORS = {
  primary: '#1B4D3E',
  accent: '#4E9F3D',
  light: '#6DBF5C',
  amber: '#F59E0B',
  red: '#DC2626',
  blue: '#2563EB',
  purple: '#7C3AED',
  gray: '#9CA3AF',
};

/** Colores por sector normalizado. */
export const SECTOR_COLORS: Record<string, string> = {
  porcino: '#7C3AED',
  avicola: '#F59E0B',
  bovino: '#2563EB',
  mixto: '#4E9F3D',
  otros: '#9CA3AF',
};

/** Colores por propósito normalizado. */
export const PURPOSE_COLORS: Record<string, string> = {
  carne: '#DC2626',
  postura: '#F59E0B',
  reproduccion: '#7C3AED',
  sin_definir: '#9CA3AF',
  otros: '#9CA3AF',
};

/** Colores por estado de lote. */
export const STATUS_COLORS: Record<string, string> = {
  activo: '#4E9F3D',
  inactivo: '#9CA3AF',
  sin_estado: '#D1D5DB',
};

/** Devuelve un color estable a partir de una clave. */
export const colorForKey = (map: Record<string, string>, key: string, fallback = '#9CA3AF'): string =>
  map[key] ?? fallback;
