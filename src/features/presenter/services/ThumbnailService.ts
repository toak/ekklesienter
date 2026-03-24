import { db } from '@/core/db';
import { IStyleLayer, ISlide, ICanvasSlide } from '@/core/types';
import { ensureLayers } from '@/core/utils/styleMigration';

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

            // 1. Render Background Layers
            const layers = ensureLayers(firstSlide.type === 'normal' ? (firstSlide as ICanvasSlide).backgroundOverride : undefined);
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

            // Render Template Background
            const layers = ensureLayers(template.background);
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
     * Renders a style layer to the canvas context.
     */
    private static async renderLayer(ctx: CanvasRenderingContext2D, layer: IStyleLayer, width: number, height: number) {
        ctx.save();
        ctx.globalAlpha = layer.opacity ?? 1;

        // Simplistic blend mode mapping
        if (layer.blendMode && layer.blendMode !== 'normal') {
            ctx.globalCompositeOperation = layer.blendMode as GlobalCompositeOperation;
        }

        if (layer.type === 'color' && layer.color) {
            ctx.fillStyle = layer.color;
            ctx.fillRect(0, 0, width, height);
        } else if (layer.type === 'gradient' && layer.gradient) {
            const g = ctx.createLinearGradient(0, 0, 0, height);
            g.addColorStop(0, layer.gradient.from);
            g.addColorStop(1, layer.gradient.to);
            ctx.fillStyle = g;
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
            // For video, we just draw a neutral dark placeholder or attempt to show a frame if we had one
            ctx.fillStyle = 'rgba(0,0,0,0.4)';
            ctx.fillRect(0, 0, width, height);
        }

        // Apply basic adjustments (Simplified)
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

    private static drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, width: number, height: number) {
        const imgRatio = img.width / img.height;
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
}
