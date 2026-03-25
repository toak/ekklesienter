import { useState, useCallback, useRef } from 'react';
import { useAtom } from 'jotai';
import { appModeAtom } from '@/core/store/uiAtoms';
import { useBibleStore } from '@/features/bible-browser/store/bibleStore';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/core/db';

/**
 * Hook to handle general navigation state, mode switching and translation cycling
 */
export function useNavigationState() {
  const [appMode, setAppMode] = useAtom(appModeAtom);
  const [isModePickerOpen, setIsModePickerOpen] = useState(false);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [triggerRect, setTriggerRect] = useState<DOMRect | null>(null);
  
  const { currentTranslationId, setTranslation } = useBibleStore();
  const translations = useLiveQuery(() => db.translations.toArray()) || [];

  // Multi-click logic for translation switching
  const clickCountRef = useRef(0);
  const clickTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const cycleTranslation = useCallback((direction: number) => {
    if (translations.length <= 1) return;
    const currentIndex = translations.findIndex(tr => tr.id === currentTranslationId);
    if (currentIndex === -1) return;
    const nextIndex = (currentIndex + direction + translations.length) % translations.length;
    setTranslation(translations[nextIndex].id);
  }, [translations, currentTranslationId, setTranslation]);

  const handleTranslationBadgeClick = useCallback((triggerElement: HTMLElement | null) => {
    clickCountRef.current++;
    if (clickTimeoutRef.current) clearTimeout(clickTimeoutRef.current);

    clickTimeoutRef.current = setTimeout(() => {
      if (clickCountRef.current === 1) {
        if (triggerElement) {
          setTriggerRect(triggerElement.getBoundingClientRect());
        }
        setIsPickerOpen(true);
      } else if (clickCountRef.current === 2) {
        cycleTranslation(1);
      } else if (clickCountRef.current >= 3) {
        cycleTranslation(-1);
      }
      clickCountRef.current = 0;
    }, 250);
  }, [cycleTranslation]);

  const toggleModePicker = useCallback(() => {
    setIsModePickerOpen(prev => !prev);
  }, []);

  const closeModePicker = useCallback(() => {
    setIsModePickerOpen(false);
  }, []);

  const closePicker = useCallback(() => {
    setIsPickerOpen(false);
  }, []);

  return {
    appMode,
    setAppMode,
    isModePickerOpen,
    toggleModePicker,
    closeModePicker,
    isPickerOpen,
    setIsPickerOpen,
    triggerRect,
    setTriggerRect,
    handleTranslationBadgeClick,
    closePicker
  };
}
