import React, { useRef, forwardRef, useImperativeHandle } from 'react';
import { cn } from '@/core/utils/cn';

interface TrackContainerProps {
    children: React.ReactNode;
    className?: string;
    onUserScroll?: () => void;
}

export interface TrackContainerHandle {
    scrollToSlide: (slideId: string, parentId?: string) => void;
    getScrollElement: () => HTMLDivElement | null;
}

/**
 * Synchronized horizontal scroll container for timeline tracks.
 * All tracks (slides, audio) share this container for aligned scrolling.
 */
const TrackContainer = forwardRef<TrackContainerHandle, TrackContainerProps>(
    ({ children, className, onUserScroll }, ref) => {
        const scrollRef = useRef<HTMLDivElement>(null);
        const isProgrammaticScroll = useRef(false);
        const scrollTimeout = useRef<NodeJS.Timeout | null>(null);

        useImperativeHandle(ref, () => ({
            scrollToSlide: (slideId: string, parentId?: string) => {
                const container = scrollRef.current;
                if (!container) return;
                
                let el = null;
                if (parentId) {
                    el = container.querySelector(`[data-parent-id="${parentId}"] [data-slide-id="${slideId}"]`) as HTMLElement;
                }
                if (!el) {
                    el = container.querySelector(`[data-slide-id="${slideId}"]`) as HTMLElement;
                }
                if (el) {
                    const containerRect = container.getBoundingClientRect();
                    const elRect = el.getBoundingClientRect();
                    
                    const relativeLeft = elRect.left - containerRect.left + container.scrollLeft;
                    const scrollLeft = relativeLeft - (container.clientWidth / 2) + (elRect.width / 2);
                    
                    isProgrammaticScroll.current = true;
                    if (scrollTimeout.current) clearTimeout(scrollTimeout.current);
                    
                    container.scrollTo({
                        left: scrollLeft,
                        behavior: 'smooth'
                    });
                    
                    scrollTimeout.current = setTimeout(() => {
                        isProgrammaticScroll.current = false;
                    }, 500);
                }
            },
            getScrollElement: () => scrollRef.current,
        }));

        const handleScroll = () => {
            if (!isProgrammaticScroll.current) {
                onUserScroll?.();
            }
        };

        return (
            <div
                ref={scrollRef}
                onScroll={handleScroll}
                onWheel={() => {
                    if (isProgrammaticScroll.current) {
                        isProgrammaticScroll.current = false;
                        if (scrollTimeout.current) clearTimeout(scrollTimeout.current);
                    }
                }}
                onTouchMove={() => {
                    if (isProgrammaticScroll.current) {
                        isProgrammaticScroll.current = false;
                        if (scrollTimeout.current) clearTimeout(scrollTimeout.current);
                    }
                }}
                className={cn(
                    'flex-1 overflow-x-auto overflow-y-hidden no-scrollbar flex flex-col items-start relative',
                    className
                )}
            >
                {children}
            </div>
        );
    }
);

TrackContainer.displayName = 'TrackContainer';

export default React.memo(TrackContainer);
