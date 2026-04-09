import React, { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/core/db';
import { usePresentationStore } from '@/features/presenter/store/presentationStore';

/**
 * Ensures that fonts used in the current presentation (and others) are "active" in the browser.
 * This prevents layout shifts and incorrect useTextFit measurements that happen
 * when a font is used for the first time and the browser hasn't "warmed it up".
 */
export const FontPrewarmer: React.FC = () => {
    const activePresentationId = usePresentationStore(s => s.activePresentationId);
    const activePresentation = usePresentationStore(s => s.activePresentation);

    // Fetch only the active presentation and any expanded children to get fonts
    const presentations = useLiveQuery(async () => {
        if (!activePresentationId) return [];
        
        // Use the store presentation if it's already matches the active ID (optimization)
        const rootPres = (activePresentation?.id === activePresentationId) 
            ? activePresentation 
            : await db.presentationFiles.get(activePresentationId);
            
        if (!rootPres) return [];

        const expandedIds = rootPres.slides
            .filter(s => s.isExpanded)
            .map(s => (s as any).presentationId || (s as any).masterPresentationId)
            .filter(Boolean) as string[];

        if (expandedIds.length === 0) return [rootPres];

        const children = await db.presentationFiles.where('id').anyOf(expandedIds).toArray();
        return [rootPres, ...children];
    }, [activePresentationId, activePresentation?.slides]);

    const uniqueFonts = useMemo(() => {
        const fonts = new Set<string>();
        // Add default app fonts
        fonts.add('Inter');

        if (presentations && presentations.length > 0) {
            presentations.forEach(pres => {
                pres.slides.forEach(slide => {
                    if (slide.type === 'normal') {
                        (slide as any).content.canvasItems?.forEach((item: any) => {
                            if (item.text?.fontFamily) {
                                fonts.add(item.text.fontFamily);
                            }
                        });
                    }
                });
            });
        }

        return Array.from(fonts);
    }, [presentations]);

    if (uniqueFonts.length === 0) return null;

    return (
        <div
            aria-hidden="true"
            className="fixed opacity-0 pointer-events-none -z-50"
            style={{
                visibility: 'hidden',
                whiteSpace: 'nowrap',
                height: 0,
                width: 0,
                overflow: 'hidden'
            }}
        >
            {uniqueFonts.map(font => (
                <span key={font} style={{ fontFamily: font }}>
                    Font Prewarm {font}
                </span>
            ))}
        </div>
    );
};
