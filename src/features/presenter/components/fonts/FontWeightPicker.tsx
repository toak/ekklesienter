import React from 'react';
import { useTranslation } from 'react-i18next';
import { useSetAtom } from 'jotai';
import { Check, Search, X } from 'lucide-react';
import { cn } from '@/core/utils/cn';
import { fontPreviewWeightAtom } from '@/core/store/uiAtoms';
import { getSystemFontData, normalizeFontStyle, getWeightName } from '@/core/services/fontService';
import { AVAILABLE_FONTS } from '@/core/data/fonts';

interface FontWeightPickerProps {
    family: string;
    value: string;
    onSelect: (weight: string) => void;
    className?: string;
}

const BUNDLED_WEIGHTS = [
    { name: 'Thin', value: '100' },
    { name: 'Extra Light', value: '200' },
    { name: 'Light', value: '300' },
    { name: 'Regular', value: '400' },
    { name: 'Medium', value: '500' },
    { name: 'Semi Bold', value: '600' },
    { name: 'Bold', value: '700' },
    { name: 'Extra Bold', value: '800' },
    { name: 'Black', value: '900' },
    { name: 'Thin Italic', value: '100 italic' },
    { name: 'Light Italic', value: '300 italic' },
    { name: 'Italic', value: '400 italic' },
    { name: 'Medium Italic', value: '500 italic' },
    { name: 'Bold Italic', value: '700 italic' },
    { name: 'Black Italic', value: '900 italic' },
];

export const FontWeightPicker: React.FC<FontWeightPickerProps> = ({
    family,
    value,
    onSelect,
    className
}) => {
    const { t } = useTranslation();
    const setWeightPreview = useSetAtom(fontPreviewWeightAtom);
    const [availableStyles, setAvailableStyles] = React.useState<{ name: string; value: string }[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [searchQuery, setSearchQuery] = React.useState('');

    React.useEffect(() => {
        const fetchStyles = async () => {
            setLoading(true);
            const isBundled = AVAILABLE_FONTS.some(f => f.name === family);

            if (isBundled) {
                const def = AVAILABLE_FONTS.find(f => f.name === family);
                setAvailableStyles(def?.weights || BUNDLED_WEIGHTS);
            } else {
                const allData = await getSystemFontData();
                const familyData = allData.filter(f => f.family === family);

                if (familyData.length > 0) {
                    const styles = familyData.map(f => ({
                        name: getWeightName(f.style),
                        value: f.style
                    }));
                    // De-duplicate if necessary and sort
                    const seen = new Set();
                    const uniqueStyles = styles.filter(s => {
                        if (seen.has(s.value)) return false;
                        seen.add(s.value);
                        return true;
                    });
                    setAvailableStyles(uniqueStyles);
                } else {
                    setAvailableStyles(BUNDLED_WEIGHTS); // Fallback
                }
            }
            setLoading(false);
        };
        fetchStyles();
    }, [family]);

    const filteredStyles = React.useMemo(() => {
        if (!searchQuery.trim()) return availableStyles;
        const q = searchQuery.toLowerCase();
        return availableStyles.filter(s => s.name.toLowerCase().includes(q));
    }, [availableStyles, searchQuery]);

    return (
        <div className={cn("flex flex-col gap-2 min-w-[200px] max-h-[400px]", className)}>
            {/* Search */}
            <div className="relative group px-1 mb-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3 h-3 text-stone-500 group-focus-within:text-accent transition-colors" />
                <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={t('search_styles_placeholder') || "Search styles..."}
                    className="w-full bg-black/40 border border-white/5 rounded-lg py-1.5 pl-9 pr-8 text-[11px] text-stone-200 placeholder:text-stone-600 focus:outline-hidden focus:border-accent/40 transition-all font-sans"
                />
                {searchQuery && (
                    <button
                        onClick={() => setSearchQuery('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-white/10 text-stone-500 hover:text-white transition-all"
                    >
                        <X className="w-2.5 h-2.5" />
                    </button>
                )}
            </div>

            <div className="overflow-y-auto custom-scrollbar flex-1 pr-1">
                {loading ? (
                    <div className="py-8 flex flex-col items-center justify-center gap-2 opacity-30">
                        <div className="w-3 h-3 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : filteredStyles.length > 0 ? (
                    <div className="flex flex-col gap-0.5">
                        {filteredStyles.map((style) => (
                            <button
                                key={style.value}
                                onClick={() => onSelect(style.value)}
                                onMouseEnter={() => setWeightPreview(style.value)}
                                onMouseLeave={() => setWeightPreview(null)}
                                className={cn(
                                    "flex items-center justify-between px-3 py-2 rounded-lg transition-all duration-200 group text-left",
                                    value === style.value
                                        ? "bg-accent/10 text-accent"
                                        : "text-stone-400 hover:bg-white/5 hover:text-stone-200"
                                )}
                            >
                                <span className="text-[11px] font-medium truncate" style={{ fontFamily: family }}>
                                    {style.name}
                                </span>
                                {value === style.value && (
                                    <Check className="w-3 h-3 shrink-0" />
                                )}
                            </button>
                        ))}
                    </div>
                ) : (
                    <div className="py-6 text-center opacity-30">
                        <span className="text-[10px] uppercase tracking-widest font-black">No Styles Found</span>
                    </div>
                )}
            </div>
        </div>
    );
};
