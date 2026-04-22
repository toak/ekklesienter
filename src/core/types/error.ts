/**
 * Interface for application error logs stored in Dexie.
 */
export interface IErrorLog {
    id: string; // UUID
    message: string;
    stack?: string;
    componentStack?: string;
    url: string;
    userAgent: string;
    timestamp: number;
    severity: 'error' | 'warning' | 'fatal';
    metadata?: Record<string, unknown>;
}
