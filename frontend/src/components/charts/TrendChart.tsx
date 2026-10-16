import React from 'react';

export interface TrendSeries {
  name: string;
  color: string;
  data: number[];
}

interface TrendChartProps {
  /** Etiquetas del eje X (misma longitud que `data` de cada serie). */
  labels: string[];
  series: TrendSeries[];
  height?: number;
  formatValue?: (value: number) => string;
  showLegend?: boolean;
  emptyText?: string;
  className?: string;
}

const VIEW_WIDTH = 640;

/**
 * Gráfico de tendencia temporal (líneas + área) en SVG puro.
 *
 * Se emplea para la evolución de huevos buenos vs. rotos a lo largo del
 * tiempo. Escala de forma uniforme para ser responsivo sin librerías.
 */
export const TrendChart: React.FC<TrendChartProps> = ({
  labels,
  series,
  height = 240,
  formatValue,
  showLegend = true,
  emptyText = 'Aún no hay registros históricos para graficar.',
  className = '',
}) => {
  const safeSeries = (series || []).filter((s) => Array.isArray(s.data));
  const pointCount = Math.max(labels?.length ?? 0, ...safeSeries.map((s) => s.data.length), 0);

  if (pointCount === 0) {
    return <p className="text-xs text-gray-400 dark:text-gray-500 py-6 text-center">{emptyText}</p>;
  }

  const fmt = formatValue ?? ((v: number) => String(v));

  const padLeft = 52;
  const padRight = 16;
  const padTop = 16;
  const padBottom = 30;
  const plotWidth = VIEW_WIDTH - padLeft - padRight;
  const plotHeight = height - padTop - padBottom;

  const max = Math.max(
    1,
    ...safeSeries.flatMap((s) => s.data.map((v) => (Number.isFinite(v) ? v : 0)))
  );

  const xAt = (index: number) =>
    pointCount > 1 ? padLeft + (index * plotWidth) / (pointCount - 1) : padLeft + plotWidth / 2;
  const yAt = (value: number) => padTop + plotHeight * (1 - value / max);

  const gridLines = [0, 0.25, 0.5, 0.75, 1];

  // Muestra como máximo 6 etiquetas del eje X para no saturar.
  const labelStep = Math.max(1, Math.ceil(pointCount / 6));

  return (
    <div className={`w-full ${className}`}>
      <svg
        viewBox={`0 0 ${VIEW_WIDTH} ${height}`}
        width="100%"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="Tendencia temporal"
      >
        {/* Rejilla y eje Y */}
        {gridLines.map((ratio) => {
          const y = padTop + plotHeight * ratio;
          const value = max * (1 - ratio);
          return (
            <g key={`grid-${ratio}`}>
              <line
                x1={padLeft}
                y1={y}
                x2={VIEW_WIDTH - padRight}
                y2={y}
                stroke="currentColor"
                className="text-gray-100 dark:text-[#263632]"
                strokeWidth={1}
              />
              <text
                x={padLeft - 8}
                y={y + 4}
                textAnchor="end"
                className="fill-gray-400 dark:fill-gray-500"
                style={{ fontSize: 10, fontWeight: 600 }}
              >
                {fmt(Math.round(value))}
              </text>
            </g>
          );
        })}

        {/* Series */}
        {safeSeries.map((serie, serieIndex) => {
          const points = serie.data.map((value, index) => ({
            x: xAt(index),
            y: yAt(Number.isFinite(value) ? value : 0),
          }));

          const linePath = points
            .map((p, index) => `${index === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
            .join(' ');

          const areaPath =
            points.length > 1
              ? `${linePath} L ${points[points.length - 1].x} ${padTop + plotHeight} L ${points[0].x} ${
                  padTop + plotHeight
                } Z`
              : '';

          return (
            <g key={`serie-${serie.name}-${serieIndex}`}>
              {areaPath && (
                <path d={areaPath} fill={serie.color} fillOpacity={0.12} stroke="none" />
              )}
              {points.length > 1 && (
                <path
                  d={linePath}
                  fill="none"
                  stroke={serie.color}
                  strokeWidth={2.5}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              )}
              {points.map((p, index) =>
                pointCount <= 31 ? (
                  <circle key={`dot-${serie.name}-${index}`} cx={p.x} cy={p.y} r={3} fill={serie.color} />
                ) : null
              )}
            </g>
          );
        })}

        {/* Etiquetas del eje X */}
        {labels.map((label, index) =>
          index % labelStep === 0 || index === pointCount - 1 ? (
            <text
              key={`xlabel-${index}`}
              x={xAt(index)}
              y={height - 8}
              textAnchor="middle"
              className="fill-gray-400 dark:fill-gray-500"
              style={{ fontSize: 10, fontWeight: 600 }}
            >
              {label}
            </text>
          ) : null
        )}
      </svg>

      {showLegend && (
        <div className="flex flex-wrap items-center justify-center gap-4 mt-2">
          {safeSeries.map((serie) => (
            <span key={`legend-${serie.name}`} className="inline-flex items-center gap-2 text-xs">
              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: serie.color }} />
              <span className="text-gray-600 dark:text-gray-300 font-semibold">{serie.name}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

export default TrendChart;
