import { describe, it, expect, vi } from 'vitest';
import { createSlideOperationsSlice } from './createSlideOperationsSlice';
import { db } from '@/core/db';

vi.mock('@/core/db', () => ({
  db: {
    presentationFiles: {
      get: vi.fn(),
    },
  },
}));

describe('createSlideOperationsSlice', () => {
    it('should initialize slide operation states', () => {
        const mockSet = vi.fn();
        const mockGet = vi.fn();
        const slice = createSlideOperationsSlice(mockSet, mockGet as any, {} as any);
        expect(slice.updatePresentationSlides).toBeDefined();
        expect(slice.duplicateSlide).toBeDefined();
    });

    it('should move multiple slides together using moveSlides', async () => {
        const mockSlides = [
            { id: 'slide-1', order: 0 },
            { id: 'slide-2', order: 1 },
            { id: 'slide-3', order: 2 },
            { id: 'slide-4', order: 3 },
        ];
        
        const mockPresentation = {
            id: 'pres-1',
            slides: mockSlides,
        };

        const mockSet = vi.fn();
        const mockUpdateSlides = vi.fn();
        const mockTakeSnapshot = vi.fn();
        const mockGet = vi.fn(() => ({
            updatePresentationSlides: mockUpdateSlides,
            takeSnapshot: mockTakeSnapshot,
        }));

        (db.presentationFiles.get as any).mockResolvedValue(mockPresentation);

        const slice = createSlideOperationsSlice(mockSet, mockGet as any, {} as any);

        // Test moving slide-2 and slide-3 forward ('forth')
        await slice.moveSlides('pres-1', ['slide-2', 'slide-3'], 'forth');
        
        expect(mockTakeSnapshot).toHaveBeenCalledWith('pres-1');
        expect(mockUpdateSlides).toHaveBeenCalledWith('pres-1', [
            { id: 'slide-1', order: 0 },
            { id: 'slide-4', order: 1 },
            { id: 'slide-2', order: 2 },
            { id: 'slide-3', order: 3 },
        ]);

        mockUpdateSlides.mockClear();

        // Test moving slide-2 and slide-3 backward ('back')
        mockPresentation.slides = [...mockSlides];
        await slice.moveSlides('pres-1', ['slide-2', 'slide-3'], 'back');
        expect(mockUpdateSlides).toHaveBeenCalledWith('pres-1', [
            { id: 'slide-2', order: 0 },
            { id: 'slide-3', order: 1 },
            { id: 'slide-1', order: 2 },
            { id: 'slide-4', order: 3 },
        ]);
        
        mockUpdateSlides.mockClear();

        // Test moving slide-2 and slide-3 to start
        mockPresentation.slides = [...mockSlides];
        await slice.moveSlides('pres-1', ['slide-2', 'slide-3'], 'start');
        expect(mockUpdateSlides).toHaveBeenCalledWith('pres-1', [
            { id: 'slide-2', order: 0 },
            { id: 'slide-3', order: 1 },
            { id: 'slide-1', order: 2 },
            { id: 'slide-4', order: 3 },
        ]);

        mockUpdateSlides.mockClear();

        // Test moving slide-2 and slide-3 to end
        mockPresentation.slides = [...mockSlides];
        await slice.moveSlides('pres-1', ['slide-2', 'slide-3'], 'end');
        expect(mockUpdateSlides).toHaveBeenCalledWith('pres-1', [
            { id: 'slide-1', order: 0 },
            { id: 'slide-4', order: 1 },
            { id: 'slide-2', order: 2 },
            { id: 'slide-3', order: 3 },
        ]);
    });
});
