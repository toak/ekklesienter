import React from 'react';
import { Type, Check, Monitor, Laptop, Search, X } from 'lucide-react';
import { cn } from '@/core/utils/cn';
import { useTranslation } from 'react-i18next';
import { useSetAtom } from 'jotai';
import { fontPreviewFamilyAtom } from '@/core/store/uiAtoms';
import { getSystemFonts } from '@/core/services/fontService';
import { AVAILABLE_FONTS, FontDefinition } from '@/core/data/fonts';

interface FontLibraryProps {
    value?: string;
    onSelect: (family: string) => void;
    className?: string;
    showTitle?: boolean;
}

export const FontLibrary: React.FC<FontLibraryProps> = ({
    value,
    onSelect,
    className,
    showTitle = true
}) => {
    const { t } = useTranslation();
    const setFontPreview = useSetAtom(fontPreviewFamilyAtom);
    const [systemFonts, setSystemFonts] = React.useState<FontDefinition[]>([]);
    const [loadingSystemFonts, setLoadingSystemFonts] = React.useState(true);
    const [searchQuery, setSearchQuery] = React.useState('');

    React.useEffect(() => {
        const fetchSystemFonts = async () => {
            setLoadingSystemFonts(true);
            const families = await getSystemFonts();
            const systemDefs: FontDefinition[] = families.map(name => ({
                name,
                category: 'System',
                tags: ['Latin'],
                source: 'system'
            }));
            setSystemFonts(systemDefs);
            setLoadingSystemFonts(false);
        };
        fetchSystemFonts();

        // Cleanup: Clear preview when the font picker is closed/unmounted
        return () => setFontPreview(null);
    }, [setFontPreview]);

    const allFonts = React.useMemo(() => {
        // Create a map to deduplicate by name, prioritizing bundled fonts
        const fontMap = new Map<string, FontDefinition>();

        // Add system fonts first
        systemFonts.forEach(f => fontMap.set(f.name, f));

        // Overwrite with bundled fonts to prioritize them (they likely have better metadata)
        AVAILABLE_FONTS.forEach(f => fontMap.set(f.name, f));

        return Array.from(fontMap.values()).sort((a, b) => a.name.localeCompare(b.name));
    }, [systemFonts]);

    const searchWords = React.useMemo(() =>
        searchQuery.toLowerCase().trim().split(/\s+/).filter(Boolean)
        , [searchQuery]);

    const filteredFonts = React.useMemo(() => {
        if (searchWords.length === 0) return allFonts;
        return allFonts.filter(f => {
            const fontName = f.name.toLowerCase();
            return searchWords.every(word => fontName.includes(word));
        });
    }, [allFonts, searchWords]);

    return (
        <div className={cn("space-y-4", className)}>
            {showTitle && (
                <div className="flex items-center gap-3 px-1">
                    <div className="w-8 h-8 rounded-lg bg-accent/20 flex items-center justify-center border border-accent/30">
                        <Type className="w-4 h-4 text-accent" />
                    </div>
                    <label className="text-[10px] font-black text-stone-500 uppercase tracking-[0.2em]">{t('typography_library')}</label>
                </div>
            )}

            {/* Search Bar */}
            <div className="relative group px-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-stone-500 group-focus-within:text-accent transition-colors" />
                <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={t('search_fonts_placeholder') || "Search fonts..."}
                    className="w-full bg-black/40 border border-white/5 rounded-xl py-2.5 pl-10 pr-10 text-xs text-stone-200 placeholder:text-stone-600 focus:outline-hidden focus:border-accent/40 focus:ring-1 focus:ring-accent/20 transition-all font-sans"
                />
                {searchQuery && (
                    <button
                        onClick={() => setSearchQuery('')}
                        className="absolute right-4 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-white/10 text-stone-500 hover:text-white transition-all"
                    >
                        <X className="w-3 h-3" />
                    </button>
                )}
            </div>

            <div className="grid grid-cols-1 gap-2 max-h-[320px] overflow-y-auto pr-2 custom-scrollbar">
                {filteredFonts.map((f) => (
                    <button
                        key={f.name}
                        onClick={() => onSelect(f.name)}
                        onMouseEnter={() => setFontPreview(f.name)}
                        onMouseLeave={() => setFontPreview(null)}
                        className={cn(
                            "flex items-center justify-between px-5 py-4 rounded-2xl border transition-all duration-300 group relative overflow-hidden",
                            value === f.name
                                ? "bg-accent/15 border-accent/40 text-accent shadow-md ring-1 ring-accent/20"
                                : "bg-black/20 border-white/5 text-stone-400 hover:border-white/20 hover:bg-white/5"
                        )}
                    >
                        <div className="flex flex-col items-start relative z-10">
                            <span className="text-base font-medium tracking-tight" style={{ fontFamily: f.name }}>
                                <HighlightedText text={f.name} highlight={searchQuery} />
                            </span>
                            <div className="flex items-center gap-2 mt-1">
                                <span className="text-[9px] uppercase tracking-[0.15em] opacity-40 font-bold flex items-center gap-1.5">
                                    {f.source === 'system' ? <Laptop className="w-2.5 h-2.5" /> : <Monitor className="w-2.5 h-2.5" />}
                                    {f.category}
                                </span>
                                {f.tags?.includes('Cyrillic') && (
                                    <span className="text-[8px] uppercase tracking-wider bg-white/5 px-1.5 py-0.5 rounded text-white/40 font-bold">CYR</span>
                                )}
                            </div>
                        </div>
                        {value === f.name && (
                            <div className="p-1.5 rounded-full bg-accent text-accent-foreground shadow-lg animate-in zoom-in-50 duration-300 relative z-10">
                                <Check className="w-3 h-3" />
                            </div>
                        )}
                    </button>
                ))}
                {filteredFonts.length === 0 && !loadingSystemFonts && (
                    <div className="py-12 flex flex-col items-center justify-center gap-3 opacity-20">
                        <Search className="w-8 h-8" />
                        <span className="text-[10px] font-black uppercase tracking-widest">{t('no_fonts_found') || "No matching fonts"}</span>
                    </div>
                )}
                {loadingSystemFonts && filteredFonts.length === 0 && (
                    <div className="py-8 flex flex-col items-center justify-center gap-2 opacity-30">
                        <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                        <span className="text-[9px] uppercase tracking-widest font-black">Scanning System Fonts...</span>
                    </div>
                )}
            </div>
        </div>
    );
};

interface HighlightedTextProps {
    text: string;
    highlight: string;
}

const HighlightedText: React.FC<HighlightedTextProps> = ({ text, highlight }) => {
    const words = React.useMemo(() =>
        highlight.toLowerCase().trim().split(/\s+/).filter(Boolean)
        , [highlight]);

    if (words.length === 0) {
        return <>{text}</>;
    }

    const regex = new RegExp(`(${words.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi');
    const parts = text.split(regex);

    return (
        <>
            {parts.map((part, i) =>
                regex.test(part) ? (
                    <span key={i} className="text-accent underline underline-offset-4 decoration-accent/40">{part}</span>
                ) : (
                    <span key={i}>{part}</span>
                )
            )}
        </>
    );
};
