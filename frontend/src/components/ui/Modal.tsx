import React, { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import { X } from 'lucide-react';
import { renderSafe, safeText } from '../../utils/safeText';

type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  /** Ancho máximo del panel. */
  maxWidth?: ModalSize;
  /** Alias de `maxWidth` (se prefiere `size` en código nuevo). */
  size?: ModalSize;
  /** Pie fijo del modal (acciones). */
  footer?: ReactNode;
  /** Clases extra para el cuerpo con scroll. */
  bodyClassName?: string;
  /** Cerrar al hacer clic en el overlay (por defecto sí). */
  closeOnOverlay?: boolean;
  /** Etiqueta accesible cuando no hay `title`. */
  ariaLabel?: string;
  destroyOnClose?: boolean;
  /** Elevación del overlay (por defecto 50). Permite apilar modales
   *  de forma determinista sin depender del orden de los portales. */
  zIndex?: number;
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  maxWidth,
  size,
  footer,
  bodyClassName = '',
  closeOnOverlay = true,
  ariaLabel,
  destroyOnClose = true,
  zIndex = 50,
}) => {
  const resolvedSize: ModalSize = size ?? maxWidth ?? 'lg';
  const location = useLocation();
  const instanceId = useId().replace(/:/g, '');
  const titleId = `agro-modal-title-${instanceId}`;
  const containerRef = useRef<HTMLElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  // `onClose` suele pasarse inline (nueva identidad en cada render). Se guarda
  // en un ref para que los efectos dependan solo de `isOpen` y NO se re-ejecuten
  // en cada tecla (eso robaba el foco y lo llevaba al botón de cerrar).
  const onCloseRef = useRef(onClose);
  const isOpenRef = useRef(isOpen);
  // Sincroniza las refs tras cada render: evita leer refs durante el render y
  // permite que los efectos dependan solo de lo que realmente cambia.
  useEffect(() => {
    onCloseRef.current = onClose;
    isOpenRef.current = isOpen;
  });
  const [container, setContainer] = useState<HTMLElement | null>(null);
  // Smooth open/close: keeps the modal mounted while the exit transition plays
  const [shouldRender, setShouldRender] = useState(isOpen);
  const [visible, setVisible] = useState(false);

  // Contenedor portal PROPIO de cada instancia del modal.
  // Evita que modales apilados compartan el mismo nodo padre en el DOM: al
  // desmontarse uno, React nunca puede confundir nodos hermanos (error típico
  // "Failed to execute 'removeChild' on 'Node'").
  useEffect(() => {
    const el = document.createElement('div');
    el.id = `agro-modal-root-${instanceId}`;
    document.body.appendChild(el);
    containerRef.current = el;
    setContainer(el);
    return () => {
      containerRef.current = null;
      if (el.parentNode) {
        el.parentNode.removeChild(el);
      }
    };
  }, [instanceId]);

  // Open/Close transition orchestration
  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      // Double rAF guarantees the CSS transition runs after the first paint
      const raf = requestAnimationFrame(() => {
        requestAnimationFrame(() => setVisible(true));
      });
      return () => cancelAnimationFrame(raf);
    }

    setVisible(false);
    if (!destroyOnClose) {
      setShouldRender(false);
      return;
    }
    const timer = setTimeout(() => setShouldRender(false), 200);
    return () => clearTimeout(timer);
  }, [isOpen, destroyOnClose]);

  // 1. Route Change Cleanup: Automatically close modal and unmount on navigation
  useEffect(() => {
    if (isOpenRef.current) {
      onCloseRef.current();
    }
  }, [location.pathname]);

  // 2. Escape + bloqueo de scroll.
  //    Depende SOLO de `isOpen`: reutiliza `onCloseRef` para no re-ejecutarse en
  //    cada render (la causa del foco saltando al botón de cerrar al escribir).
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCloseRef.current();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  // 3. Foco inicial + focus trap.
  //    Se ejecuta UNA sola vez al abrir y restaura el foco al cerrar.
  useEffect(() => {
    if (!isOpen) return;

    previouslyFocused.current = (document.activeElement as HTMLElement) ?? null;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || !panelRef.current) return;

      // Focus trap: mantiene el foco dentro del panel mientras está abierto.
      const focusable = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      ).filter((el) => el.offsetParent !== null || el === panelRef.current);

      if (focusable.length === 0) {
        e.preventDefault();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (e.shiftKey && (active === first || !panelRef.current.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    // Foco inicial: `[data-autofocus]` → primer campo del cuerpo → panel.
    // Nunca el botón de cerrar (cabecera), que es el primer focusable del DOM.
    const focusTimer = setTimeout(() => {
      const root = panelRef.current;
      if (!root) return;

      const explicit = root.querySelector<HTMLElement>('[data-autofocus]');
      const firstField = bodyRef.current?.querySelector<HTMLElement>(
        'input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled])'
      );
      (explicit ?? firstField ?? root).focus();
    }, 0);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      clearTimeout(focusTimer);
      previouslyFocused.current?.focus?.();
    };
  }, [isOpen]);

  // Unmount only after the close transition finishes playing
  if (!shouldRender || !container) {
    return null;
  }

  const widthClasses: Record<ModalSize, string> = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    '3xl': 'max-w-3xl',
    '4xl': 'max-w-4xl',
  };

  const titleText = title ? safeText(title) : '';
  const subtitleText = subtitle ? safeText(subtitle) : '';

  const modalContent = (
    <div
      translate="no"
      className={`fixed inset-0 overflow-y-auto flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-xs transition-opacity duration-200 ${
        visible ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}
      style={{ zIndex }}
      onClick={(e) => {
        if (closeOnOverlay && e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleText ? titleId : undefined}
        aria-label={!titleText ? ariaLabel : undefined}
        tabIndex={-1}
        className={`bg-surface dark:bg-[#18221F] rounded-2xl border border-gray-200 dark:border-line-dark shadow-2xl w-full ${widthClasses[resolvedSize]} flex flex-col max-h-[calc(100vh-2rem)] sm:max-h-[calc(100vh-3rem)] overflow-hidden transform transition-all duration-200 outline-none ${
          visible ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="shrink-0 bg-brand text-white px-6 py-4 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h3 id={titleId} className="text-lg font-bold tracking-tight text-white">
              {renderSafe(title)}
            </h3>
            {subtitleText && (
              <p className="text-xs text-emerald-200 mt-0.5">{subtitleText}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar modal"
            className="shrink-0 p-1 rounded-lg hover:bg-brand-hover text-emerald-200 hover:text-white transition-colors cursor-pointer"
            title="Cerrar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div ref={bodyRef} className={`p-6 overflow-y-auto min-h-0 ${bodyClassName}`}>
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="shrink-0 border-t border-gray-100 dark:border-line-dark px-6 py-4 bg-surface dark:bg-[#18221F]">
            {footer}
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(modalContent, container);
};
