import { useState, useCallback, useRef, useEffect } from 'react';

/**
 * Hook to handle vertical resizing using percentages
 */
export function useVerticalResize(storageKey: string, defaultPercent: number, minPercent: number, maxPercent: number): {
  percent: number;
  handleMouseDown: (e: React.MouseEvent) => void;
  containerRef: React.RefObject<HTMLDivElement>;
} {
  const [percent, setPercent] = useState(() => {
    const saved = localStorage.getItem(storageKey);
    return saved ? Number(saved) : defaultPercent;
  });
  const isDragging = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const percentRef = useRef(percent);
  useEffect(() => {
    percentRef.current = percent;
  }, [percent]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const relativeY = e.clientY - rect.top;
      const newPercent = Math.min(maxPercent, Math.max(minPercent, (relativeY / rect.height) * 100));
      setPercent(newPercent);
    };

    const handleMouseUp = () => {
      if (isDragging.current) {
        isDragging.current = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        localStorage.setItem(storageKey, String(percentRef.current));
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [storageKey, minPercent, maxPercent]);

  return { percent, handleMouseDown, containerRef };
}
