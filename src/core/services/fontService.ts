export interface SystemFontData {
    family: string;
    fullName: string;
    postscriptName: string;
    style: string;
}

declare global {
    interface Window {
        queryLocalFonts?: () => Promise<SystemFontData[]>;
    }
}


/**
 * Normalizes font styles into standard weights/slants.
 */
export const normalizeFontStyle = (style: string) => {
    const s = style.toLowerCase();
    let weight = '400';
    let isItalic = false;

    if (s.includes('bold')) weight = '700';
    else if (s.includes('black')) weight = '900';
    else if (s.includes('heavy')) weight = '900';
    else if (s.includes('light')) weight = '300';
    else if (s.includes('thin')) weight = '100';
    else if (s.includes('medium')) weight = '500';
    else if (s.includes('semibold')) weight = '600';

    if (s.includes('italic') || s.includes('oblique')) isItalic = true;

    return { weight, isItalic };
};

/**
 * Fetches detailed system font data.
 */
export const getSystemFontData = async (): Promise<SystemFontData[]> => {
    if (!('queryLocalFonts' in window)) {
        console.warn('queryLocalFonts API is not supported in this environment.');
        return [];
    }
    try {
        const fonts = await window.queryLocalFonts();
        return fonts.map((f: SystemFontData) => ({
            family: f.family,
            fullName: f.fullName,
            postscriptName: f.postscriptName,
            style: f.style
        }));
    } catch (e) {
        console.error('Failed to fetch system font data:', e);
        return [];
    }
};

/**
 * Returns a unique list of font families.
 */
export const getSystemFonts = async (): Promise<string[]> => {
    const data = await getSystemFontData();
    const families = Array.from(new Set(data.map(f => f.family))).sort((a, b) => a.localeCompare(b));
    return families;
};

/**
 * Maps a weight value (e.g. '700', '400 italic') to a human-readable name (e.g. 'Bold', 'Italic').
 */
export const getWeightName = (weight: string, t?: (key: string) => string) => {
    if (!weight) return t ? t('weight_regular') : 'Regular';
    const parts = weight.toString().toLowerCase().split(' ');
    const w = parts[0];
    const isItalic = parts.includes('italic') || parts.includes('oblique');

    const weightMap: Record<string, string> = {
        '100': 'thin',
        '200': 'extra_light',
        '300': 'light',
        '400': 'regular',
        '500': 'medium',
        '600': 'semi_bold',
        '700': 'bold',
        '800': 'extra_bold',
        '900': 'black',
    };

    // If it's already a name (for system fonts), just return it
    if (isNaN(parseInt(w))) {
        return weight;
    }

    const key = weightMap[w];
    let name = (t && key) ? t(`weight_${key}`) : (key ? key.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ') : w);

    if (isItalic) {
        if (key === 'regular') return t ? t('italic') : 'Italic';
        return t ? `${name} ${t('italic')}` : `${name} Italic`;
    }
    return name;
};

/**
 * Finds the best matching style from available options based on a target objective.
 * Target can be 'bold', 'regular', 'italic', etc.
 */
export const findBestMatchStyle = (
    availableStyles: { name: string; value: string }[],
    target: { bold?: boolean; italic?: boolean }
) => {
    if (availableStyles.length === 0) return null;

    // Rank styles based on how well they match the target
    const scoredStyles = availableStyles.map(style => {
        const { weight, isItalic } = normalizeFontStyle(style.value);
        let score = 0;

        // Weight matching
        const numericWeight = parseInt(weight);
        if (target.bold) {
            if (numericWeight >= 700) score += 10;
            else if (numericWeight >= 600) score += 5;
        } else {
            if (numericWeight === 400) score += 10;
            else if (numericWeight === 500) score += 5;
            else if (numericWeight === 300) score += 3;
        }

        // Italic matching
        if (target.italic === isItalic) score += 20;

        return { style, score };
    });

    // Return the highest scoring style
    return scoredStyles.sort((a, b) => b.score - a.score)[0].style;
};

/**
 * Checks if faux bold is needed — i.e., isBold is true but the resolved
 * fontWeight is not actually a bold weight (< 600).
 */
export const needsFauxBold = (isBold: boolean | undefined, fontWeight: string | number): boolean => {
    if (!isBold) return false;
    const { weight } = normalizeFontStyle(String(fontWeight));
    return parseInt(weight) < 600;
};
