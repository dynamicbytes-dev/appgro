import React, { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import { X } from 'lucide-react';
import { safeText } from '../../utils/safeText';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: any;
  subtitle?: any;
  children: ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  destroyOnClose?: boolean;
}

const getOrCreatePortalContainer = (): HTMLElement => {
  let root = document.getElementById('agro-modal-root');
  if (!root) {
    root = document.createElement('div');
    root.id = 'agro-modal-root';
    document.body.appendChild(root);
  }
  return root;
};

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  maxWidth = 'lg',
  destroyOnClose = true,
}) => {
  const location = useLocation();
  const [container, setContainer] = useState<HTMLElement | null>(null);
  // Smooth open/close: keeps the modal mounted while the exit transition plays
  const [shouldRender, setShouldRender] = useState(isOpen);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setContainer(getOrCreatePortalContainer());
  }, []);

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
    if (isOpen) {
      onClose();
    }
  }, [location.pathname]);

  // 2. Escape Key Listener & Body Scroll Lock Cleanup
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen, onClose]);

  // Unmount only after the close transition finishes playing
  if (!shouldRender || !container) {
    return null;
  }

  const widthClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
  };

  const modalContent = (
    <div
      className={`fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-xs transition-opacity duration-200 ${
        visible ? 'opacity-100' : 'opacity-0'
      }`}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className={`bg-white dark:bg-[#18221F] rounded-2xl border border-gray-200 dark:border-[#263632] shadow-2xl w-full ${widthClasses[maxWidth]} overflow-hidden transform transition-all duration-200 my-8 ${
          visible ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-[#1B4D3E] text-white px-6 py-4 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold tracking-tight text-white">{safeText(title)}</h3>
            {subtitle && <p className="text-xs text-emerald-200 mt-0.5">{safeText(subtitle)}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-[#143A2F] text-emerald-200 hover:text-white transition-colors cursor-pointer"
            title="Cerrar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6">{children}</div>
      </div>
    </div>
  );

  return createPortal(modalContent, container);
};
