import { db } from '@/core/db';
import { IStyleLayer, ISlide, ICanvasSlide } from '@/core/types';
import { ensureLayers } from '@/core/utils/styleMigration';
import { isOpaqueNormalLayer } from '@/core/utils/blendEngine';

/**
 * Service for generating lightweight thumbnails for presentations.
 */
export class ThumbnailService {
    /**
     * Generates a PNG thumbnail for the first slide of a presentation.
     * @param presentationId The ID of the presentation.
     * @returns A Promise resolving to a PNG Blob or null.
     */
    static async generate(presentationId: string): Promise<Blob | null> {
        try {
            const pres = await db.presentationFiles.get(presentationId);
            if (!pres || !pres.slides.length) return null;

            const firstSlide = pres.slides[0];
            const canvas = document.createElement('canvas');
            canvas.width = 480;
            canvas.height = 270;
            const ctx = canvas.getContext('2d');
            if (!ctx) return null;

            // 1. Render Background Layers (with occlusion optimization)
            const layers = this.getVisibleLayers(
                ensureLayers(firstSlide.type === 'normal' ? (firstSlide as ICanvasSlide).backgroundOverride : undefined)
            );
            for (const layer of layers) {
                if (!layer.visible) continue;
                await this.renderLayer(ctx, layer, canvas.width, canvas.height);
            }

            // 2. Add a semi-transparent title or icon if it's a "standard" slide
            // This helps identifying empty background-only slides in the library
            const canvasSlide = firstSlide.type === 'normal' ? firstSlide as ICanvasSlide : null;
            if (canvasSlide?.content?.variables?.title) {
                this.renderTextOverlay(ctx, String(canvasSlide.content.variables.title), canvas.width, canvas.height);
            }

            return new Promise((resolve) => canvas.toBlob(resolve, 'image/png', 0.8));
        } catch (error) {
            console.error('Failed to generate thumbnail:', error);
            return null;
        }
    }

    /**
     * Generates a PNG thumbnail for a template.
     * @param templateId The ID of the template.
     * @returns A Promise resolving to a PNG Blob or null.
     */
    static async generateFromTemplate(templateId: string): Promise<Blob | null> {
        try {
            const template = await db.templates.get(templateId);
            if (!template) return null;

            const canvas = document.createElement('canvas');
            canvas.width = 480;
            canvas.height = 270;
            const ctx = canvas.getContext('2d');
            if (!ctx) return null;

            // Render Template Background (with occlusion optimization)
            const layers = this.getVisibleLayers(ensureLayers(template.background));
            for (const layer of layers) {
                if (!layer.visible) continue;
                await this.renderLayer(ctx, layer, canvas.width, canvas.height);
            }

            // Add template name as overlay
            this.renderTextOverlay(ctx, template.name, canvas.width, canvas.height);

            return new Promise((resolve) => canvas.toBlob(resolve, 'image/png', 0.8));
        } catch (error) {
            console.error('Failed to generate template thumbnail:', error);
            return null;
        }
    }

    /**
     * Applies occlusion optimization: returns only the layers that are actually
     * visible (skips everything below a fully opaque Normal-mode layer).
     */
    private static getVisibleLayers(layers: IStyleLayer[]): IStyleLayer[] {
        if (layers.length <= 1) return layers;

        // Layers are stored top-first. Find the first opaque Normal layer.
        for (let i = 0; i < layers.length; i++) {
            if (isOpaqueNormalLayer(layers[i])) {
                return layers.slice(0, i + 1);
            }
        }
        return layers;
    }

