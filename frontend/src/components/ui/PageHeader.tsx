import React from 'react';

export interface PageHeaderProps {
  /** Ícono (lucide) que se muestra dentro del cuadro redondeado a la izquierda. */
  icon?: React.ReactNode;
  /** Texto del badge superior (granja, ámbito, rol, etc.). */
  badge?: React.ReactNode;
  /** Ícono opcional que acompaña al badge. */
  badgeIcon?: React.ReactNode;
  /** Título principal del encabezado. */
  title: React.ReactNode;
  /** Descripción corta bajo el título. */
  subtitle?: React.ReactNode;
  /** Botones/acciones alineados a la derecha (también puede usarse `children`). */
  actions?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}

/**
 * Encabezado estándar de los módulos: única estructura y tipografía
 * (título `text-xl font-black`, subtítulo `text-xs`) para toda la app.
 */
export const PageHeader: React.FC<PageHeaderProps> = ({
  icon,
  badge,
  badgeIcon,
  title,
  subtitle,
  actions,
  className = '',
  children,
}) => {
  const rightContent = actions ?? children;
  return (
    <div
      className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-[#18221F] p-6 rounded-2xl border border-gray-200 dark:border-[#263632] shadow-sm ${className}`}
    >
      <div className="flex items-center gap-3 min-w-0">
        {icon && (
          <div className="w-10 h-10 rounded-xl bg-[#1B4D3E]/10 dark:bg-[#4E9F3D]/20 text-[#1B4D3E] dark:text-[#4E9F3D] flex items-center justify-center shrink-0">
            {icon}
          </div>
        )}
        <div className="min-w-0">
          {badge && (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#4E9F3D]/10 text-[#4E9F3D] text-[11px] font-bold mb-1.5 border border-[#4E9F3D]/20">
              {badgeIcon}
              <span>{badge}</span>
            </div>
          )}
          <h1 className="text-xl font-black text-[#1E1E1E] dark:text-gray-100 flex items-center gap-2 flex-wrap">
            {title}
          </h1>
          {subtitle && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {subtitle}
            </p>
          )}
        </div>
      </div>

      {rightContent && (
        <div className="flex items-center gap-2 flex-wrap">{rightContent}</div>
      )}
    </div>
  );
};

export default PageHeader;
