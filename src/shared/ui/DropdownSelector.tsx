import React, { useState, useRef } from 'react';
import { ChevronDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import ContextMenu, { ContextMenuItem } from './ContextMenu';
import { cn } from '@/core/utils/cn';

export interface DropdownOption {
    value: string;
    label: string;
    icon?: React.ReactNode;
}

interface DropdownSelectorProps {
    value: string;
    options: DropdownOption[];
    onChange: (value: string) => void;
    placeholder?: string;
    className?: string;
    icon?: React.ReactNode;
    /** Optional custom rendering for the selected label */
    renderSelected?: (selected: DropdownOption | undefined) => React.ReactNode;
}

/**
 * A premium, high-fidelity replacement for the native <select> element.
 * Uses the portal-based ContextMenu for a consistent, modern UI experience.
 */
export const DropdownSelector: React.FC<DropdownSelectorProps> = ({
    value,
    options,
    onChange,
    placeholder,
    className,
    icon,
    renderSelected
}) => {
    const { t } = useTranslation();
    const [menuPos, setMenuPos] = useState<{ x: number; y: number } | null>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);

    const activeOption = options.find(o => o.value === value);
    const displayPlaceholder = placeholder || t('select', 'Select...');

    const handleToggle = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (menuPos) {
            setMenuPos(null);
        } else {
            const rect = triggerRef.current?.getBoundingClientRect();
            if (rect) {
                // Ensure the menu doesn't go off context
                setMenuPos({ x: rect.left, y: rect.bottom + 4 });
            }
        }
    };

    return (
        <div className="relative w-full">
            <button
                ref={triggerRef}
                type="button"
                onClick={handleToggle}
                className={cn(
                    "w-full bg-black/40 border border-white/5 rounded-xl px-4 py-3 text-sm text-white flex items-center justify-between transition-all hover:bg-black/60 hover:border-white/10 group cursor-pointer outline-hidden focus-visible:ring-1 focus-visible:ring-accent/40",
                    menuPos && "border-accent/40 bg-accent/5 ring-1 ring-accent/20 shadow-[0_0_20px_rgba(234,179,8,0.05)]",
                    className
                )}
            >
                <div className="flex items-center gap-2.5 min-w-0">
                    {icon && <span className="text-stone-500 group-hover:text-accent transition-colors shrink-0">{icon}</span>}
                    <div className="truncate font-bold tracking-tight">
                        {renderSelected ? renderSelected(activeOption) : (activeOption?.label || displayPlaceholder)}
                    </div>
                </div>
                <ChevronDown className={cn(
                    "w-4 h-4 text-stone-600 transition-transform duration-300 shrink-0",
                    menuPos ? "rotate-180 text-accent" : "group-hover:text-stone-300"
                )} />
            </button>

            {menuPos && (
                <ContextMenu
                    x={menuPos.x}
                    y={menuPos.y}
                    onClose={() => setMenuPos(null)}
                >
                    <div className="max-h-[300px] overflow-y-auto no-scrollbar py-1 min-w-[180px]">
                        {options.length === 0 ? (
                            <div className="px-4 py-3 text-[10px] font-bold text-stone-600 uppercase tracking-widest text-center">
                                {t('no_options', 'No options available')}
                            </div>
                        ) : (
                            options.map((option) => (
                                <ContextMenuItem
                                    key={option.value}
                                    label={option.label}
                                    icon={option.icon}
                                    active={value === option.value}
                                    onClick={() => {
                                        onChange(option.value);
                                        setMenuPos(null);
                                    }}
                                />
                            ))
                        )}
                    </div>
                </ContextMenu>
            )}
        </div>
    );
};

export default DropdownSelector;

