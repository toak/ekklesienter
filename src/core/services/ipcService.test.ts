import { describe, it, expect } from 'vitest';
import { ipcService } from './ipcService';

describe('ipcService renderer-main bridge', () => {
    it('should offer callback bindings safely', () => {
        expect(ipcService.on).toBeDefined();
    });
});
