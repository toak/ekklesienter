import React, { useState, useEffect, useMemo } from 'react';
import { IStyleLayer, BackgroundSettings, IBackgroundEntry } from '@/core/types';
import { cn } from '@/core/utils/cn';
import { db } from '@/core/db';
import { ensureLayers } from '@/core/utils/styleMigration';
import { mediaCache } from '@/core/utils/mediaCache';
import { isOpaqueNormalLayer } from '@/core/utils/blendEngine';

interface SlideBackgroundProps {
    background: IStyleLayer[] | BackgroundSettings | undefined;
    className?: string;
    showOverlay?: boolean; // Legacy overlay support
}

export const SlideBackground: React.FC<SlideBackgroundProps> = ({ background, className, showOverlay = false }) => {
    const layers = ensureLayers(background);

    /**
     * Occlusion optimization: find the top-most fully opaque Normal-mode layer.
     * All layers below it are completely hidden and don't need to be rendered.
     * This reduces DOM nodes and improves performance for stacks with opaque bases.
     */
    const visibleLayers = useMemo(() => {
        if (layers.length <= 1) return layers;

        // Layers are stored top-first (Index 0 = Top, Index N = Bottom).
        // Scan from top (index 0) to bottom.
        // The first opaque Normal layer we find means everything below it is occluded.
        for (let i = 0; i < layers.length; i++) {
            if (isOpaqueNormalLayer(layers[i])) {
                // This layer occludes everything below; keep layers[0..i] only
                return layers.slice(0, i + 1);
            }
        }
        return layers;
    }, [layers]);

    return (
        <div 
            className={cn("absolute inset-0 pointer-events-none overflow-hidden", className)}
            style={{ isolation: 'isolate' }}
        >
            {visibleLayers.map((layer, index) => (
                <LayerRenderer
                    key={layer.id || index}
                    layer={layer}
                    zIndex={(visibleLayers.length - index) * 10}
                />
            ))}
            {showOverlay && <div className="absolute inset-0 bg-black/40 z-50" />}
        </div>
    );
};

import { useLiveQuery } from 'dexie-react-hooks';

