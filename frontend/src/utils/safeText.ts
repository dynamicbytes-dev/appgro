import React from 'react';

/**
 * Safely converts any value to a primitive string, preventing objects from being
 * rendered as React child nodes which causes Virtual DOM crashes and "removeChild" exceptions.
 *
 * @param val The value to safely render.
 * @param fallback Optional fallback if val is null, undefined, or empty.
 * @returns A guaranteed primitive string.
 */
export function safeText(val: any, fallback: string = ''): string {
  if (val === null || val === undefined) {
    return fallback;
  }

  // Already a primitive string
  if (typeof val === 'string') {
    return val;
  }

  // Primitive numbers
  if (typeof val === 'number') {
    return isNaN(val) ? fallback : String(val);
  }

  // Booleans
  if (typeof val === 'boolean') {
    return val ? 'true' : 'false';
  }

  // If val is an object or array, extract sensible text property instead of crashing React DOM
  if (typeof val === 'object') {
    if (Array.isArray(val)) {
      if (val.length === 0) return fallback;
      return val.map((item) => safeText(item, '')).filter(Boolean).join(', ') || fallback;
    }

    if (typeof val.name === 'string') return val.name;
    if (typeof val.label === 'string') return val.label;
    if (typeof val.title === 'string') return val.title;
    if (typeof val.code === 'string') return val.code;
    if (typeof val.slug === 'string') return val.slug;
    if (typeof val.value === 'string' || typeof val.value === 'number') return String(val.value);
    if (typeof val.message === 'string') return val.message;
    if (typeof val.description === 'string') return val.description;

    return fallback;
  }

  return String(val);
}

export const safeString = safeText;

/**
 * Robust Text component wrapper that sanitizes its children before rendering,
 * guaranteeing no raw object is ever passed into React's Text Fiber node.
 */
interface TextProps extends React.HTMLAttributes<HTMLElement> {
  children?: any;
  as?: 'span' | 'p' | 'div' | 'h1' | 'h2' | 'h3' | 'h4' | 'label';
  fallback?: string;
  className?: string;
}

export const Text: React.FC<TextProps> = ({
  children,
  as: Component = 'span',
  fallback = '',
  className = '',
  ...props
}) => {
  const content = safeText(children, fallback);
  return React.createElement(Component, { className, ...props }, content);
};

export default Text;
