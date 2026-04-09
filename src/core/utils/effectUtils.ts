import { ICanvasEffect } from '../types';

/**
 * Utility to convert an array of stacked effects into CSS filter and backdrop-filter strings.
 */
export const getEffectsStyle = (effects: ICanvasEffect[]) => {
    if (!effects || effects.length === 0) return { filter: undefined, backdropFilter: undefined, boxShadow: undefined };

    const visibleEffects = effects.filter(e => e.visible);
    
    // 1. Filter: Drop Shadow & Layer Blur
    const filters: string[] = [];
    visibleEffects.forEach(fx => {
        if (fx.type === 'drop-shadow') {
            filters.push(`drop-shadow(${fx.x ?? 0}px ${fx.y ?? 0}px ${fx.blur ?? 0}px ${fx.color ?? '#000000'})`);
        } else if (fx.type === 'layer-blur') {
            filters.push(`blur(${fx.blur ?? 0}px)`);
        }
    });

    // 2. Backdrop Filter: Background Blur
    const backdropFilters: string[] = [];
    visibleEffects.forEach(fx => {
        if (fx.type === 'background-blur') {
            backdropFilters.push(`blur(${fx.blur ?? 0}px)`);
        }
    });

    // 3. Box Shadow: Inner Shadow
    const boxShadows: string[] = [];
    visibleEffects.forEach(fx => {
        if (fx.type === 'inner-shadow') {
            boxShadows.push(`inset ${fx.x ?? 0}px ${fx.y ?? 0}px ${fx.blur ?? 0}px ${fx.spread ?? 0}px ${fx.color ?? '#000000'}`);
        }
    });

    return {
        filter: filters.length > 0 ? filters.join(' ') : undefined,
        backdropFilter: backdropFilters.length > 0 ? backdropFilters.join(' ') : undefined,
        boxShadow: boxShadows.length > 0 ? boxShadows.join(', ') : undefined,
    };
};
