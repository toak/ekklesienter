import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    ChevronRight, Clock, MoveHorizontal,
    ArrowUp, ArrowDown, ArrowLeft, ArrowRight,
    Maximize, Minimize, Minus, Settings2, HelpCircle, ArrowRightLeft
} from 'lucide-react';
import { usePresentationStore } from '@/features/presenter/store/presentationStore';
import { cn } from '@/core/utils/cn';
import { ISlide, ISlideTransition, TransitionDirection, ICanvasSlide } from '@/core/types';
import { TRANSITIONS, TRANSITION_CATEGORIES } from '../../constants/transitions';
import { ScrubbableInput } from '../slide-properties/ScrubbableInput';
import { PropertySection } from '../slide-properties/PropertySection';

interface TransitionTabContentProps {
    selectedSlide?: ISlide; // Optional if editing presentation-level transition
    transition?: ISlideTransition;
    onUpdate: (transition: ISlideTransition | undefined) => Promise<void>;
    triggerTransitionPreview: () => void;
}

const EMPTY_SLIDES: ISlide[] = [];

export const TransitionTabContent: React.FC<TransitionTabContentProps> = ({
    selectedSlide,
    transition: passedTransition,
    onUpdate,
    triggerTransitionPreview,
}) => {
    const { t } = useTranslation();
    const slides = usePresentationStore(s => s.activePresentation?.slides || s.selectedPresentation?.slides || EMPTY_SLIDES);
    const currentIndex = selectedSlide ? slides.findIndex(s => s.id === selectedSlide.id) : -1;
    const prevSlide = currentIndex > 0 ? slides[currentIndex - 1] : (currentIndex === 0 ? null : (slides.length > 0 ? slides[slides.length - 1] : null));

    const [hoveredTransitionId, setHoveredTransitionId] = useState<string | null>(null);
    const currentTransition = passedTransition || (selectedSlide?.type === 'normal' ? (selectedSlide as ICanvasSlide).transition : undefined) || { type: 'none', duration: 0.5 };

    const handleTypeChange = (type: string) => {
        onUpdate({
            ...currentTransition,
            type,
        });
        triggerTransitionPreview();
    };

    const handleDurationChange = (duration: number) => {
        onUpdate({
            ...currentTransition,
            duration,
        });
        triggerTransitionPreview();
    };

    const handleDirectionChange = (direction: TransitionDirection) => {
        onUpdate({
            ...currentTransition,
            direction,
        });
        triggerTransitionPreview();
    };

    // Groups transitions by category
    const groupedTransitions = TRANSITION_CATEGORIES.map(cat => ({
        ...cat,
        items: TRANSITIONS.filter(tr => tr.category === cat.id)
    }));

    const directions: { id: TransitionDirection; icon: React.ElementType; label: string }[] = [
        { id: 'top', icon: ArrowUp, label: t('direction.top', 'Top') },
        { id: 'right', icon: ArrowRight, label: t('direction.right', 'Right') },
        { id: 'bottom', icon: ArrowDown, label: t('direction.bottom', 'Bottom') },
        { id: 'left', icon: ArrowLeft, label: t('direction.left', 'Left') },
        { id: 'in', icon: Maximize, label: t('direction.in', 'In') },
        { id: 'out', icon: Minimize, label: t('direction.out', 'Out') },
    ];

    const supportsDirection = (type: string) => {
        return ['slide', 'push', 'pan', 'zoom'].includes(type);
    };

    return (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
            {/* ═══ Transition Context Header ═══ */}
            <div className="bg-accent/5 border border-accent/20 rounded-2xl p-4 flex items-center justify-between shadow-sm">
                <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-black text-accent/60 uppercase tracking-widest">{t('edit_transition', 'Edit Transition')}</span>
                    <div className="flex items-center gap-3">
                        <div className="flex flex-col">
                            <span className="text-xs font-bold text-stone-300">{prevSlide ? `${t('slide', 'Slide')} ${prevSlide.order + 1}` : t('start', 'Start')}</span>
                        </div>
                        <ArrowRightLeft className="w-4 h-4 text-accent animate-pulse" />
                        <div className="flex flex-col">
                            <span className="text-xs font-bold text-white">{t('slide', 'Slide')} {(selectedSlide?.order ?? 0) + 1}</span>
                        </div>
                    </div>
                </div>
                <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center border border-accent/20">
                    <ArrowRightLeft className="w-5 h-5 text-accent" />
                </div>
            </div>

            {/* ═══ Settings Section ═══ */}
            <PropertySection title={t('transition_settings', 'Transition Settings')} icon={Settings2}>
                <div className="space-y-4">
                    <div className="grid grid-cols-[1fr_auto] gap-4 items-center">
                        <div className="space-y-1.5">
                            <div className="flex items-center gap-2 px-1">
                                <Clock className="w-3 h-3 text-stone-500" />
                                <span className="text-[9px] font-bold text-stone-500 uppercase tracking-widest">{t('duration', 'Duration')}</span>
                            </div>
                            <ScrubbableInput
                                label=""
                                name="Duration"
                                value={currentTransition.duration}
                                onChange={handleDurationChange}
                                min={0.1}
                                max={10}
                                step={0.1}
                                formatter={React.useMemo(() => (v: number) => `${(v as number).toFixed(1)}s`, [])}
                                className="h-10 text-lg font-black bg-black/40 border-white/5"
                            />
                        </div>

                        {supportsDirection(currentTransition.type) && (
                            <div className="space-y-1.5">
                                <div className="flex items-center gap-2 px-1">
                                    <MoveHorizontal className="w-3 h-3 text-stone-500" />
                                    <span className="text-[9px] font-bold text-stone-500 uppercase tracking-widest">{t('direction', 'Direction')}</span>
                                </div>
                                <div className="grid grid-cols-3 gap-1 bg-black/40 p-1.5 rounded-xl border border-white/5">
                                    {directions.map(({ id, icon: Icon, label }) => (
                                        <button
                                            key={id}
                                            onClick={() => handleDirectionChange(id)}
                                            className={cn(
                                                "w-8 h-8 flex items-center justify-center rounded-lg transition-all cursor-pointer",
                                                currentTransition.direction === id || (!currentTransition.direction && id === 'right')
                                                    ? "bg-accent/20 text-accent border border-accent/30 shadow-[0_0_10px_rgba(234,179,8,0.1)]"
                                                    : "text-stone-500 hover:bg-white/5 hover:text-stone-300 border border-transparent"
                                            )}
                                            title={label}
                                        >
                                            <Icon className="w-4 h-4" />
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </PropertySection>

            {/* ═══ Categories ═══ */}
            <div className="space-y-2">
                {/* None Option */}
                <button
                    onClick={() => handleTypeChange('none')}
                    className={cn(
                        "w-full flex items-center gap-3 p-3 rounded-2xl border transition-all duration-200 group cursor-pointer",
                        currentTransition.type === 'none'
                            ? "bg-accent/10 border-accent/20 text-accent"
                            : "bg-black/40 border-white/5 text-stone-500 hover:bg-white/5 hover:border-white/10 hover:text-stone-300"
                    )}
                >
                    <div className={cn(
                        "w-8 h-8 rounded-xl flex items-center justify-center border transition-colors",
                        currentTransition.type === 'none' ? "bg-accent/20 border-accent/30" : "bg-black/20 border-white/5"
                    )}>
                        <Minus className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-bold uppercase tracking-widest">{t('no_transition', 'No Transition')}</span>
                </button>

                {groupedTransitions.map(group => (
                    <PropertySection
                        key={group.id}
                        title={t(`transition_category.${group.id}`, group.name)}
                        icon={group.icon || HelpCircle}
                        defaultOpen={group.items.some(tr => tr.id === currentTransition.type)}
                    >
                        <div className="grid grid-cols-1 gap-1">
                            {group.items.map(tr => (
                                <button
                                    key={tr.id}
                                    onClick={() => handleTypeChange(tr.id)}
                                    onMouseEnter={() => setHoveredTransitionId(tr.id)}
                                    onMouseLeave={() => setHoveredTransitionId(null)}
                                    className={cn(
                                        "flex items-center justify-between p-2 rounded-xl transition-all duration-200 group text-left cursor-pointer",
                                        currentTransition.type === tr.id
                                            ? "bg-accent/10 text-accent"
                                            : "hover:bg-white/5 text-stone-400 hover:text-stone-200"
                                    )}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={cn(
                                            "w-7 h-7 rounded-lg flex items-center justify-center border transition-all duration-300",
                                            currentTransition.type === tr.id ? "bg-accent/20 border-accent/30" : "bg-black/20 border-white/5"
                                        )}>
                                            {tr.icon ? <tr.icon className="w-3.5 h-3.5" /> : <div className="w-1 h-1 rounded-full bg-current opacity-40" />}
                                        </div>
                                        <div className="flex flex-col min-w-0">
                                            <div className="text-[11px] font-bold truncate tracking-tight">{t(`transition_name.${tr.id}`, tr.name)}</div>
                                            <div className="text-[9px] opacity-40 truncate">{t(`transition_desc.${tr.id}`, tr.desc)}</div>
                                        </div>
                                    </div>
                                    <ChevronRight className={cn(
                                        "w-3 h-3 transition-all duration-300 shrink-0",
                                        currentTransition.type === tr.id ? "translate-x-0 opacity-100" : "-translate-x-2 opacity-0 group-hover:translate-x-0 group-hover:opacity-100"
                                    )} />
                                </button>
                            ))}
                        </div>
                    </PropertySection>
                ))}
            </div>
        </div>
    );
};
