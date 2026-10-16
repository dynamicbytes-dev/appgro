import React from 'react';

export interface DonutSegment {
  label: string;
  value: number;
  color: string;
}

interface DonutProps {
  segments: DonutSegment[];
  size?: number;
  thickness?: number;
  /** Valor central grande. */
  centerValue?: string;
  /** Leyenda bajo el donut (por defecto activada). */
  showLegend?: boolean;
  className?: string;
}

/**
 * Gráfico de dona (anillo) en SVG puro.
 *
 * Se utiliza para la composición de lotes (activos/inactivos) y su
 * distribución por propósito, sin añadir librerías de gráficas.
 */
export const Donut: React.FC<DonutProps> = ({
  segments,
  size = 180,
  thickness = 26,
  centerValue,
  showLegend = true,
  className = '',
}) => {
  const safeSegments = (segments || []).filter((s) => Number.isFinite(s.value) && s.value > 0);
  const total = safeSegments.reduce((sum, s) => sum + s.value, 0);

  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - thickness / 2;
  const circumference = 2 * Math.PI * r;

  let offset = 0;

  return (
    <div className={`flex flex-col sm:flex-row items-center gap-5 ${className}`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Distribución">
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke="currentColor"
          className="text-gray-100 dark:text-[#263632]"
          strokeWidth={thickness}
        />
        {total > 0 &&
          safeSegments.map((segment, index) => {
            const length = (segment.value / total) * circumference;
            const dash = `${length} ${circumference - length}`;
            const dashOffset = -offset;
            offset += length;

            return (
              <circle
                key={`donut-seg-${segment.label}-${index}`}
                cx={cx}
                cy={cy}
                r={r}
                fill="none"
                stroke={segment.color}
                strokeWidth={thickness}
                strokeDasharray={dash}
                strokeDashoffset={dashOffset}
                strokeLinecap="butt"
                transform={`rotate(-90 ${cx} ${cy})`}
              />
            );
          })}
        {centerValue && (
          <text
            x={cx}
            y={cy + size * 0.06}
            textAnchor="middle"
            className="fill-[#1E1E1E] dark:fill-gray-100"
            style={{ fontSize: size * 0.16, fontWeight: 800 }}
          >
            {centerValue}
          </text>
        )}
      </svg>

      {showLegend && (
        <ul className="space-y-2 min-w-0">
          {(segments || []).map((segment, index) => {
            const percent = total > 0 ? Math.round((segment.value / total) * 100) : 0;
            return (
              <li key={`donut-legend-${segment.label}-${index}`} className="flex items-center gap-2 text-xs">
                <span
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ backgroundColor: segment.color }}
                />
                <span className="text-gray-600 dark:text-gray-300 truncate">{segment.label}</span>
                <span className="font-bold text-gray-800 dark:text-gray-100 ml-auto">
                  {segment.value} <span className="text-gray-400 font-normal">({percent}%)</span>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default Donut;
