import React from 'react';
import { SlideBackground } from '../display/SlideBackground';
import { FloatingPopover } from '@/components/FloatingPopover';
import { BackgroundPicker } from '../slide-properties/BackgroundPicker';
import { ensureLayers } from '@/core/utils/styleMigration';
import { IStyleLayer } from '@/core/types';

interface ITimerFillPickerProps {
    label: string;
    fill: IStyleLayer[] | undefined;
    defaultColor?: string;
    onChange: (fill: IStyleLayer[]) => void;
}

export const TimerFillPicker: React.FC<ITimerFillPickerProps> = ({ label, fill, defaultColor = '#1c1917', onChange }) => {
    const [isOpen, setIsOpen] = React.useState(false);
    const triggerRef = React.useRef<HTMLDivElement>(null);
    const layers = ensureLayers(fill);

    const effectiveLayers: IStyleLayer[] = layers.length > 0 ? layers : [{
        id: crypto.randomUUID(),
        type: 'color' as const,
        visible: true,
        opacity: 1,
        blendMode: 'normal',
        color: defaultColor,
        adjustments: { brightness: 100, contrast: 100, exposure: 0, saturation: 100, vibrance: 0, hue: 0, blur: 0 }
    }];

    return (
        <div
            ref={triggerRef}
            onClick={() => setIsOpen(true)}
            className="flex items-center justify-between bg-black/20 p-3 rounded-2xl border border-white/5 hover:border-white/10 hover:bg-black/30 transition-all cursor-pointer group"
        >
            <span className="text-[10px] font-bold uppercase tracking-widest text-stone-500 group-hover:text-stone-300 transition-colors">{label}</span>
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl border border-white/10 shrink-0 shadow-inner relative overflow-hidden bg-stone-900 group-hover:scale-105 transition-transform">
                    <SlideBackground background={effectiveLayers} />
                </div>
            </div>

            <FloatingPopover
                isOpen={isOpen}
                onClose={() => setIsOpen(false)}
                anchorRef={triggerRef}
                title={label}
                width={320}
            >
                <div className="h-[450px]">
                    <BackgroundPicker
                        background={effectiveLayers}
                        onChange={onChange}
                        hideLayerStack={true}
                    />
                </div>
            </FloatingPopover>
        </div>
    );
};
