import { describe, it, expect, vi, beforeEach } from 'vitest';
import { wakeLockService } from './wakeLockService';
import { ipcService } from './ipcService';

describe('wakeLockService', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('should request screen sentinel locks cleanly', async () => {
        vi.spyOn(ipcService, 'isElectron').mockReturnValue(false);
        const requestMock = vi.fn().mockResolvedValue({
            released: false,
            addEventListener: vi.fn()
        });
        vi.stubGlobal('navigator', {
            wakeLock: {
                request: requestMock
            }
        });
        await wakeLockService.setWakeLock(true);
        expect(requestMock).toHaveBeenCalledWith('screen');
    });
});
