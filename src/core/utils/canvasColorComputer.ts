/**
 * @module canvasColorComputer
 *
 * Computes the rendered color at a specific point on a fill/stroke layer stack
 * by drawing all layers onto an OffscreenCanvas and reading the resulting pixel.
 *
 * This handles non-solid layers (gradients, images) that can't be resolved
 * by the pure-math blendEngine. Falls back gracefully when OffscreenCanvas
 * is unavailable.
 *
 * @see blendEngine.ts for the pure-math approach (faster, solid colors only)
 */

import { IStyleLayer } from '@/core/types';
import { findOcclusionCutoff, getComputedColor } from './blendEngine';

/** Default canvas size for color sampling (small = fast). */
const SAMPLE_SIZE = 4;

/**
 * Compute the rendered color at a specific normalized point (0-1)
 * by drawing all fill layers onto an OffscreenCanvas.
 *
 * @param fills - The layer stack (top-first order as stored in data model).
 * @param nx - Normalized X position (0-1), default center.
 * @param ny - Normalized Y position (0-1), default center.
 * @param width - Canvas width in pixels (higher = more accurate for gradients).
 * @param height - Canvas height in pixels.
 * @returns Hex color string (#RRGGBB) or null if computation fails.
 */
export const getComputedColorAtPoint = async (
  fills: IStyleLayer[],
  nx = 0.5,
  ny = 0.5,
  width = SAMPLE_SIZE,
  height = SAMPLE_SIZE,
): Promise<string | null> => {
  // Fast path: if all layers are solid colors, use the math engine
  const allSolid = fills.every(l => l.type === 'color' || l.visible === false);
  if (allSolid) {
    return getComputedColor(fills);
  }

  // OffscreenCanvas path
  try {
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Reverse for bottom-to-top rendering
    const ordered = [...fills].reverse();

    // Apply occlusion optimization
    const cutoff = findOcclusionCutoff(ordered);

    for (let i = cutoff; i < ordered.length; i++) {
      const layer = ordered[i];
      if (layer.visible === false) continue;

      ctx.save();
      ctx.globalAlpha = layer.opacity ?? 1;

      if (layer.blendMode && layer.blendMode !== 'normal') {
        ctx.globalCompositeOperation = layer.blendMode as GlobalCompositeOperation;
      }

      switch (layer.type) {
        case 'color':
          if (layer.color) {
            ctx.fillStyle = layer.color;
            ctx.fillRect(0, 0, width, height);
          }
          break;

        case 'gradient':
          if (layer.gradient) {
            const g = layer.gradient;
            const angleRad = ((g.angle ?? 0) * Math.PI) / 180;
            const cx = width / 2;
            const cy = height / 2;
            const len = Math.max(width, height);

            if (g.type === 'radial') {
              const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, len / 2);
              applyStops(grad, g);
              ctx.fillStyle = grad;
            } else if (g.type === 'conic') {
              // Conic gradients not supported in Canvas2D; approximate with linear
              const grad = ctx.createLinearGradient(
                cx - Math.cos(angleRad) * len,
                cy - Math.sin(angleRad) * len,
                cx + Math.cos(angleRad) * len,
                cy + Math.sin(angleRad) * len,
              );
              applyStops(grad, g);
              ctx.fillStyle = grad;
            } else {
              const grad = ctx.createLinearGradient(
                cx - Math.cos(angleRad) * len,
                cy - Math.sin(angleRad) * len,
                cx + Math.cos(angleRad) * len,
                cy + Math.sin(angleRad) * len,
              );
              applyStops(grad, g);
              ctx.fillStyle = grad;
            }
            ctx.fillRect(0, 0, width, height);
          }
          break;

        // Image/video layers require async loading — skip in fast path
        default:
          break;
      }

      ctx.restore();
    }

    // Sample the pixel at the requested point
    const px = Math.round(clamp(nx, 0, 1) * (width - 1));
    const py = Math.round(clamp(ny, 0, 1) * (height - 1));
    const data = ctx.getImageData(px, py, 1, 1).data;

    return `#${hex2(data[0])}${hex2(data[1])}${hex2(data[2])}`;
  } catch {
    // Fallback to math engine (solid colors only)
    return getComputedColor(fills);
  }
};

/**
 * Compute the average rendered color across the entire fill stack.
 * Useful for determining dominant color for contrast calculations.
 */
export const getAverageComputedColor = async (
  fills: IStyleLayer[],
  sampleSize = 8,
): Promise<string | null> => {
  try {
    const canvas = new OffscreenCanvas(sampleSize, sampleSize);
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const ordered = [...fills].reverse();
    const cutoff = findOcclusionCutoff(ordered);

    for (let i = cutoff; i < ordered.length; i++) {
      const layer = ordered[i];
      if (layer.visible === false) continue;

      ctx.save();
      ctx.globalAlpha = layer.opacity ?? 1;
      if (layer.blendMode && layer.blendMode !== 'normal') {
        ctx.globalCompositeOperation = layer.blendMode as GlobalCompositeOperation;
      }

      if (layer.type === 'color' && layer.color) {
        ctx.fillStyle = layer.color;
        ctx.fillRect(0, 0, sampleSize, sampleSize);
      } else if (layer.type === 'gradient' && layer.gradient) {
        const g = layer.gradient;
        const grad = ctx.createLinearGradient(0, 0, sampleSize, sampleSize);
        applyStops(grad, g);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, sampleSize, sampleSize);
      }

      ctx.restore();
    }

    // Average all pixels
    const data = ctx.getImageData(0, 0, sampleSize, sampleSize).data;
    let rSum = 0, gSum = 0, bSum = 0;
    const totalPixels = sampleSize * sampleSize;

    for (let i = 0; i < data.length; i += 4) {
      rSum += data[i];
      gSum += data[i + 1];
      bSum += data[i + 2];
    }

    return `#${hex2(Math.round(rSum / totalPixels))}${hex2(Math.round(gSum / totalPixels))}${hex2(Math.round(bSum / totalPixels))}`;
  } catch {
    return getComputedColor(fills);
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════

const applyStops = (
  grad: CanvasGradient,
  g: { from: string; to: string; stops?: { offset: number; color: string }[] },
) => {
  if (g.stops && g.stops.length > 0) {
    g.stops.forEach(s => grad.addColorStop(clamp(s.offset / 100, 0, 1), s.color));
  } else {
    grad.addColorStop(0, g.from);
    grad.addColorStop(1, g.to);
  }
};

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
const hex2 = (n: number): string => n.toString(16).padStart(2, '0');
