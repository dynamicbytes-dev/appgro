import React, { forwardRef } from 'react';

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  /** Pinta el borde en rojo y marca aria-invalid. */
  invalid?: boolean;
}

/**
 * Select estandarizado. Aplana las opciones vía `children` (los `<option>`).
 */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className = '', invalid = false, children, ...props }, ref) => {
    const border = invalid
      ? 'border-red-400 dark:border-red-500/60'
      : 'border-gray-300 dark:border-line-dark';

    return (
      <select
        ref={ref}
        aria-invalid={invalid || undefined}
        className={`w-full rounded-xl border bg-surface dark:bg-surface-dark px-3 py-2 text-sm text-gray-900 dark:text-gray-100 transition-colors focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40 disabled:cursor-not-allowed disabled:opacity-60 ${border} ${className}`}
        {...props}
      >
        {children}
      </select>
    );
  }
);

Select.displayName = 'Select';
