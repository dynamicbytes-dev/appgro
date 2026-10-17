import React, { forwardRef } from 'react';
import { isAllowedPhoneKey, sanitizePhone } from '../../utils/inputGuards';

export type PhoneInputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'>;

/**
 * Drop-in replacement for `<input type="tel" />` that only accepts digits and
 * the usual phone separators (`+`, `-`, `(`, `)`, space), blocking letters.
 */
export const PhoneInput = forwardRef<HTMLInputElement, PhoneInputProps>(function PhoneInput(
  { onKeyDown, onPaste, ...rest },
  ref
) {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    onKeyDown?.(e);
    if (e.defaultPrevented) return;
    if (!isAllowedPhoneKey(e)) {
      e.preventDefault();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    onPaste?.(e);
    if (e.defaultPrevented) return;
    const pasted = e.clipboardData.getData('text');
    if (sanitizePhone(pasted) !== pasted) {
      e.preventDefault();
    }
  };

  return (
    <input
      ref={ref}
      type="tel"
      inputMode="tel"
      onKeyDown={handleKeyDown}
      onPaste={handlePaste}
      {...rest}
    />
  );
});
