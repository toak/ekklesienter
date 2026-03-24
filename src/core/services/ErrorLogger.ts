/**
 * Service for centralized error logging.
 * Follows Rule 4.4: Log to error_logs table (stubbed if Supabase is not ready).
 */
export class ErrorLogger {
    /**
     * Logs a critical application error.
     * @returns The UUID of the created log entry.
     */
    static async logError(params: {
        message: string;
        stack?: string;
        userId?: string;
        url?: string;
    }): Promise<string> {
        const errorId = crypto.randomUUID();
        const timestamp = new Date().toISOString();

        const payload = {
            errorId,
            error_message: params.message,
            stack_trace: params.stack,
            user_id: params.userId,
            url: params.url || window.location.href,
            timestamp
        };

        // Rule 4.4: In a real Supabase environment, logs would be inserted here.
        console.error(`[ErrorLogger] ${errorId}:`, payload);

        return errorId;
    }
}
