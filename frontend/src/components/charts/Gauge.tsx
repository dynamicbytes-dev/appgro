import React from 'react';

interface GaugeProps {
  /** Porcentaje 0–100. */
  value: number;
  /** Tamaño del SVG en píxeles (ancho). */
  size?: number;
  /** Grosor del trazo. */
  thickness?: number;
  /** Color del arco de progreso. */
  color?: string;
  /** Texto central grande (por defecto el porcentaje). */
  centerValue?: string;
  /** Texto secundario bajo el valor central. */
  centerLabel?: string;
  className?: string;
}

/** Convierte un ángulo (0°=derecha, 90°=arriba) a coordenadas SVG. */
const polar = (cx: number, cy: number, r: number, angleDeg: number) => {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy - r * Math.sin(rad) };
};

/** Genera el `d` de un arco semicircular entre dos ángulos (grados). */
const arcPath = (cx: number, cy: number, r: number, startAngle: number, endAngle: number) => {
  const start = polar(cx, cy, r, startAngle);
  const end = polar(cx, cy, r, endAngle);
  const sweep = startAngle > endAngle ? 1 : 0;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 0 ${sweep} ${end.x} ${end.y}`;
};

/**
 * Medidor semicircular (0–100 %) dibujado con SVG puro.
 *
 * Pensado para la "ocupación global" del resumen ejecutivo: muestra la
 * capacidad utilizada de los galpones activos de un vistazo.
 */
export const Gauge: React.FC<GaugeProps> = ({
  value,
  size = 220,
  thickness = 18,
  color = '#4E9F3D',
  centerValue,
  centerLabel,
  className = '',
}) => {
  const safe = Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0;

  const width = size;
  const height = size / 2 + thickness;
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - thickness / 2;

  const startAngle = 180;
  const endAngle = 180 - (safe / 100) * 180;

  const track = arcPath(cx, cy, r, 180, 0);
  const progress = safe > 0 ? arcPath(cx, cy, r, startAngle, endAngle) : '';

  return (
    <div className={`flex flex-col items-center ${className}`}>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${Math.round(safe)}%`}>
        <path
          d={track}
          fill="none"
          stroke="currentColor"
          className="text-gray-200 dark:text-[#263632]"
          strokeWidth={thickness}
          strokeLinecap="round"
        />
        {progress && (
          <path
            d={progress}
            fill="none"
            stroke={color}
            strokeWidth={thickness}
            strokeLinecap="round"
          />
        )}
        <text
          x={cx}
          y={cy - 6}
          textAnchor="middle"
          className="fill-[#1E1E1E] dark:fill-gray-100"
          style={{ fontSize: size * 0.2, fontWeight: 800 }}
        >
          {centerValue ?? `${Math.round(safe)}%`}
        </text>
        {centerLabel && (
          <text
            x={cx}
            y={cy + size * 0.08}
            textAnchor="middle"
            className="fill-gray-500 dark:fill-gray-400"
            style={{ fontSize: size * 0.07, fontWeight: 600 }}
          >
            {centerLabel}
          </text>
        )}
      </svg>
    </div>
  );
};

export default Gauge;
