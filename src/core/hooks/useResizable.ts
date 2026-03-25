import { useState, useCallback, useRef, useEffect } from 'react';

/**
 * Custom hook to handle resizable panels with local storage persistence.
 */
export function useResizable(
  storageKey: string,
  defaultSize: number,
  minSize: number,
  maxSize: number,
  orientation: 'horizontal' | 'vertical'
) {
  const [size, setSize] = useState(() => {
    const saved = localStorage.getItem(storageKey);
    return saved ? Number(saved) : defaultSize;
  });

  // Sync size when storageKey changes
  useEffect(() => {
    const saved = localStorage.getItem(storageKey);
    setSize(saved ? Number(saved) : defaultSize);
  }, [storageKey, defaultSize]);

  const isDragging = useRef(false);
  const startPos = useRef(0);
  const startSize = useRef(0);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    isDragging.current = true;
    startPos.current = orientation === 'horizontal' ? e.clientX : e.clientY;
    startSize.current = size;
    document.body.style.cursor = orientation === 'horizontal' ? 'col-resize' : 'row-resize';
    document.body.style.userSelect = 'none';
  }, [size, orientation]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      const currentPos = orientation === 'horizontal' ? e.clientX : e.clientY;
      const delta = currentPos - startPos.current;
      const newSize = Math.min(maxSize, Math.max(minSize, startSize.current + delta));
      setSize(newSize);
    };

    const handleMouseUp = () => {
      if (isDragging.current) {
        isDragging.current = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        localStorage.setItem(storageKey, String(size));
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [storageKey, size, minSize, maxSize, orientation]);

  return { size, handleMouseDown };
}
