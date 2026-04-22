import React, { useState, useEffect } from 'react';
import { IAudioScope } from '@/core/types';
import { db } from '@/core/db';
import { audioService } from '@/features/presenter/services/AudioService';
import { useTranslation } from 'react-i18next';

interface AudioWaveformProps {
    scope: IAudioScope;
    updateAudioScope: (id: string, updates: Partial<IAudioScope>) => void;
}

export const AudioWaveform: React.FC<AudioWaveformProps> = ({ scope, updateAudioScope }) => {
    const { t } = useTranslation();
    const [waveform, setWaveform] = useState<number[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [hasError, setHasError] = useState(false);

    useEffect(() => {
        let isMounted = true;
        const fetchWaveform = async () => {
            setIsLoading(true);
            setHasError(false);
            
            // Fetch significantly more points for a dense "Telegram" look
            const points = await audioService.getWaveform(scope.fileId, 120);
            
            if (!isMounted) return;
            
            setIsLoading(false);
            if (points) {
                setWaveform(points);
            } else {
                // Resolution logic moved from AudioScopeBlock for cleaner SRP
                let exists = await db.mediaPool.get(scope.fileId);
                if (!exists) {
                    exists = await db.mediaPool.where('path').equals(scope.fileId).first();
                }
                
                if (!exists && scope.fileName) {
                    exists = await db.mediaPool.where('name').equals(scope.fileName).first();
                    if (!exists) {
                        exists = await db.mediaPool.where('name').equals(scope.fileName.normalize('NFC')).first();
                    }
                }
                
                if (exists) {
                    setWaveform([]); // File found, just no waveform data
                } else {
                    setHasError(true);
                    // Attempt auto-repair if file is missing
                    try {
                        const normalizedName = scope.fileName?.normalize('NFC');
                        let match = await db.mediaPool.where('name').equals(scope.fileName || '').first();
                        if (!match && normalizedName) {
                            match = await db.mediaPool.where('name').equals(normalizedName).first();
                        }
                        
                        if (match && match.path !== scope.fileId) {
                            updateAudioScope(scope.id, { fileId: match.id || match.path });
                        }
                    } catch (e) {
                        // Silent fallback
                    }
                }
            }
        };

        fetchWaveform();
        return () => { isMounted = false; };
    }, [scope.fileId, scope.fileName, scope.id, updateAudioScope]);

    return (
        <svg className="absolute inset-0 w-full h-full opacity-30 text-purple-400" preserveAspectRatio="none" viewBox="0 0 100 100">
            {/* Fade In Region */}
            {(scope.crossfadeSettings?.fadeInDuration ?? 0) > 0 && (
                <path
                    d={`M 0 100 L ${Math.min(25, (scope.crossfadeSettings?.fadeInDuration || 0) * 8)} 100 L 0 0 Z`}
                    fill="currentColor"
                    className="text-amber-400 opacity-60"
                />
            )}
            {/* Fade Out Region */}
            {(scope.crossfadeSettings?.fadeOutDuration ?? 0) > 0 && (
                <path
                    d={`M 100 100 L ${Math.max(75, 100 - (scope.crossfadeSettings?.fadeOutDuration || 0) * 8)} 100 L 100 0 Z`}
                    fill="currentColor"
                    className="text-amber-400 opacity-60"
                />
            )}
            {waveform.length > 0 ? (
                <g className="text-purple-300">
                    {waveform.map((val, i) => {
                        const x = (i / (waveform.length - 1)) * 100;
                        const barWidth = 0.5;
                        const minHeight = 2;
                        const h = Math.max(minHeight, val * 60);
                        const y = 50 - h / 2;
                        return (
                            <rect
                                key={i}
                                x={x}
                                y={y}
                                width={barWidth}
                                height={h}
                                rx={barWidth / 2}
                                fill="currentColor"
                                className="transition-all duration-300"
                                style={{ opacity: 0.3 + (val * 0.5) }}
                            />
                        );
                    })}
                </g>
            ) : (
                <line x1="0" y1="50" x2="100" y2="50" stroke="currentColor" strokeWidth="0.5" opacity="0.3" strokeDasharray="1 2" />
            )}
        </svg>
    );
};
