import React from 'react';
import { safeText } from '../../utils/safeText';

export interface FieldProps {
  /** Etiqueta visible del campo. */
  label?: React.ReactNode;
  /** Id del control asociado (para asociar label + control). */
  htmlFor?: string;
  /** Mensaje de error a mostrar (oculta el hint y pinta el aviso). */
  error?: React.ReactNode;
  /** Texto de ayuda bajo el control. */
  hint?: React.ReactNode;
  /** Marca el campo como obligatorio (agrega asterisco). */
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}

/**
 * Envoltorio de campo de formulario: label + control + hint/error.
 * Estandariza el espaciado y la presentación de ayudas y validaciones.
 */
export const Field: React.FC<FieldProps> = ({
  label,
  htmlFor,
  error,
  hint,
  required = false,
  className = '',
  children,
}) => {
  const errorText = error ? safeText(error) : '';
  const hintText = hint ? safeText(hint) : '';
  const hasError = Boolean(errorText);

  return (
    <div className={`space-y-1.5 ${className}`}>
      {label && (
        <label
          htmlFor={htmlFor}
          className="block text-xs font-semibold text-gray-700 dark:text-gray-300"
        >
          {safeText(label)}
          {required && <span className="ml-0.5 text-red-500">*</span>}
        </label>
      )}

      {children}

      {hintText && !hasError && (
        <p className="text-[11px] text-gray-500 dark:text-gray-400">{hintText}</p>
      )}

      {hasError && (
        <p role="alert" className="text-[11px] font-medium text-red-600 dark:text-red-400">
          {errorText}
        </p>
      )}
    </div>
  );
};
