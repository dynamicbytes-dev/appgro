import React from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from './Button';

export interface FormFooterProps {
  onCancel?: () => void;
  cancelLabel?: string;
  submitLabel?: string;
  /** Estado de carga: muestra spinner y deshabilita las acciones. */
  isLoading?: boolean;
  submitDisabled?: boolean;
  /** Tipo del botón principal (por defecto `submit`). */
  submitType?: 'submit' | 'button';
  /** Handler alterno cuando el botón principal no es `submit`. */
  onSubmit?: () => void;
  className?: string;
  /** Contenido adicional a la izquierda de los botones. */
  children?: React.ReactNode;
}

/**
 * Pie de formulario estandarizado: acciones cancelar/guardar con estado de carga.
 */
export const FormFooter: React.FC<FormFooterProps> = ({
  onCancel,
  cancelLabel = 'Cancelar',
  submitLabel = 'Guardar',
  isLoading = false,
  submitDisabled = false,
  submitType = 'submit',
  onSubmit,
  className = '',
  children,
}) => (
  <div
    className={`flex items-center justify-between gap-3 border-t border-gray-100 pt-4 dark:border-line-dark ${className}`}
  >
    <div className="min-w-0 text-xs text-gray-500 dark:text-gray-400">{children}</div>
    <div className="flex shrink-0 items-center gap-2">
      {onCancel && (
        <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
          {cancelLabel}
        </Button>
      )}
      <Button
        type={submitType}
        variant="primary"
        onClick={submitType === 'button' ? onSubmit : undefined}
        disabled={isLoading || submitDisabled}
      >
        {isLoading && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
        {submitLabel}
      </Button>
    </div>
  </div>
);
