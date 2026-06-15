import { describe, it, expect, vi } from 'vitest';
import { liveSyncService } from './liveSyncService';
import { ipcService } from './ipcService';

vi.mock('./ipcService', () => ({
    ipcService: {
        send: vi.fn()
    }
}));

describe('liveSyncService synchronizer', () => {
    it('should send commands via ipcService', () => {
        liveSyncService.showVerse({ id: 'v1', text: 'God is love', chapter: 3, verseNumber: 16, bookId: 'JHN' } as any);
        expect(ipcService.send).toHaveBeenCalled();
    });
});
