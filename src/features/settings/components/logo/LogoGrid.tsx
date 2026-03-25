import React from 'react';
import { ILogo, ILogoGroup } from '@/core/types';
import { LogoCard } from './LogoCard';

export interface LogoGridProps {
    logos: ILogo[];
    activeLogoId: string | null;
    onSelect: (id: string) => void;
    onRemove?: (id: string) => void;
    allGroups: ILogoGroup[];
    onMove: (logoId: string, targetGroupId: string | null) => void;
}

export const LogoGrid: React.FC<LogoGridProps> = ({ logos, activeLogoId, onSelect, onRemove, allGroups, onMove }) => (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {logos.map((logo) => (
            <LogoCard
                key={logo.id}
                logo={logo}
                isActive={activeLogoId === logo.id}
                onSelect={() => onSelect(logo.id)}
                onRemove={onRemove ? () => onRemove(logo.id) : undefined}
                allGroups={allGroups}
                onMove={onMove}
            />
        ))}
    </div>
);
