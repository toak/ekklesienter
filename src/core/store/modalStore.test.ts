import { describe, it, expect } from 'vitest';
import { useModalStore, ModalType } from './modalStore';

describe('modalStore atomic overlays', () => {
    it('should open and close modal states dynamically', () => {
        expect(useModalStore.getState().stack).toEqual([]);
        expect(useModalStore.getState().isModalOpen(ModalType.CUSTOMIZATION)).toBe(false);
        
        useModalStore.getState().openModal(ModalType.CUSTOMIZATION, { tab: 'audio' });
        expect(useModalStore.getState().isModalOpen(ModalType.CUSTOMIZATION)).toBe(true);
        expect(useModalStore.getState().stack[0].props).toEqual({ tab: 'audio' });
        
        useModalStore.getState().closeModal();
        expect(useModalStore.getState().isModalOpen(ModalType.CUSTOMIZATION)).toBe(false);
        expect(useModalStore.getState().stack).toEqual([]);
    });
});

