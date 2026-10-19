import React from 'react';
import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react';
import { safeText } from '../../utils/safeText';

export type AlertVariant = 'info' | 'success' | 'warning' | 'error';

export interface AlertProps {
  variant?: AlertVariant;
  title?: React.ReactNode;
  children?: React.ReactNode;
  /** Acción a la derecha (p. ej. un botón). */
  action?: React.ReactNode;
  className?: string;
}

const VARIANT_STYLES: Record<
  AlertVariant,
  { wrap: string; icon: React.ReactNode; title: string }
> = {
  info: {
    wrap: 'border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-200',
    icon: <Info className="h-5 w-5 shrink-0" />,
    title: 'text-blue-900 dark:text-blue-100',
  },
  success: {
    wrap: 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200',
    icon: <CheckCircle2 className="h-5 w-5 shrink-0" />,
    title: 'text-emerald-900 dark:text-emerald-100',
  },
  warning: {
    wrap: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200',
    icon: <AlertTriangle className="h-5 w-5 shrink-0" />,
    title: 'text-amber-900 dark:text-amber-100',
  },
  error: {
    wrap: 'border-red-200 bg-red-50 text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200',
    icon: <XCircle className="h-5 w-5 shrink-0" />,
    title: 'text-red-900 dark:text-red-100',
  },
};

/**
 * Banner de aviso estandarizado (reemplaza los ~27 banners duplicados).
 */
export const Alert: React.FC<AlertProps> = ({
  variant = 'info',
  title,
  children,
  action,
  className = '',
}) => {
  const style = VARIANT_STYLES[variant];
  const titleText = title ? safeText(title) : '';
  const bodyText = children ? safeText(children) : '';

  return (
    <div
      role={variant === 'error' ? 'alert' : 'status'}
      className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm ${style.wrap} ${className}`}
    >
      <span className="mt-0.5">{style.icon}</span>
      <div className="min-w-0 flex-1">
        {titleText && <p className={`font-semibold ${style.title}`}>{titleText}</p>}
        {bodyText && <p className="mt-0.5 break-words opacity-90">{bodyText}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
};