    /**
     * Renders a style layer to the canvas context.
     * Supports solid colors, multi-stop/radial/conic gradients, images, and videos.
     */
    private static async renderLayer(ctx: CanvasRenderingContext2D, layer: IStyleLayer, width: number, height: number) {
        ctx.save();
        ctx.globalAlpha = layer.opacity ?? 1;

        if (layer.blendMode && layer.blendMode !== 'normal') {
            ctx.globalCompositeOperation = layer.blendMode as GlobalCompositeOperation;
        }

        if (layer.type === 'color' && layer.color) {
            ctx.fillStyle = layer.color;
            ctx.fillRect(0, 0, width, height);
        } else if (layer.type === 'gradient' && layer.gradient) {
            const gDef = layer.gradient;
            const angleRad = ((gDef.angle ?? 0) * Math.PI) / 180;
            const cx = width / 2;
            const cy = height / 2;
            const len = Math.max(width, height);

            let grad: CanvasGradient;
            if (gDef.type === 'radial') {
                grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, len / 2);
            } else {
                // Linear and conic (Canvas2D has no native conic, approximate with linear)
                grad = ctx.createLinearGradient(
                    cx - Math.cos(angleRad) * len,
                    cy - Math.sin(angleRad) * len,
                    cx + Math.cos(angleRad) * len,
                    cy + Math.sin(angleRad) * len,
                );
            }

            // Apply multi-stop or simple two-stop gradient
            if (gDef.stops && gDef.stops.length > 0) {
                gDef.stops.forEach(s => grad.addColorStop(
                    Math.max(0, Math.min(1, s.offset / 100)), s.color
                ));
            } else {
                grad.addColorStop(0, gDef.from);
                grad.addColorStop(1, gDef.to);
            }

            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, width, height);
        } else if (layer.type === 'image') {
            const mediaId = layer.image?.id;
            if (mediaId) {
                const entry = await db.backgrounds.get(mediaId);
                if (entry) {
                    const img = await this.loadImage(entry.data);
                    if (img) {
                        this.drawCover(ctx, img, width, height);
                    }
                }
            }
        } else if (layer.type === 'video') {
            // For video, draw a neutral dark placeholder
            ctx.fillStyle = 'rgba(0,0,0,0.4)';
            ctx.fillRect(0, 0, width, height);
        }

        // Apply per-layer adjustments (simplified for thumbnails)
        if (layer.adjustments?.dimmingOpacity && layer.adjustments.dimmingOpacity > 0) {
            ctx.globalAlpha = layer.adjustments.dimmingOpacity;
            ctx.fillStyle = layer.adjustments.dimmingColor || '#000000';
            ctx.fillRect(0, 0, width, height);
        }

        ctx.restore();
    }

    /**
     * Renders a simplified text overlay.
     */
    private static renderTextOverlay(ctx: CanvasRenderingContext2D, text: string, width: number, height: number) {
        ctx.save();
        ctx.font = '900 24px Inter, sans-serif';
        ctx.fillStyle = 'white';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = 'rgba(0,0,0,0.8)';
        ctx.shadowBlur = 4;

        // Wrap text if too long
        const maxWidth = width * 0.8;
        const words = text.split(' ');
        let line = '';
        let y = height / 2;

        if (text.length > 30) {
            // Very simple wrapping or just truncate
            ctx.fillText(text.substring(0, 30) + '...', width / 2, y);
        } else {
            ctx.fillText(text, width / 2, y);
        }

        ctx.restore();
    }

    private static loadImage(blob: Blob): Promise<HTMLImageElement | null> {
        return new Promise((resolve) => {
            const img = new Image();
            const url = URL.createObjectURL(blob);
            img.onload = () => {
                URL.revokeObjectURL(url);
                resolve(img);
            };
            img.onerror = () => {
                URL.revokeObjectURL(url);
                resolve(null);
            };
            img.src = url;
        });
    }

    private static drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement | HTMLVideoElement, width: number, height: number) {
        const sourceWidth = img instanceof HTMLImageElement ? img.width : img.videoWidth;
        const sourceHeight = img instanceof HTMLImageElement ? img.height : img.videoHeight;
        
        const imgRatio = sourceWidth / sourceHeight;
        const canvasRatio = width / height;
        let drawWidth, drawHeight, offsetX, offsetY;

        if (imgRatio > canvasRatio) {
            drawHeight = height;
            drawWidth = height * imgRatio;
            offsetX = (width - drawWidth) / 2;
            offsetY = 0;
        } else {
            drawWidth = width;
            drawHeight = width / imgRatio;
            offsetX = 0;
            offsetY = (height - drawHeight) / 2;
        }
        ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);
    }

    /**
     * Generates a sequence of thumbnails from a video for an animated history preview.
     */
    static async generateVideoSequence(mediaId: string, frames: number = 5): Promise<string[]> {
        return new Promise(async (resolve) => {
            try {
                const entry = await db.backgrounds.get(mediaId) || await db.mediaPool.get(mediaId);
                if (!entry || !entry.data) return resolve([]);

                const url = URL.createObjectURL(entry.data);
                const video = document.createElement('video');
                video.muted = true;
                video.src = url;

                video.onloadedmetadata = async () => {
                    const duration = video.duration;
                    const sequence: string[] = [];
                    const canvas = document.createElement('canvas');
                    canvas.width = 160; // Lightweight thumbs for history
                    canvas.height = 90;
                    const ctx = canvas.getContext('2d');
                    if (!ctx) return resolve([]);

                    const intervals = frames > 1 ? duration / (frames - 1) : 0;

                    for (let i = 0; i < frames; i++) {
                        video.currentTime = i * intervals;
                        await new Promise(r => {
                            const onSeeked = () => {
                                video.removeEventListener('seeked', onSeeked);
                                r(null);
                            };
                            video.onseeked = onSeeked;
                        });
                        
                        ctx.clearRect(0, 0, canvas.width, canvas.height);
                        this.drawCover(ctx, video, canvas.width, canvas.height);
                        sequence.push(canvas.toDataURL('image/jpeg', 0.6));
                    }

                    URL.revokeObjectURL(url);
                    resolve(sequence);
                };

                video.onerror = () => {
                    URL.revokeObjectURL(url);
                    resolve([]);
                };
            } catch (error) {
                console.error('Failed to generate video sequence:', error);
                resolve([]);
            }
        });
    }
}
