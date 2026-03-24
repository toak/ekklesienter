import { IBlock, ITemplate } from '../types';

/**
 * The only hardcoded block — always present, non-deletable.
 * All other blocks come from bundled `.ektmp` template files.
 */
export const DEFAULT_BLOCKS: IBlock[] = [
    {
        id: 'default',
        name: 'Default',
        nameRu: 'По умолчанию',
        icon: 'Square',
        color: '#94A3B8',
        description: 'Empty blank slide',
        defaultSlides: 1
    },
];

/**
 * Minimal hardcoded templates. Rich templates come from bundled `.ektmp` files.
 * - `blank-dark`: Internal fallback used by slide creation (never shown in template picker)
 * - `empty-slide`: The blank template for the `default` block
 * - `bible-default`: Default template for Bible slides (special non-block type)
 */
export const DEFAULT_TEMPLATES: ITemplate[] = [
    {
        id: 'blank-dark',
        name: 'Blank Slide',
        nameRu: 'Пустой слайд',
        category: 'default',
        background: [{ id: 'blank-dark-bg', type: 'color', visible: true, opacity: 1, blendMode: 'normal', color: '#000000' }],
        assets: [],
        structure: { layout: 'blank' },
        isUserCreated: false,
    },
    {
        id: 'empty-slide',
        name: 'Empty Slide',
        nameRu: 'Пустой слайд',
        category: 'default',
        background: [{ id: 'empty-slide-bg', type: 'color', visible: true, opacity: 1, blendMode: 'normal', color: '#000000' }],
        assets: [],
        structure: { layout: 'blank' },
        canvasItems: [],
        isUserCreated: false,
    },
    {
        id: 'bible-default',
        name: 'Bible Default',
        nameRu: 'Библия по умолчанию',
        category: 'bible',
        background: [{ id: 'bible-default-bg', type: 'color', visible: true, opacity: 1, blendMode: 'normal', color: '#000000' }],
        assets: [],
        structure: { layout: 'center' },
        textStyle: {
            fontFamily: 'Inter',
            color: '#FFFFFF',
            contentColor: '#A8A29E',
            titleTransform: 'uppercase',
            titleWeight: '900',
        },
        canvasItems: [],
        isUserCreated: false,
    }
];
