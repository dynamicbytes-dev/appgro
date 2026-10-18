import React from 'react';

interface SparklineProps {
  /** Serie de valores (se dibuja en orden). */
  data: number[];
  /** Color de la línea y del área. */
  color?: string;
  /** Alto en píxeles. */
  height?: number;
  /** Ancho lógico del viewBox (se estira al 100%). */
  width?: number;
  className?: string;
  /** Texto mostrado cuando aún no hay suficientes puntos. */
  emptyText?: string;
  ariaLabel?: string;
}

/**
 * Mini-gráfico de tendencia (línea + área) en SVG puro.
 *
 * Pensado para mostrar la evolución de una métrica dentro de la sesión sin
 * añadir librerías de gráficas. Requiere al menos 2 puntos.
 */
export const Sparkline: React.FC<SparklineProps> = ({
  data,
  color = '#4E9F3D',
  height = 44,
  width = 160,
  className = '',
  emptyText = 'Recopilando datos…',
  ariaLabel = 'Tendencia',
}) => {
  const values = (data || []).filter((v) => Number.isFinite(v));

  if (values.length < 2) {
    return (
      <div
        className={`flex items-center justify-center text-[10px] text-gray-400 dark:text-gray-500 ${className}`}
        style={{ height }}
      >
        {emptyText}
      </div>
    );
  }

  const pad = 3;
  const innerHeight = height - pad * 2;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;
  const step = width / (values.length - 1);

  const points = values.map((value, index) => {
    const x = index * step;
    const y = pad + innerHeight * (1 - (value - min) / range);
    return { x, y };
  });

  const polyline = points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const areaPath = `M 0 ${height - pad} L ${points
    .map((p) => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(' L ')} L ${width} ${height - pad} Z`;
  const last = points[points.length - 1];

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      height={height}
      preserveAspectRatio="none"
      className={className}
      role="img"
      aria-label={ariaLabel}
    >
      <path d={areaPath} fill={color} fillOpacity={0.12} stroke="none" />
      <polyline
        points={polyline}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      <circle cx={last.x} cy={last.y} r={2.5} fill={color} />
    </svg>
  );
};

export default Sparkline;
