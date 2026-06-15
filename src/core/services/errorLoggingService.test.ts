import { describe, it, expect, vi } from 'vitest';
import { ErrorLoggingService } from './errorLoggingService';

vi.mock('@/core/db', () => ({
    db: {
        error_logs: {
            add: vi.fn().mockResolvedValue('uuid-1')
        }
    }
}));

describe('errorLoggingService', () => {
    it('should log failures returning generated UUID', async () => {
        const uuid = await ErrorLoggingService.logError(new Error('Critical Test Failure'));
        expect(uuid).toBeDefined();
    });
});
