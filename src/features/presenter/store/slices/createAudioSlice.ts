import { db } from '@/core/db';
import { PresentationSliceCreator } from '../types';
import { IAudioScope } from '@/core/types';
import { toast } from '@/core/utils/toast';
import i18n from '@/core/i18n';

export const createAudioSlice: PresentationSliceCreator = (set, get) => ({
    addAudioScope: async (slideId, fileId, fileName) => {
        const { selectedPresentationId } = get();
        if (!selectedPresentationId) return;

        const newScope: IAudioScope = {
            id: crypto.randomUUID(),
            presentationId: selectedPresentationId,
            fileId,
            fileName: fileName || '',
            startSlideId: slideId,
            endSlideId: slideId,
            volume: 1,
            loop: false,
            isGlobal: false
        };

        await db.audioScopes.add(newScope);
        toast.success(i18n.t('audio_added', 'Audio track added'));
    },

    updateAudioScopeBoundary: async (scopeId, startSlideId, endSlideId) => {
        await db.audioScopes.update(scopeId, { startSlideId, endSlideId });
    },

    updateAudioScope: async (scopeId, updates) => {
        await db.audioScopes.update(scopeId, updates);
    },

    removeAudioScope: async (scopeId) => {
        await db.audioScopes.delete(scopeId);
        if (get().selectedAudioScopeId === scopeId) {
            set({ selectedAudioScopeId: null });
        }
        toast.success(i18n.t('audio_removed', 'Audio track removed'));
    },

    duplicateAudioScope: async (scopeId) => {
        const scope = await db.audioScopes.get(scopeId);
        if (!scope) return;

        const newScope: IAudioScope = {
            ...scope,
            id: crypto.randomUUID()
        };

        await db.audioScopes.add(newScope);
        toast.success(i18n.t('audio_duplicated', 'Audio track duplicated'));
        return newScope.id;
    },

    selectAudioScope: (id) => set({ selectedAudioScopeId: id }),

    resolveAudioConflict: async (action, params) => {
        const { targetSlideId, fileId, overlappingScopes } = params;
        const { selectedPresentationId } = get();
        if (!selectedPresentationId) return;

        if (action === 'replace') {
            await Promise.all(overlappingScopes.map(s => db.audioScopes.delete(s.id)));
            await get().addAudioScope(targetSlideId, fileId);
        } else if (action === 'shift') {
            // Logic to shift existing scopes or the new one to avoid overlap
            // For now, simple implementation
            await get().addAudioScope(targetSlideId, fileId);
        }
    },
});
