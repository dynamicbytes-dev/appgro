import React, { forwardRef } from 'react';
import { isAllowedNumberKey, sanitizeNumber } from '../../utils/inputGuards';

export interface NumberInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  /**
   * Allow a single decimal separator (`.`).
   * When omitted it is inferred from `step`: a fractional step such as `"0.01"`
   * enables decimals, while a whole-number step such as `"1"` keeps it
   * integer-only.
   */
  allowDecimal?: boolean;
  /** Allow a leading minus sign for negative values. Defaults to false. */
  allowNegative?: boolean;
}

/**
 * Drop-in replacement for `<input type="number" />` that blocks letters and
 * other invalid characters while keeping native `min`/`max`/`step`/`required`
 * validation and the browser spinners.
 */
export const NumberInput = forwardRef<HTMLInputElement, NumberInputProps>(function NumberInput(
  { allowDecimal, allowNegative = false, step, onKeyDown, onPaste, ...rest },
  ref
) {
  const decimalsAllowed =
    allowDecimal ?? (step === undefined || step === 'any' || String(step).includes('.'));

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    onKeyDown?.(e);
    if (e.defaultPrevented) return;
    if (!isAllowedNumberKey(e, { decimal: decimalsAllowed, negative: allowNegative })) {
      e.preventDefault();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    onPaste?.(e);
    if (e.defaultPrevented) return;
    const pasted = e.clipboardData.getData('text');
    if (sanitizeNumber(pasted, { decimal: decimalsAllowed, negative: allowNegative }) !== pasted) {
      e.preventDefault();
    }
  };

  return (
    <input
      ref={ref}
      type="number"
      step={step}
      onKeyDown={handleKeyDown}
      onPaste={handlePaste}
      {...rest}
    />
  );
});
