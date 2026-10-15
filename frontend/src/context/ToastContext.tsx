import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastMessage {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
}

interface ToastContextType {
  showToast: (type: ToastType, title: string, description?: string) => void;
  toastSuccess: (title: string, description?: string) => void;
  toastError: (title: string, description?: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback((type: ToastType, title: string, description?: string) => {
    const id = `toast-${Date.now()}-${Math.random()}`;
    const newToast: ToastMessage = { id, type, title, description };
    setToasts((prev) => [...prev, newToast]);

    setTimeout(() => {
      removeToast(id);
    }, 4000);
  }, [removeToast]);

  const toastSuccess = useCallback((title: string, description?: string) => {
    showToast('success', title, description);
  }, [showToast]);

  const toastError = useCallback((title: string, description?: string) => {
    showToast('error', title, description);
  }, [showToast]);

  return (
    <ToastContext.Provider value={{ showToast, toastSuccess, toastError }}>
      {children}
      
      {/* Toast Notification Container: z-[9999] flota por encima de los modales (z-50) */}
      <div className="fixed bottom-5 right-5 z-[9999] flex flex-col space-y-2 max-w-sm w-full pointer-events-none">
        {(toasts || []).map((t) => (
          <div
            key={`toast-${t.id}`}
            className={`pointer-events-auto p-4 rounded-2xl shadow-xl border flex items-start justify-between gap-3 transform transition-all duration-300 animate-in slide-in-from-bottom-5 ${
              t.type === 'success'
                ? 'bg-[#1B4D3E] text-white border-[#4E9F3D]'
                : t.type === 'error'
                ? 'bg-red-900 text-white border-red-700'
                : t.type === 'warning'
                ? 'bg-amber-900 text-white border-amber-700'
                : 'bg-gray-900 text-white border-gray-700'
            }`}
          >
            <div className="flex items-start gap-3">
              {t.type === 'success' && <CheckCircle2 className="w-5 h-5 text-[#6DBF5C] shrink-0 mt-0.5" />}
              {t.type === 'error' && <XCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />}
              {t.type === 'warning' && <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />}
              {t.type === 'info' && <Info className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />}

              <div>
                <h4 className="font-bold text-xs tracking-wide">{t.title}</h4>
                {t.description && <p className="text-[11px] opacity-90 mt-0.5">{t.description}</p>}
              </div>
            </div>

            <button
              onClick={() => removeToast(t.id)}
              className="p-1 rounded-lg hover:bg-white/10 opacity-70 hover:opacity-100 transition-opacity"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
