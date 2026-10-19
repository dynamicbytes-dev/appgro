import React from 'react';
import { renderSafe, safeText } from '../../utils/safeText';

export type StatTone = 'brand' | 'emerald' | 'amber' | 'red' | 'slate' | 'blue';

export interface StatCardProps {
  label: React.ReactNode;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: React.ReactNode;
  tone?: StatTone;
  className?: string;
}

const TONE_STYLES: Record<StatTone, { iconWrap: string; icon: string; value: string }> = {
  brand: {
    iconWrap: 'bg-brand/10 dark:bg-accent/10',
    icon: 'text-brand dark:text-accent',
    value: 'text-ink dark:text-gray-100',
  },
  emerald: {
    iconWrap: 'bg-emerald-500/10',
    icon: 'text-emerald-600 dark:text-emerald-400',
    value: 'text-ink dark:text-gray-100',
  },
  amber: {
    iconWrap: 'bg-amber-500/10',
    icon: 'text-amber-600 dark:text-amber-400',
    value: 'text-amber-700 dark:text-amber-300',
  },
  red: {
    iconWrap: 'bg-red-500/10',
    icon: 'text-red-600 dark:text-red-400',
    value: 'text-red-700 dark:text-red-300',
  },
  slate: {
    iconWrap: 'bg-gray-500/10',
    icon: 'text-gray-500 dark:text-gray-400',
    value: 'text-ink dark:text-gray-100',
  },
  blue: {
    iconWrap: 'bg-blue-500/10',
    icon: 'text-blue-600 dark:text-blue-400',
    value: 'text-blue-700 dark:text-blue-300',
  },
};

/**
 * Tarjeta de indicador (KPI) unificada. Reemplaza las ~13 variantes de KPI
 * repartidas por los dashboards.
 */
export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  hint,
  icon,
  tone = 'brand',
  className = '',
}) => {
  const style = TONE_STYLES[tone];

  return (
    <div
      className={`flex items-start justify-between gap-3 rounded-2xl border border-gray-200/80 bg-surface p-5 shadow-sm transition-shadow hover:shadow-md dark:border-line-dark dark:bg-surface-dark ${className}`}
    >
      <div className="min-w-0">
        <p className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
          {safeText(label)}
        </p>
        <p className={`mt-1 text-2xl font-black leading-tight ${style.value}`}>
          {renderSafe(value)}
        </p>
        {hint && (
          <p className="mt-1 text-[11px] font-medium text-gray-500 dark:text-gray-400">
            {renderSafe(hint)}
          </p>
        )}
      </div>
      {icon && (
        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${style.iconWrap} ${style.icon}`}
        >
          {icon}
        </span>
      )}
    </div>
  );
};

/** Alias semántico usado en contextos de analítica. */
export const KpiCard = StatCard;
