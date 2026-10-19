import React, { forwardRef } from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** Pinta el borde en rojo y marca aria-invalid. */
  invalid?: boolean;
  /** Ícono decorativo alineado a la izquierda. */
  leftIcon?: React.ReactNode;
}

/**
 * Input de texto estandarizado (borde, foco, dark mode y estado de error).
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className = '', invalid = false, leftIcon, ...props }, ref) => {
    const border = invalid
      ? 'border-red-400 dark:border-red-500/60'
      : 'border-gray-300 dark:border-line-dark';

    return (
      <div className="relative">
        {leftIcon && (
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-gray-400">
            {leftIcon}
          </span>
        )}
        <input
          ref={ref}
          aria-invalid={invalid || undefined}
          className={`w-full rounded-xl border bg-surface dark:bg-surface-dark px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 transition-colors focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40 disabled:cursor-not-allowed disabled:opacity-60 ${border} ${
            leftIcon ? 'pl-9' : ''
          } ${className}`}
          {...props}
        />
      </div>
    );
  }
);

Input.displayName = 'Input';
