import { describe, it, expect, beforeEach } from 'vitest';
import { useHistoryStore } from './historyStore';

const PRES_A = 'pres-a';
const PRES_B = 'pres-b';

const makeSlides = (label: string) => [{ id: `slide-${label}` } as any];

describe('historyStore undo-redo state', () => {
    beforeEach(() => {
        useHistoryStore.getState().clear();
    });

    it('should start with empty past and future', () => {
        expect(useHistoryStore.getState().past.length).toBe(0);
        expect(useHistoryStore.getState().future.length).toBe(0);
    });

    it('should record presentation-level snapshots', () => {
        useHistoryStore.getState().pushSnapshot({ presentationId: PRES_A, slides: makeSlides('v1') });
        useHistoryStore.getState().pushSnapshot({ presentationId: PRES_A, slides: makeSlides('v2') });
        expect(useHistoryStore.getState().past.length).toBe(2);
    });

    it('undo() should return the popped snapshot (before-state to restore)', () => {
        useHistoryStore.getState().pushSnapshot({ presentationId: PRES_A, slides: makeSlides('before') });
        // push a second snapshot representing state after another action
        useHistoryStore.getState().pushSnapshot({ presentationId: PRES_A, slides: makeSlides('after') });

        const restored = useHistoryStore.getState().undo();
        expect(restored?.slides[0].id).toBe('slide-after');
        expect(useHistoryStore.getState().past.length).toBe(1);
        expect(useHistoryStore.getState().future.length).toBe(1);
    });

    it('redo() should return the popped future snapshot', () => {
        useHistoryStore.getState().pushSnapshot({ presentationId: PRES_A, slides: makeSlides('v1') });
        useHistoryStore.getState().pushSnapshot({ presentationId: PRES_A, slides: makeSlides('v2') });

        useHistoryStore.getState().undo(); // move v2 to future
        const redone = useHistoryStore.getState().redo();
        expect(redone?.slides[0].id).toBe('slide-v2');
        expect(useHistoryStore.getState().past.length).toBe(2);
        expect(useHistoryStore.getState().future.length).toBe(0);
    });

    it('pushing a new snapshot clears the redo stack', () => {
        useHistoryStore.getState().pushSnapshot({ presentationId: PRES_A, slides: makeSlides('v1') });
        useHistoryStore.getState().undo();
        expect(useHistoryStore.getState().future.length).toBe(1);

        // New action — future must be cleared
        useHistoryStore.getState().pushSnapshot({ presentationId: PRES_A, slides: makeSlides('v2') });
        expect(useHistoryStore.getState().future.length).toBe(0);
    });

    it('undo() returns null when past is empty', () => {
        expect(useHistoryStore.getState().undo()).toBeNull();
    });

    it('redo() returns null when future is empty', () => {
        expect(useHistoryStore.getState().redo()).toBeNull();
    });

    it('should respect the 256 snapshot limit', () => {
        for (let i = 0; i < 260; i++) {
            useHistoryStore.getState().pushSnapshot({ presentationId: PRES_A, slides: makeSlides(`v${i}`) });
        }
        expect(useHistoryStore.getState().past.length).toBe(256);
        // The oldest entries should have been dropped — first entry is v4 (0-indexed)
        expect(useHistoryStore.getState().past[0].slides[0].id).toBe('slide-v4');
    });

    it('snapshot stores presentationId and slides', () => {
        const slides = makeSlides('test');
        useHistoryStore.getState().pushSnapshot({ presentationId: PRES_B, slides });
        const snap = useHistoryStore.getState().past[0];
        expect(snap.presentationId).toBe(PRES_B);
        expect(snap.slides).toEqual(slides);
        expect(snap.id).toBeTruthy();
        expect(snap.timestamp).toBeGreaterThan(0);
    });
});
