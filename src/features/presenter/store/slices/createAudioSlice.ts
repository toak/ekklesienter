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

        const { activePresentation } = get();
        if (!activePresentation) return;

        // Smart placement logic
        const slides = activePresentation.slides;
        const startIdx = slides.findIndex(s => s.id === scope.startSlideId);
        const endIdx = slides.findIndex(s => s.id === scope.endSlideId);
        
        let targetStartIdx = endIdx + 1;
        let targetEndIdx = targetStartIdx + (endIdx - startIdx);

        // If no more slides in front, check before
        if (targetStartIdx >= slides.length) {
            targetStartIdx = Math.max(0, startIdx - 1 - (endIdx - startIdx));
            targetEndIdx = startIdx - 1;
        }

        // Clamp to valid range
        if (targetStartIdx < 0) targetStartIdx = 0;
        if (targetEndIdx >= slides.length) targetEndIdx = slides.length - 1;

        const newScope: IAudioScope = {
            ...structuredClone(scope),
            id: crypto.randomUUID(),
            startSlideId: slides[targetStartIdx].id,
            endSlideId: slides[targetEndIdx].id
        };

        await db.audioScopes.add(newScope);
        set({ selectedAudioScopeId: newScope.id });
        toast.success(i18n.t('audio_duplicated', 'Audio track duplicated'));
        return newScope.id;
    },

    copyAudioScope: async (scopeId) => {
        const scope = await db.audioScopes.get(scopeId);
        if (!scope) return;
        set({ audioClipboard: { scope, presentationId: get().selectedPresentationId || '' } });
        toast.success(i18n.t('audio_copied', 'Audio track copied'));
    },

    pasteAudioScope: async (targetSlideId) => {
        const { audioClipboard, selectedPresentationId } = get();
        if (!audioClipboard || !selectedPresentationId) return;

        const { scope } = audioClipboard;
        const pres = await db.presentationFiles.get(selectedPresentationId);
        if (!pres) return;

        const targetIdx = pres.slides.findIndex(s => s.id === targetSlideId);
        if (targetIdx === -1) return;

        const length = pres.slides.findIndex(s => s.id === scope.endSlideId) - pres.slides.findIndex(s => s.id === scope.startSlideId);
        const endIdx = Math.min(pres.slides.length - 1, targetIdx + (length > 0 ? length : 0));

        const newScope: IAudioScope = {
            ...structuredClone(scope),
            id: crypto.randomUUID(),
            presentationId: selectedPresentationId,
            startSlideId: targetSlideId,
            endSlideId: pres.slides[endIdx].id
        };

        await db.audioScopes.add(newScope);
        set({ selectedAudioScopeId: newScope.id });
        toast.success(i18n.t('audio_pasted', 'Audio track pasted'));
    },

    selectAudioScope: (id) => set({ selectedAudioScopeId: id }),

    resolveAudioConflict: async (action, params) => {
        const { targetSlideId, fileId, fileName, overlappingScopes } = params;
        const { selectedPresentationId } = get();
        if (!selectedPresentationId) return;

        if (action === 'replace') {
            await Promise.all(overlappingScopes.map(s => db.audioScopes.delete(s.id)));
            await get().addAudioScope(targetSlideId, fileId, fileName);
        } else if (action === 'shift') {
            // Logic to shift existing scopes or the new one to avoid overlap
            // For now, simple implementation
            await get().addAudioScope(targetSlideId, fileId, fileName);
        }
    },
});