const LayerRenderer: React.FC<{ layer: IStyleLayer; zIndex: number }> = ({ layer, zIndex }) => {
    const [dbUrl, setDbUrl] = useState<string | null>(null);
    
    const mediaId = layer.type === 'image' ? layer.image?.id : layer.video?.id;
    const isFromDb = layer.type === 'image' ? layer.image?.isFromDb : layer.video?.isFromDb;

    const isRemote = !window.electron?.ipcRenderer;

    // Use live query to reactively wait for the media to appear in DB
    const bgEntry = useLiveQuery(
        async () => {
            if (isRemote || !isFromDb || !mediaId) return null;
            return await db.backgrounds.get(mediaId);
        },
        [mediaId, isFromDb, isRemote]
    );

    useEffect(() => {
        const updateUrl = async () => {
            if (isFromDb && mediaId) {
                // getBackgroundUrl will fetch from DB and put in cache if missing
                const url = await mediaCache.getBackgroundUrl(mediaId);
                setDbUrl(url);
            } else {
                setDbUrl(null);
            }
        };

        updateUrl();
    }, [mediaId, isFromDb, !!bgEntry]);

    if (layer.visible === false) return null;

    const adjustments = layer.adjustments || {
        brightness: 100, contrast: 100, exposure: 0,
        saturation: 100, vibrance: 0, hue: 0, blur: 0
    };

    // Calculate filter string
    // Exposure maps to a combination of brightness and contrast
    const brightness = (adjustments.brightness ?? 100) * (1 + ((adjustments.exposure ?? 0) / 100));
    const contrast = (adjustments.contrast ?? 100) * (1 + (Math.abs(adjustments.exposure ?? 0) / 200));

    const filterString = [
        `brightness(${brightness}%)`,
        `contrast(${contrast}%)`,
        `saturate(${(adjustments.saturation ?? 100) + (adjustments.vibrance ?? 0) * 0.5}%)`,
        `hue-rotate(${adjustments.hue ?? 0}deg)`,
        `blur(${adjustments.blur ?? 0}px)`,
    ].join(' ');

    const wrapperScale = (adjustments.blur || 0) > 0 ? 1 + ((adjustments.blur || 0) * 2.5) / 1000 : 1;

    const wrapperStyle: React.CSSProperties = {
        position: 'absolute',
        inset: 0,
        zIndex,
        opacity: layer.opacity,
        mixBlendMode: layer.blendMode as any,
    };

    const contentStyle: React.CSSProperties = {
        position: 'absolute',
        inset: 0,
        filter: filterString,
        transform: `scale(${wrapperScale})`,
        transformOrigin: 'center center',
    };

    const renderLayerContent = () => {
        const isFromDb = layer.type === 'image' ? layer.image?.isFromDb : layer.video?.isFromDb;
        const persistentUrl = (layer.type === 'image' ? layer.image?.url : layer.video?.url) || '';
        
        // If the media is from DB, we ONLY want to use the dbUrl (blob created from the DB blob).
        // On the Remote Controller (browser), dbUrl will be null because the local DB is empty.
        // We fallback to the persistentUrl if it's already been proxied (doesn't start with blob:)
        const isRemote = !window.electron?.ipcRenderer;
        const displayUrl = (isRemote && persistentUrl && !persistentUrl.startsWith('blob:')) 
            ? persistentUrl 
            : (dbUrl || (persistentUrl && !persistentUrl.startsWith('blob:') ? persistentUrl : null));
        
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
                const crop = layer.image?.crop;
                
                if (crop) {
                    return (
                        <div className="absolute inset-0 overflow-hidden">
                            <img
                                src={displayUrl}
                                className="absolute max-w-none max-h-none transition-all duration-500 object-cover min-w-full min-h-full"
                                style={{
                                    top: `-${(crop.y / crop.height) * 100}%`,
                                    left: `-${(crop.x / crop.width) * 100}%`,
                                    width: `${(100 / crop.width) * 100}%`,
                                    height: `${(100 / crop.height) * 100}%`,
                                    transform: `scale(${layer.media?.scale || 1})`,
                                    transformOrigin: 'center center'
                                }}
                                alt=""
                            />
                        </div>
                    );
                }

                return (
                    <img
                        src={displayUrl}
                        className={cn(
                            "w-full h-full transition-all duration-500",
                            layer.media?.framing === 'fit' ? "object-contain" : (layer.media?.framing === 'stretch' ? "object-fill" : "object-cover")
                        )}
                        style={{
                            transform: `scale(${layer.media?.scale || 1})`
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
                                    transform: `translate(-50%, -50%) scale(${layer.media?.scale || 1})`
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
                            transform: `scale(${layer.media?.scale || 1})`
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
        <div style={wrapperStyle}>
            <div style={contentStyle}>
                {renderLayerContent()}
            </div>
            {/* Per-layer Vignette Overlay */}
            {layer.adjustments?.dimmingOpacity !== undefined && layer.adjustments.dimmingOpacity > 0 && (
                <div
                    className="absolute inset-0"
                    style={{
                        background: `radial-gradient(
                            ${layer.adjustments.vignetteRadiusX ?? 50}% ${layer.adjustments.vignetteRadiusY ?? 50}% at 50% 50%, 
                            transparent 0%, 
                            transparent ${Math.max(0, 100 - (layer.adjustments.vignetteBlur ?? 50))}%,
                            ${layer.adjustments.dimmingColor || '#000'} 100%
                        )`,
                        opacity: layer.adjustments.dimmingOpacity
                    }}
                />
            )}
            
            {/* Per-layer Noise Overlay */}
            {layer.adjustments?.noise !== undefined && layer.adjustments.noise > 0 && (
                <div 
                    className="absolute inset-0 pointer-events-none mix-blend-overlay z-50"
                    style={{ opacity: layer.adjustments.noise / 100 }}
                >
                    <svg className="w-full h-full contrast-125 opacity-75">
                        <filter id={`bg-noise-${layer.id || Math.random().toString(36).substr(2, 9)}`}>
                            <feTurbulence type="fractalNoise" baseFrequency={Math.max(0.1, (layer.adjustments.noiseScale ?? 65) / 100)} numOctaves="3" stitchTiles="stitch" />
                            <feColorMatrix type="saturate" values="0" />
                            {layer.adjustments.noiseSoftness && layer.adjustments.noiseSoftness > 0 ? (
                                <feGaussianBlur stdDeviation={(layer.adjustments.noiseSoftness / 100) * 3} />
                            ) : null}
                        </filter>
                        <rect width="100%" height="100%" filter={`url(#bg-noise-${layer.id || Math.random().toString(36).substr(2, 9)})`} />
                    </svg>
                </div>
            )}
        </div>
    );
};
