import React, { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/core/db';

/**
 * Ensures that fonts used in the current presentation (and others) are "active" in the browser.
 * This prevents layout shifts and incorrect useTextFit measurements that happen
 * when a font is used for the first time and the browser hasn't "warmed it up".
 */
export const FontPrewarmer: React.FC = () => {
    // Fetch all presentations to get a comprehensive list of fonts
    const presentations = useLiveQuery(() => db.presentationFiles.toArray());

    const uniqueFonts = useMemo(() => {
        const fonts = new Set<string>();
        // Add default app fonts
        fonts.add('Inter');

        if (presentations) {
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
