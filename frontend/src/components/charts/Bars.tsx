import React from 'react';

export interface BarDatum {
  label: string;
  value: number;
  /** Color de la barra; por defecto el verde corporativo. */
  color?: string;
  /** Texto a la derecha (por defecto el valor formateado). */
  caption?: string;
}

interface BarsProps {
  data: BarDatum[];
  /** Formateador del valor mostrado a la derecha. */
  formatValue?: (value: number) => string;
  /** Color por defecto cuando el dato no define uno. */
  color?: string;
  /** Mensaje cuando no hay datos. */
  emptyText?: string;
  className?: string;
}

/**
 * Ranking de barras horizontales en HTML/Tailwind.
 *
 * A diferencia de las gráficas SVG, este componente es ideal para
 * comparar magnitudes con etiquetas largas (insumos, lotes, sectores).
 */
export const Bars: React.FC<BarsProps> = ({
  data,
  formatValue,
  color = '#4E9F3D',
  emptyText = 'Sin datos para mostrar.',
  className = '',
}) => {
  const list = (data || []).filter((d) => Number.isFinite(d.value));
  const max = list.reduce((acc, d) => Math.max(acc, d.value), 0);
  const fmt = formatValue ?? ((v: number) => String(v));

  if (list.length === 0) {
    return <p className="text-xs text-gray-400 dark:text-gray-500 py-3">{emptyText}</p>;
  }

  return (
    <ul className={`space-y-3 ${className}`}>
      {list.map((datum, index) => {
        const percent = max > 0 ? Math.max(2, (datum.value / max) * 100) : 0;
        return (
          <li key={`bar-${datum.label}-${index}`}>
            <div className="flex items-center justify-between gap-3 mb-1">
              <span className="text-xs font-semibold text-gray-700 dark:text-gray-200 truncate">
                {datum.label}
              </span>
              <span className="text-xs font-bold text-gray-800 dark:text-gray-100 shrink-0">
                {datum.caption ?? fmt(datum.value)}
              </span>
            </div>
            <div className="w-full h-2 rounded-full bg-gray-100 dark:bg-[#263632] overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${percent}%`, backgroundColor: datum.color ?? color }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
};

export default Bars;
