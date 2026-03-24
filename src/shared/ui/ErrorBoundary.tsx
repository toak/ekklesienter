import React, { Component, ErrorInfo, ReactNode } from 'react';
import { ErrorLogger } from '@/core/services/ErrorLogger';
import { AlertCircle, RefreshCcw, Copy, Check } from 'lucide-react';
import { cn } from '@/core/utils/cn';

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    errorId: string | null;
    copied: boolean;
}

/**
 * Global Error Boundary following Rule 6.5.
 * Provides a "Black Box" crash screen for production safety.
 */
export class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        errorId: null,
        copied: false,
    };

    public static getDerivedStateFromError(_: Error): State {
        return { hasError: true, errorId: null, copied: false };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        ErrorLogger.logError({
            message: error.message,
            stack: errorInfo.componentStack || error.stack,
            url: window.location.href,
        }).then((id) => {
            this.setState({ errorId: id });
        });
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
            return (
                <div className="fixed inset-0 z-9999 flex items-center justify-center bg-stone-950 p-6 font-sans text-white">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,100,0,0.05)_0%,transparent_70%)]" />

                    <div className="w-full max-w-md relative bg-stone-900/50 backdrop-blur-3xl border border-white/5 p-8 rounded-[2.5rem] shadow-2xl text-center flex flex-col items-center">
                        <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center border border-red-500/20 mb-6">
                            <AlertCircle className="w-8 h-8 text-red-500" />
                        </div>

                        <h1 className="text-2xl font-black tracking-tight mb-2">
                            Something went wrong
                        </h1>
                        <p className="text-stone-400 text-sm mb-8 px-4">
                            Please send this ID to support if the issue persists.
                        </p>

                        <div className="w-full space-y-3">
                            <button
                                type="button"
                                onClick={this.handleCopyId}
                                disabled={!this.state.errorId}
                                className={cn(
                                    "w-full flex items-center justify-center gap-3 py-4 rounded-2xl border transition-all active:scale-[0.98] font-bold group",
                                    this.state.errorId
                                        ? "bg-white/5 border-white/10 hover:bg-white/10 cursor-pointer"
                                        : "bg-white/2 border-white/2 cursor-wait opacity-50"
                                )}
                            >
                                {this.state.copied ? (
                                    <>
                                        <Check className="w-4 h-4 text-green-500" />
                                        <span className="text-green-500">Copied!</span>
                                    </>
                                ) : (
                                    <>
                                        <Copy className="w-4 h-4 text-stone-500 group-hover:text-stone-300 transition-colors" />
                                        <span>{this.state.errorId ? "Copy Error ID" : "Logging Error..."}</span>
                                    </>
                                )}
                            </button>

                            <button
                                type="button"
                                onClick={this.handleReload}
                                className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl bg-orange-500 hover:bg-orange-400 text-black transition-all active:scale-[0.98] font-bold cursor-pointer"
                            >
                                <RefreshCcw className="w-4 h-4" />
                                <span>Reload Page</span>
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
