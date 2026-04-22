import React, { Component, ErrorInfo, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertCircle, RefreshCw, Copy, Check } from 'lucide-react';
import { ErrorLoggingService } from '@/core/services/errorLoggingService';
import { cn } from '@/core/utils/cn';
import i18n from '@/core/i18n';

interface Props {
  children?: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  errorId: string | null;
  copied: boolean;
}

/**
 * Global Error Boundary following Rule 8.5.
 * Provides a premium "Crash Screen" with error persistence in Dexie.
 */
export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    errorId: null,
    copied: false
  };

  public static getDerivedStateFromError(_: Error): State {
    return { hasError: true, errorId: null, copied: false };
  }

  public async componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const errorId = await ErrorLoggingService.logError(error, 'fatal', {
      componentStack: errorInfo.componentStack || undefined
    });
    this.setState({ errorId });
  }

  private handleCopyId = () => {
    if (this.state.errorId) {
      navigator.clipboard.writeText(this.state.errorId);
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 2000);
    }
  };

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="min-h-screen w-full flex items-center justify-center bg-[#0c0a09] p-6 selection:bg-accent/30 font-sans">
          <div className="max-w-md w-full animate-in fade-in zoom-in duration-500">
            <div className="relative group">
              {/* Outer Glow */}
              <div className="absolute -inset-1 bg-gradient-to-r from-red-500/20 to-orange-500/20 rounded-3xl blur-xl opacity-50 group-hover:opacity-100 transition duration-1000 group-hover:duration-200"></div>
              
              <div className="relative bg-stone-900/80 backdrop-blur-xl border border-white/5 p-8 rounded-3xl shadow-2xl overflow-hidden">
                {/* Decorative background element */}
                <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/2 w-32 h-32 bg-red-500/10 rounded-full blur-3xl"></div>
                
                <div className="flex flex-col items-center text-center space-y-6">
                  <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center border border-red-500/20 shadow-[0_0_20px_rgba(239,68,68,0.1)]">
                    <AlertCircle className="w-8 h-8 text-red-500 animate-pulse" />
                  </div>

                  <div className="space-y-2">
                    <h1 className="text-2xl font-bold text-white tracking-tight">
                      {i18n.t('error_title', 'Something went wrong')}
                    </h1>
                    <p className="text-stone-400 text-sm leading-relaxed">
                      {i18n.t('error_send_id', 'An unexpected error occurred. Please share the ID below with support so we can fix it.')}
                    </p>
                  </div>

                  <div className="w-full group/id relative">
                    <div className="bg-black/40 border border-white/5 rounded-2xl p-4 font-mono text-[10px] text-stone-500 break-all transition-colors group-hover/id:border-white/10 group-hover/id:bg-black/60 min-h-[50px] flex items-center justify-center">
                      {this.state.errorId || i18n.t('logging_error', 'Logging error...')}
                    </div>
                    {this.state.errorId && (
                       <button
                         onClick={this.handleCopyId}
                         className="absolute right-2 top-1/2 -translate-y-1/2 p-2 hover:bg-white/5 rounded-xl transition-all cursor-pointer group/btn"
                         title={i18n.t('copy_error_id', 'Copy Error ID')}
                       >
                         {this.state.copied ? (
                           <Check className="w-4 h-4 text-green-500" />
                         ) : (
                           <Copy className="w-4 h-4 text-stone-400 group-hover/btn:text-white transition-colors" />
                         )}
                       </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 w-full gap-3 pt-2">
                    <button
                      onClick={this.handleReload}
                      className="flex items-center justify-center gap-2 bg-white text-black hover:bg-stone-200 py-3 rounded-2xl text-sm font-bold transition-all active:scale-[0.98] cursor-pointer shadow-lg shadow-white/5"
                    >
                      <RefreshCw className="w-4 h-4" />
                      {i18n.t('reload_page', 'Reload Page')}
                    </button>
                  </div>
                </div>
              </div>
            </div>
            
            <p className="text-center mt-6 text-[10px] uppercase tracking-[0.2em] font-black text-stone-600">
              Ekklesienter Stability Engine
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
