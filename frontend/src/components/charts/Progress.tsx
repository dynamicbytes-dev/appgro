import React from 'react';

interface ProgressProps {
  /** Valor 0–100. Se satura al rango válido. */
  value: number;
  /** Color de la barra (hex o clase de Tailwind). Por defecto verde corporativo. */
  color?: string;
  /** Clase de la pista (fondo). */
  trackClassName?: string;
  /** Altura de la barra en píxeles. */
  height?: number;
  /** Etiqueta opcional a la izquierda. */
  label?: React.ReactNode;
  /** Etiqueta/valor opcional a la derecha. */
  valueLabel?: React.ReactNode;
  className?: string;
}

/**
 * Barra de progreso accesible sin dependencias externas.
 *
 * Se usa para representar ocupaciones, porcentajes de avance y
 * comparativas de costo/ingreso dentro de las tablas de analítica.
 */
export const Progress: React.FC<ProgressProps> = ({
  value,
  color = '#4E9F3D',
  trackClassName = 'bg-gray-100 dark:bg-[#263632]',
  height = 8,
  label,
  valueLabel,
  className = '',
}) => {
  const safe = Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0;

  return (
    <div className={`w-full ${className}`}>
      {(label !== undefined || valueLabel !== undefined) && (
        <div className="flex items-center justify-between gap-2 mb-1">
          <span className="text-xs font-semibold text-gray-600 dark:text-gray-300 truncate">
            {label}
          </span>
          <span className="text-xs font-bold text-gray-700 dark:text-gray-200 shrink-0">
            {valueLabel}
          </span>
        </div>
      )}
      <div
        className={`w-full rounded-full overflow-hidden ${trackClassName}`}
        style={{ height }}
        role="progressbar"
        aria-valuenow={Math.round(safe)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${safe}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
};

export default Progress;
