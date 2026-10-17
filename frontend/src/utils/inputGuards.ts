import type React from 'react';

/**
 * Shared keyboard/paste guards used by the numeric and phone inputs to prevent
 * users from typing characters that do not belong in the field.
 *
 * Native `type="number"` inputs still accept `e`, `E`, `+`, `-` and `.` in most
 * browsers (and even letters in Firefox / some mobile keyboards), so the guards
 * below centralise the filtering logic instead of repeating it across the app.
 */

export interface NumericGuardOptions {
  /** Allow a single decimal separator (`.`). Defaults to true. */
  decimal?: boolean;
  /** Allow a leading minus sign. Defaults to false. */
  negative?: boolean;
}

/** Keys that must always be allowed so the user can navigate and edit the field. */
const CONTROL_KEYS = new Set([
  'Backspace',
  'Delete',
  'Tab',
  'Escape',
  'Enter',
  'ArrowLeft',
  'ArrowRight',
  'ArrowUp',
  'ArrowDown',
  'Home',
  'End',
]);

const DIGIT = /^[0-9]$/;

/**
 * Returns `true` when a `keydown` event should be allowed in a numeric field.
 * Everything that is not a digit (or an explicitly allowed symbol) is blocked.
 */
export function isAllowedNumberKey(
  e: React.KeyboardEvent<HTMLInputElement>,
  { decimal = true, negative = false }: NumericGuardOptions = {}
): boolean {
  // Always allow shortcuts (copy, paste, select all, undo, …) and editing keys.
  if (e.ctrlKey || e.metaKey || e.altKey) return true;
  if (CONTROL_KEYS.has(e.key)) return true;

  // Single digit
  if (DIGIT.test(e.key)) return true;

  // A single decimal separator, only when decimals are allowed.
  if (decimal && e.key === '.') {
    return !e.currentTarget.value.includes('.');
  }

  // A leading minus sign, only when negatives are allowed.
  if (negative && e.key === '-') {
    const { selectionStart, selectionEnd, value } = e.currentTarget;
    return selectionStart === 0 && selectionEnd === 0 && !value.startsWith('-');
  }

  return false;
}

/**
 * Removes every character that is not valid for a numeric field. Used to
 * sanitise pasted content before it reaches the input.
 */
export function sanitizeNumber(
  value: string,
  { decimal = true, negative = false }: NumericGuardOptions = {}
): string {
  let sanitized = value.replace(decimal ? /[^0-9.]/g : /[^0-9]/g, '');

  if (decimal) {
    // Keep only the first decimal separator.
    const firstDot = sanitized.indexOf('.');
    if (firstDot !== -1) {
      sanitized =
        sanitized.slice(0, firstDot + 1) + sanitized.slice(firstDot + 1).replace(/\./g, '');
    }
  }

  if (negative && value.trim().startsWith('-')) {
    sanitized = `-${sanitized}`;
  }

  return sanitized;
}

/** Characters allowed in the phone fields: digits and common separators. */
const PHONE_ALLOWED = /[^0-9+\-() ]/g;

/** Returns `true` when a `keydown` event should be allowed in a phone field. */
export function isAllowedPhoneKey(e: React.KeyboardEvent<HTMLInputElement>): boolean {
  if (e.ctrlKey || e.metaKey || e.altKey) return true;
  if (CONTROL_KEYS.has(e.key)) return true;
  if (DIGIT.test(e.key)) return true;
  return ['+', '-', '(', ')', ' '].includes(e.key);
}

/** Removes every character that is not valid for a phone field. */
export function sanitizePhone(value: string): string {
  return value.replace(PHONE_ALLOWED, '');
}
