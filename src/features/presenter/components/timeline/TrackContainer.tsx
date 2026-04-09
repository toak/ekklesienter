import React, { useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { cn } from '@/core/utils/cn';

interface TrackContainerProps {
    children: React.ReactNode;
    className?: string;
}

export interface TrackContainerHandle {
    scrollToSlide: (slideId: string) => void;
    getScrollElement: () => HTMLDivElement | null;
}

/**
 * Synchronized horizontal scroll container for timeline tracks.
 * All tracks (slides, audio) share this container for aligned scrolling.
 */
const TrackContainer = forwardRef<TrackContainerHandle, TrackContainerProps>(
    ({ children, className }, ref) => {
        const scrollRef = useRef<HTMLDivElement>(null);

        useImperativeHandle(ref, () => ({
            scrollToSlide: (slideId: string) => {
                const container = scrollRef.current;
                if (!container) return;
                
                const el = container.querySelector(`[data-slide-id="${slideId}"]`) as HTMLElement;
                if (el) {
                    const containerRect = container.getBoundingClientRect();
                    const elRect = el.getBoundingClientRect();
                    
                    // Use getBoundingClientRect to calculate position relative to the viewport
                    // which is more reliable than offsetLeft when nested in relative containers
                    
                    // Calculate position relative to container
                    const relativeLeft = elRect.left - containerRect.left + container.scrollLeft;
                    
                    const scrollLeft = relativeLeft - (container.clientWidth / 2) + (elRect.width / 2);
                    
                    container.scrollTo({
                        left: scrollLeft,
                        behavior: 'smooth'
                    });
                }
            },
            getScrollElement: () => scrollRef.current,
        }));

        return (
            <div
                ref={scrollRef}
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
