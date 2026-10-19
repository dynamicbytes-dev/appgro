import React, { forwardRef } from 'react';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  /** Pinta el borde en rojo y marca aria-invalid. */
  invalid?: boolean;
}

/**
 * Textarea estandarizado (borde, foco, dark mode y estado de error).
 */
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className = '', invalid = false, rows = 3, ...props }, ref) => {
    const border = invalid
      ? 'border-red-400 dark:border-red-500/60'
      : 'border-gray-300 dark:border-line-dark';

    return (
      <textarea
        ref={ref}
        rows={rows}
        aria-invalid={invalid || undefined}
        className={`w-full rounded-xl border bg-surface dark:bg-surface-dark px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 transition-colors focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40 disabled:cursor-not-allowed disabled:opacity-60 ${border} ${className}`}
        {...props}
      />
    );
  }
);

Textarea.displayName = 'Textarea';
