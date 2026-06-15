import { useState, useCallback, useRef, useEffect } from 'react';
import { useAtom } from 'jotai';
import { AppMode } from '@/core/types';
import { appModeAtom } from '@/core/store/uiAtoms';
import { useBibleStore } from '@/features/bible-browser/store/bibleStore';
import { useShallow } from 'zustand/react/shallow';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/core/db';

/**
 * Hook to handle general navigation state, mode switching and translation cycling
 */
export function useNavigationState(): {
  appMode: AppMode;
  setAppMode: (update: AppMode | ((prev: AppMode) => AppMode)) => void;
  isModePickerOpen: boolean;
  toggleModePicker: (triggerElement: HTMLElement | null) => void;
  closeModePicker: () => void;
  isPickerOpen: boolean;
  setIsPickerOpen: React.Dispatch<React.SetStateAction<boolean>>;
  triggerRect: DOMRect | null;
  setTriggerRect: React.Dispatch<React.SetStateAction<DOMRect | null>>;
  handleTranslationBadgeClick: (triggerElement: HTMLElement | null) => void;
  closePicker: () => void;
} {
  const [appMode, setAppMode] = useAtom(appModeAtom);
  const [isModePickerOpen, setIsModePickerOpen] = useState(false);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [triggerRect, setTriggerRect] = useState<DOMRect | null>(null);
  
  const { currentTranslationId, setTranslation } = useBibleStore(useShallow(s => ({
    currentTranslationId: s.currentTranslationId,
    setTranslation: s.setTranslation
  })));
  const translations = useLiveQuery(() => db.translations.toArray()) || [];

  // Multi-click logic for translation switching
  const clickCountRef = useRef(0);
  const clickTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Clean up timeouts on unmount
  useEffect(() => {
    return () => {
      if (clickTimeoutRef.current) {
        clearTimeout(clickTimeoutRef.current);
      }
    };
  }, []);

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

  const toggleModePicker = useCallback((triggerElement: HTMLElement | null) => {
    if (triggerElement) {
      setTriggerRect(triggerElement.getBoundingClientRect());
    }
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
