import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { ZootikaLogo } from './ZootikaLogo';

interface Props {
  children?: ReactNode;
  fallback?: ReactNode;
  onReset?: () => void;
  resetKey?: string | number;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in ErrorBoundary:', error, errorInfo);
    this.setState({
      error,
      errorInfo,
    });
  }

  public componentDidUpdate(prevProps: Props) {
    // Automatically reset error boundary if resetKey (e.g. route path) changes
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.handleReset();
    }
  }

  public handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  public handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-[400px] flex items-center justify-center bg-[#F9F9F9] dark:bg-[#0F1715] p-6 rounded-3xl animate-in fade-in duration-200">
          <div className="max-w-md w-full bg-white dark:bg-[#18221F] rounded-3xl p-8 shadow-xl border border-gray-200 dark:border-[#263632] text-center">
            {/* Brand Header */}
            <div className="flex justify-center mb-5">
              <ZootikaLogo size="sm" showText={true} textVariant="auto" />
            </div>

            {/* Header Icon */}
            <div className="w-14 h-14 bg-amber-50 dark:bg-amber-950/40 rounded-2xl flex items-center justify-center text-[#1B4D3E] dark:text-[#4E9F3D] mx-auto mb-4 border border-amber-200 dark:border-amber-900">
              <AlertTriangle className="w-7 h-7 text-[#1B4D3E] dark:text-[#4E9F3D]" />
            </div>

            {/* Title */}
            <h2 className="text-lg font-black text-[#1E1E1E] dark:text-white">
              Error de Renderizado Interceptado
            </h2>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-2 leading-relaxed">
              Ocurrió una inconsistencia visual o de sincronización DOM. Los datos de tu sesión están protegidos.
            </p>

            {/* Error Stack Detail */}
            {this.state.error && (
              <div className="mt-4 p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-xl text-left text-[11px] font-mono text-red-800 dark:text-red-300 max-h-28 overflow-y-auto">
                <span className="font-bold block mb-0.5">Detalle técnico:</span>
                {this.state.error.message || 'Node execution DOM error'}
              </div>
            )}

            {/* Action Buttons */}
            <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-2.5">
              <button
                type="button"
                onClick={this.handleReset}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#1B4D3E] text-white text-xs font-bold rounded-xl hover:bg-[#143A2F] transition-all shadow-md cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Reintentar Vista
              </button>

              <button
                type="button"
                onClick={this.handleReload}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-100 dark:bg-[#263632] text-gray-700 dark:text-gray-200 text-xs font-bold rounded-xl hover:bg-gray-200 dark:hover:bg-[#30443f] transition-all cursor-pointer"
              >
                Recargar Página
              </button>

              <a
                href="/dashboard"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 border border-gray-200 dark:border-[#263632] text-gray-600 dark:text-gray-400 text-xs font-bold rounded-xl hover:bg-gray-50 dark:hover:bg-[#18221F] transition-all"
              >
                <Home className="w-3.5 h-3.5" />
                Inicio
              </a>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
