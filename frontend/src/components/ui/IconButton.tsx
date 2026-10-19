import React from 'react';

export interface IconButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Etiqueta accesible obligatoria (aria-label) y tooltip nativo. */
  label: string;
  variant?: 'default' | 'danger' | 'brand' | 'ghost';
  size?: 'sm' | 'md';
}

const VARIANT_STYLES = {
  default:
    'text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-line-dark dark:hover:text-gray-200',
  danger:
    'text-red-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10 dark:hover:text-red-400',
  brand:
    'text-brand hover:bg-brand/10 hover:text-brand-hover dark:text-accent dark:hover:bg-accent/10',
  ghost:
    'text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-line-dark dark:hover:text-gray-200',
};

const SIZE_STYLES = {
  sm: 'h-7 w-7',
  md: 'h-9 w-9',
};

/**
 * Botón de sólo icono con etiqueta accesible y estados de hover consistentes.
 */
export const IconButton: React.FC<IconButtonProps> = ({
  label,
  variant = 'default',
  size = 'sm',
  className = '',
  children,
  type = 'button',
  ...props
}) => (
  <button
    type={type}
    aria-label={label}
    title={label}
    className={`inline-flex items-center justify-center rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-accent/40 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer ${SIZE_STYLES[size]} ${VARIANT_STYLES[variant]} ${className}`}
    {...props}
  >
    {children}
  </button>
);
