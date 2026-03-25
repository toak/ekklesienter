import { useState, useRef, useEffect } from 'react';
import { ICanvasSlide } from '@/core/types';
import { normalizeTransitionType } from '../components/display/transitions/SlideTransitions';

/**
 * Hook to manage slide transition lifecycle, caching previous slide state,
 * and handling transition timing.
 */
export function useSlideTransitionManager(currentKey: string, selectedSlide: any, lastTransitionTrigger: number) {
  const currentKeyRef = useRef(currentKey);
  const prevContentRef = useRef<React.ReactNode>(null);
  const [prevSlideState, setPrevSlideState] = useState<{ key: string, content: React.ReactNode } | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Synchronous phase: detect slide change and cache previous
  if (currentKey !== currentKeyRef.current) {
    setPrevSlideState({ key: currentKeyRef.current, content: prevContentRef.current });
    currentKeyRef.current = currentKey;

    const transition = (selectedSlide as ICanvasSlide)?.transition || { type: 'none', duration: 0.5 };
    const type = normalizeTransitionType(transition.type);
    
    // Checkerboard and Comic dots need isTransitioning flag for specialized rendering
    if (type === 'checkerboard' || type === 'comic-dots') {
      setIsTransitioning(true);
    } else {
      setIsTransitioning(false);
    }
  }

  // Handle cleanup of previous slide state after transition duration
  useEffect(() => {
    if (prevSlideState) {
      const transition = (selectedSlide as ICanvasSlide)?.transition || { type: 'none', duration: 0.5 };
      const dur = Math.max(transition.duration * 1000 + 200, 100);
      const timer = setTimeout(() => {
        setPrevSlideState(curr => curr?.key === prevSlideState.key ? null : curr);
      }, dur);
      return () => clearTimeout(timer);
    }
  }, [prevSlideState?.key, (selectedSlide as ICanvasSlide)?.transition]);

  // Handle complex transition timeout (checkerboard/comic-dots)
  useEffect(() => {
    if (isTransitioning && selectedSlide) {
      const transition = (selectedSlide as ICanvasSlide).transition || { type: 'none', duration: 0.5 };
      const timeout = Math.max(transition.duration * 1000 + 50, 100);
      const timer = setTimeout(() => setIsTransitioning(false), timeout);
      return () => clearTimeout(timer);
    }
  }, [isTransitioning, selectedSlide?.id, lastTransitionTrigger]);

  return {
    prevSlideState,
    isTransitioning,
    prevContentRef
  };
}
