import React, { useState, useEffect } from 'react';
import { IStyleLayer, BackgroundSettings, IBackgroundEntry } from '@/core/types';
import { cn } from '@/core/utils/cn';
import { db } from '@/core/db';
import { ensureLayers } from '@/core/utils/styleMigration';
import { mediaCache } from '@/core/utils/mediaCache';

interface SlideBackgroundProps {
    background: IStyleLayer[] | BackgroundSettings | undefined;
    className?: string;
    showOverlay?: boolean; // Legacy overlay support
}

export const SlideBackground: React.FC<SlideBackgroundProps> = ({ background, className, showOverlay = false }) => {
    const layers = ensureLayers(background);

    return (
        <div className={cn("absolute inset-0 pointer-events-none overflow-hidden", className)}>
            {layers.map((layer, index) => (
                <LayerRenderer
                    key={layer.id || index}
                    layer={layer}
                    zIndex={index}
                />
            ))}
            {showOverlay && <div className="absolute inset-0 bg-black/40 z-50" />}
        </div>
    );
};

const LayerRenderer: React.FC<{ layer: IStyleLayer; zIndex: number }> = ({ layer, zIndex }) => {
    const [dbUrl, setDbUrl] = useState<string | null>(null);

    useEffect(() => {
        const loadFromDb = async () => {
            const mediaId = layer.type === 'image' ? layer.image?.id : layer.video?.id;
            const isFromDb = layer.type === 'image' ? layer.image?.isFromDb : layer.video?.isFromDb;

            if (isFromDb && mediaId) {
                const url = await mediaCache.getBackgroundUrl(mediaId);
                setDbUrl(url);
            } else {
                setDbUrl(null);
            }
        };

        loadFromDb();

        return () => {
            // mediaCache handles lifecycle, we don't revoke here to allow reuse
        };
    }, [layer.type, layer.image?.id, layer.image?.isFromDb, layer.video?.id, layer.video?.isFromDb]);

    if (!layer.visible) return null;

    const adjustments = layer.adjustments || {
        brightness: 100, contrast: 100, exposure: 0,
        saturation: 100, vibrance: 0, hue: 0, blur: 0
    };

    // Calculate filter string
    // Exposure maps to a combination of brightness and contrast
    const brightness = (adjustments.brightness || 100) * (1 + ((adjustments.exposure || 0) / 100));
    const contrast = (adjustments.contrast || 100) * (1 + (Math.abs(adjustments.exposure || 0) / 200));

    const filterString = [
        `brightness(${brightness}%)`,
        `contrast(${contrast}%)`,
        `saturate(${(adjustments.saturation || 100) + (adjustments.vibrance || 0) * 0.5}%)`,
        `hue-rotate(${adjustments.hue || 0}deg)`,
        `blur(${adjustments.blur || 0}px)`,
    ].join(' ');

    const style: React.CSSProperties = {
        position: 'absolute',
        inset: 0,
        zIndex,
        opacity: layer.opacity,
        mixBlendMode: layer.blendMode as any,
        filter: filterString,
    };

    const renderLayerContent = () => {
        const isFromDb = layer.type === 'image' ? layer.image?.isFromDb : layer.video?.isFromDb;
        const persistentUrl = (layer.type === 'image' ? layer.image?.url : layer.video?.url) || '';
        
        // If the media is from DB, we ONLY want to use the dbUrl (blob created from the DB blob).
        // Using a persistent 'blob:' URL is always wrong because it's session-specific.
        const displayUrl = dbUrl || (persistentUrl.startsWith('blob:') ? null : persistentUrl);

        switch (layer.type) {
            case 'color':
                return <div className="w-full h-full" style={{ backgroundColor: layer.color }} />;
            case 'gradient':
                return (
                    <div
                        className="w-full h-full"
                        style={{
                            background: layer.gradient?.cssGradient || `linear-gradient(${layer.gradient?.angle}deg, ${layer.gradient?.from}, ${layer.gradient?.to})`
                        }}
                    />
                );
            case 'image':
                if (!displayUrl) return null;
                return (
                    <img
                        src={displayUrl}
                        className={cn(
                            "w-full h-full transition-all duration-500",
                            layer.media?.framing === 'fit' ? "object-contain" : (layer.media?.framing === 'stretch' ? "object-fill" : "object-cover")
                        )}
                        style={{
                            transform: `scale(${(layer.adjustments?.blur || 0) > 0 ? 1.05 : 1} * ${layer.media?.scale || 1})`
                        }}
                        alt=""
                    />
                );
            case 'video':
                if (layer.video?.source === 'youtube') {
                    return (
                        <div className="absolute inset-0 overflow-hidden">
                            <iframe
                                src={`https://www.youtube.com/embed/${layer.video?.id}?autoplay=1&mute=1&controls=0&loop=1&playlist=${layer.video?.id}&rel=0&showinfo=0`}
                                className="w-[300%] h-[300%] absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                                allow="autoplay; encrypted-media"
                                style={{
                                    transform: `translate(-50%, -50%) scale(${(layer.adjustments?.blur || 0) > 0 ? 1.05 : 1} * ${layer.media?.scale || 1})`
                                }}
                            />
                        </div>
                    );
                }
                if (!displayUrl) return null;
                return (
                    <video
                        src={displayUrl}
                        autoPlay
                        muted={layer.video?.isMuted ?? layer.media?.isMuted}
                        loop={layer.video?.isLooping ?? layer.media?.isLooping}
                        className={cn(
                            "w-full h-full transition-all duration-500",
                            layer.media?.framing === 'fit' ? "object-contain" : (layer.media?.framing === 'stretch' ? "object-fill" : "object-cover")
                        )}
                        style={{
                            transform: `scale(${(layer.adjustments?.blur || 0) > 0 ? 1.05 : 1} * ${layer.media?.scale || 1})`
                        }}
                        ref={(el) => {
                            if (el && layer.media?.speed) {
                                el.playbackRate = layer.media.speed;
                            }
                        }}
                    />
                );
            case 'noise':
                return (
                    <div className="w-full h-full opacity-20 contrast-150 brightness-150 pointer-events-none">
                        <svg className="w-full h-full">
                            <filter id="noiseFilter">
                                <feTurbulence
                                    type="fractalNoise"
                                    baseFrequency="0.65"
                                    numOctaves="3"
                                    stitchTiles="stitch"
                                />
                            </filter>
                            <rect width="100%" height="100%" filter="url(#noiseFilter)" />
                        </svg>
                    </div>
                );
            default:
                return null;
        }
    };

    return (
        <div style={style}>
            {renderLayerContent()}
            {/* Per-layer Dimming Overlay */}
            {layer.adjustments?.dimmingOpacity !== undefined && layer.adjustments.dimmingOpacity > 0 && (
                <div
                    className="absolute inset-0"
                    style={{
                        backgroundColor: layer.adjustments.dimmingColor || '#000',
                        opacity: layer.adjustments.dimmingOpacity
                    }}
                />
            )}
        </div>
    );
};
