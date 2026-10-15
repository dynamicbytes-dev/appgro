import React from 'react';

export type StatusGender = 'female' | 'male';

export interface StatusBadgeProps {
  /**
   * The status value. Strictly normalized to handle booleans, numbers (1/0),
   * string flags ('1'/'0', 'true'/'false', 'active'/'inactive').
   */
  isActive: boolean | number | string | null | undefined;

  /**
   * Grammatical gender for default text:
   * 'female' -> 'Activa' / 'Inactiva' (default for Especies, Granjas, etc.)
   * 'male' -> 'Activo' / 'Inactivo' (for Lotes, Galpones, Administradores, Encargados, etc.)
   */
  gender?: StatusGender;

  /**
   * Custom text overrides
   */
  activeText?: string;
  inactiveText?: string;

  /**
   * Size variation
   */
  size?: 'sm' | 'md';

  /**
   * Whether to display the small glowing status dot
   */
  showDot?: boolean;

  /**
   * Additional Tailwind classes
   */
  className?: string;
}

/**
 * Normalizes any backend representation of a status flag to a strict boolean.
 * Fixes known bugs where '0' as a string or 0 as an integer is evaluated inconsistently.
 */
export const normalizeIsActive = (val: unknown): boolean => {
  if (val === true || val === 1 || val === '1') return true;
  if (val === false || val === 0 || val === '0' || val === null || val === undefined) return false;

  if (typeof val === 'string') {
    const s = val.trim().toLowerCase();
    if (s === 'true' || s === 'active' || s === 'activo' || s === 'activa' || s === 'enabled' || s === 'habilitado' || s === 'habilitada' || s === 'verificado' || s === 'gestación' || s === 'gestacion' || s === 'destete') {
      return true;
    }
    if (s === 'false' || s === 'inactive' || s === 'inactivo' || s === 'inactiva' || s === 'disabled' || s === 'inhabilitado' || s === 'inhabilitada' || s === 'en proceso' || s === 'pendiente'
      // Estados de animales individuales fuera de producción (módulo Lotes)
      || s === 'cosechado' || s === 'vendido' || s === 'descartado' || s === 'muerto') {
      return false;
    }
  }

  return Boolean(val);
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  isActive,
  gender = 'female',
  activeText,
  inactiveText,
  size = 'sm',
  showDot = true,
  className = '',
}) => {
  const active = normalizeIsActive(isActive);

  // Compute text label
  const label = active
    ? activeText || (gender === 'male' ? 'Activo' : 'Activa')
    : inactiveText || (gender === 'male' ? 'Inactivo' : 'Inactiva');

  // Styling
  const sizeClasses = size === 'md' ? 'px-3 py-1 text-xs' : 'px-2.5 py-0.5 text-[11px]';

  const badgeStyle = active
    ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 dark:bg-emerald-500/15 dark:border-emerald-500/30'
    : 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/30 dark:bg-amber-500/15 dark:border-amber-500/30';

  const dotColor = active
    ? 'bg-emerald-500 dark:bg-emerald-400'
    : 'bg-amber-500 dark:bg-amber-400';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-bold uppercase tracking-wider select-none shrink-0 ${sizeClasses} ${badgeStyle} ${className}`}
    >
      {showDot && (
        <span
          aria-hidden="true"
          className={`w-1.5 h-1.5 rounded-full ${dotColor}`}
        />
      )}
      <span>{label}</span>
    </span>
  );
};

export default StatusBadge;
