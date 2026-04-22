import { db } from '../db';
import { IErrorLog } from '../types/error';

/**
 * Service for capturing and persisting application errors.
 * Complies with Rule 6.4 regarding centralized error logging.
 */
export const ErrorLoggingService = {
    /**
     * Logs an error to the database.
     * @returns The UUID of the created log entry.
     */
    async logError(
        error: Error, 
        severity: IErrorLog['severity'] = 'error',
        metadata?: Record<string, unknown>
    ): Promise<string> {
        const id = crypto.randomUUID();
        const logEntry: IErrorLog = {
            id,
            message: error.message || 'Unknown Error',
            stack: error.stack,
            url: window.location.href,
            userAgent: navigator.userAgent,
            timestamp: Date.now(),
            severity,
            metadata: {
                ...metadata,
                location: window.location.pathname
            }
        };

        try {
            await db.error_logs.add(logEntry);
            console.error(`[ErrorLogged] ${id}:`, error);
            return id;
        } catch (dbError) {
            // Fallback to console if DB fails
            console.error('[ErrorLoggingService] Failed to persist log:', dbError);
            console.error('[OriginalError]:', error);
            return id;
        }
    },

    /**
     * Retrieves a log entry by ID.
     */
    async getLog(id: string): Promise<IErrorLog | undefined> {
        return db.error_logs.get(id);
    },

    /**
     * Clears old logs (e.g., older than 30 days).
     */
    async clearOldLogs(days = 30): Promise<void> {
        const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
        await db.error_logs.where('timestamp').below(cutoff).delete();
    }
};
