import React from 'react';
import { Card } from '../../components/ui/Card';

interface KpiCardProps {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  hint?: string;
  /** Clase de color del icono. */
  color?: string;
  /** Clase de fondo del contenedor del icono. */
  bg?: string;
}

/**
 * Tarjeta de indicador (KPI) reutilizable en las pestañas de Analítica.
 */
export const KpiCard: React.FC<KpiCardProps> = ({
  label,
  value,
  icon: Icon,
  hint,
  color = 'text-[#1B4D3E] dark:text-[#6DBF5C]',
  bg = 'bg-[#1B4D3E]/10',
}) => (
  <Card className="p-4!">
    <div className="flex items-start gap-3">
      <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center shrink-0`}>
        <Icon className={`w-5 h-5 ${color}`} />
      </div>
      <div className="min-w-0">
        <p className="text-lg font-extrabold text-[#1E1E1E] dark:text-gray-100 truncate">{value}</p>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
          {label}
        </p>
        {hint ? (
          <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5 truncate">{hint}</p>
        ) : null}
      </div>
    </div>
  </Card>
);

export default KpiCard;
