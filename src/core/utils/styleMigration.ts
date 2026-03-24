import { BackgroundSettings, IStyleLayer } from '../types';

/**
 * Migrates legacy BackgroundSettings to the new IStyleLayer array format.
 */
export const migrateBackgroundToLayers = (bg: BackgroundSettings | undefined): IStyleLayer[] => {
    if (!bg) return [];

    const layer: IStyleLayer = {
        id: 'legacy-layer-1',
        type: bg.type,
        visible: true,
        opacity: 1,
        blendMode: 'normal',
        color: bg.color,
        gradient: bg.gradient,
        image: bg.image,
        video: bg.video,
        adjustments: {
            brightness: 100,
            contrast: 100,
            exposure: 0,
            saturation: 100,
            vibrance: 0,
            hue: 0,
            blur: bg.blur || 0,
            dimmingColor: '#000000',
            dimmingOpacity: 0
        },
        media: {
            speed: 1,
            isLooping: bg.video?.isLooping ?? true,
            framing: 'fill',
            scale: 1
        }
    };

    return [layer];
};

/**
 * Ensures that the input is an array of layers, migrating if necessary.
 */
export const ensureLayers = (layers: IStyleLayer[] | BackgroundSettings | undefined): IStyleLayer[] => {
    if (Array.isArray(layers)) return layers;
    return migrateBackgroundToLayers(layers as BackgroundSettings);
};
