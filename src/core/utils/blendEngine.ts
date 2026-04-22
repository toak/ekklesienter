/**
 * @module blendEngine
 *
 * Pure-math implementation of CSS blend modes and Porter-Duff alpha compositing.
 * Used for programmatic computation of the final rendered color from a stack of
 * fill/stroke layers — e.g. contrast checking, accessibility, color export.
 *
 * All blending is performed in **linear RGB** space to avoid gamma-related
 * artifacts; sRGB ↔ linear conversions are applied at the boundary.
 *
 * @see https://www.w3.org/TR/compositing-1/
 */

import { IStyleLayer } from '@/core/types';

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

/** RGBA color in **linear** (pre-gamma) space, channels 0-1. */
export interface RGBA {
  r: number;
  g: number;
  b: number;
  a: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// sRGB ↔ Linear Conversion
// ═══════════════════════════════════════════════════════════════════════════

/** Convert a single sRGB channel (0-1) to linear. */
const srgbToLinear = (c: number): number =>
  c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);

/** Convert a single linear channel (0-1) to sRGB. */
const linearToSrgb = (c: number): number =>
  c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1.0 / 2.4) - 0.055;

// ═══════════════════════════════════════════════════════════════════════════
// Color Parsing / Serialization
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Parse a hex color string (#RGB, #RRGGBB, #RRGGBBAA) into linear RGBA.
 * Applies optional extra opacity multiplier (e.g. layer opacity).
 */
export const hexToLinearRGBA = (hex: string, opacity = 1): RGBA => {
  let r = 0, g = 0, b = 0, a = 1;
  const h = hex.replace('#', '');

  if (h.length === 3) {
    r = parseInt(h[0] + h[0], 16) / 255;
    g = parseInt(h[1] + h[1], 16) / 255;
    b = parseInt(h[2] + h[2], 16) / 255;
  } else if (h.length === 6 || h.length === 8) {
    r = parseInt(h.substring(0, 2), 16) / 255;
    g = parseInt(h.substring(2, 4), 16) / 255;
    b = parseInt(h.substring(4, 6), 16) / 255;
    if (h.length === 8) {
      a = parseInt(h.substring(6, 8), 16) / 255;
    }
  }

  return {
    r: srgbToLinear(r),
    g: srgbToLinear(g),
    b: srgbToLinear(b),
    a: a * opacity,
  };
};

/**
 * Parse an `rgba(r,g,b,a)` or `rgb(r,g,b)` CSS string into linear RGBA.
 */
export const cssToLinearRGBA = (css: string, opacity = 1): RGBA => {
  const match = css.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\s*\)/);
  if (!match) return hexToLinearRGBA('#000000', opacity);

  return {
    r: srgbToLinear(parseInt(match[1]) / 255),
    g: srgbToLinear(parseInt(match[2]) / 255),
    b: srgbToLinear(parseInt(match[3]) / 255),
    a: (match[4] !== undefined ? parseFloat(match[4]) : 1) * opacity,
  };
};

/** Serialize linear RGBA back to an sRGB hex string (#RRGGBB). */
export const linearRGBAToHex = (rgba: RGBA): string => {
  const r = Math.round(linearToSrgb(clamp01(rgba.r)) * 255);
  const g = Math.round(linearToSrgb(clamp01(rgba.g)) * 255);
  const b = Math.round(linearToSrgb(clamp01(rgba.b)) * 255);
  return `#${hex2(r)}${hex2(g)}${hex2(b)}`;
};

/** Serialize linear RGBA to `rgba()` CSS string. */
export const linearRGBAToCSS = (rgba: RGBA): string => {
  const r = Math.round(linearToSrgb(clamp01(rgba.r)) * 255);
  const g = Math.round(linearToSrgb(clamp01(rgba.g)) * 255);
  const b = Math.round(linearToSrgb(clamp01(rgba.b)) * 255);
  return `rgba(${r}, ${g}, ${b}, ${Math.round(rgba.a * 100) / 100})`;
};

// ═══════════════════════════════════════════════════════════════════════════
// Blend Mode Implementations (per-channel, linear space)
// https://www.w3.org/TR/compositing-1/#blending
// ═══════════════════════════════════════════════════════════════════════════

type BlendFn = (cb: number, cs: number) => number;

const blendNormal: BlendFn = (_cb, cs) => cs;
const blendMultiply: BlendFn = (cb, cs) => cb * cs;
const blendScreen: BlendFn = (cb, cs) => cb + cs - cb * cs;
const blendOverlay: BlendFn = (cb, cs) =>
  cb <= 0.5 ? 2 * cb * cs : 1 - 2 * (1 - cb) * (1 - cs);
const blendDarken: BlendFn = (cb, cs) => Math.min(cb, cs);
const blendLighten: BlendFn = (cb, cs) => Math.max(cb, cs);
const blendColorDodge: BlendFn = (cb, cs) =>
  cb === 0 ? 0 : cs === 1 ? 1 : Math.min(1, cb / (1 - cs));
const blendColorBurn: BlendFn = (cb, cs) =>
  cb === 1 ? 1 : cs === 0 ? 0 : 1 - Math.min(1, (1 - cb) / cs);
const blendHardLight: BlendFn = (cb, cs) =>
  cs <= 0.5 ? 2 * cb * cs : 1 - 2 * (1 - cb) * (1 - cs);
const blendSoftLight: BlendFn = (cb, cs) => {
  if (cs <= 0.5) {
    return cb - (1 - 2 * cs) * cb * (1 - cb);
  }
  const d = cb <= 0.25
    ? ((16 * cb - 12) * cb + 4) * cb
    : Math.sqrt(cb);
  return cb + (2 * cs - 1) * (d - cb);
};
const blendDifference: BlendFn = (cb, cs) => Math.abs(cb - cs);
const blendExclusion: BlendFn = (cb, cs) => cb + cs - 2 * cb * cs;

// ═══════════════════════════════════════════════════════════════════════════
// Non-separable blend modes (HSL-based)
// https://www.w3.org/TR/compositing-1/#blendingnonseparable
// ═══════════════════════════════════════════════════════════════════════════

const lum = (r: number, g: number, b: number) => 0.299 * r + 0.587 * g + 0.114 * b;
const sat = (r: number, g: number, b: number) => Math.max(r, g, b) - Math.min(r, g, b);

const clipColor = (r: number, g: number, b: number): [number, number, number] => {
  const l = lum(r, g, b);
  const n = Math.min(r, g, b);
  const x = Math.max(r, g, b);
  let cr = r, cg = g, cb = b;

  if (n < 0) {
    cr = l + (cr - l) * l / (l - n);
    cg = l + (cg - l) * l / (l - n);
    cb = l + (cb - l) * l / (l - n);
  }
  if (x > 1) {
    cr = l + (cr - l) * (1 - l) / (x - l);
    cg = l + (cg - l) * (1 - l) / (x - l);
    cb = l + (cb - l) * (1 - l) / (x - l);
  }

  return [cr, cg, cb];
};

const setLum = (r: number, g: number, b: number, l: number): [number, number, number] => {
  const d = l - lum(r, g, b);
  return clipColor(r + d, g + d, b + d);
};

const setSat = (r: number, g: number, b: number, s: number): [number, number, number] => {
  const channels = [
    { val: r, i: 0 },
    { val: g, i: 1 },
    { val: b, i: 2 },
  ].sort((a, b) => a.val - b.val);

  const result = [0, 0, 0];

  if (channels[2].val - channels[0].val > 0) {
    result[channels[1].i] =
      ((channels[1].val - channels[0].val) * s) /
      (channels[2].val - channels[0].val);
    result[channels[2].i] = s;
  }
  result[channels[0].i] = 0;

  return result as [number, number, number];
};

// ═══════════════════════════════════════════════════════════════════════════
// Blend Mode Dispatch
// ═══════════════════════════════════════════════════════════════════════════

/** Map of blend mode name → per-channel function (separable modes only). */
const SEPARABLE_MODES: Record<string, BlendFn> = {
  'normal': blendNormal,
  'multiply': blendMultiply,
  'screen': blendScreen,
  'overlay': blendOverlay,
  'darken': blendDarken,
  'lighten': blendLighten,
  'color-dodge': blendColorDodge,
  'color-burn': blendColorBurn,
  'hard-light': blendHardLight,
  'soft-light': blendSoftLight,
  'difference': blendDifference,
  'exclusion': blendExclusion,
};

/**
 * Apply a blend mode to two colors and return the blended result (without compositing alpha).
 * Handles both separable and non-separable modes.
 */
const applyBlendMode = (base: RGBA, top: RGBA, mode: string): RGBA => {
  const fn = SEPARABLE_MODES[mode];

  if (fn) {
    // Separable: apply per-channel
    return {
      r: fn(base.r, top.r),
      g: fn(base.g, top.g),
      b: fn(base.b, top.b),
      a: top.a, // alpha handled by compositing step
    };
  }

  // Non-separable modes
  switch (mode) {
    case 'hue': {
      const [r, g, b] = setLum(...setSat(top.r, top.g, top.b, sat(base.r, base.g, base.b)), lum(base.r, base.g, base.b));
      return { r, g, b, a: top.a };
    }
    case 'saturation': {
      const [r, g, b] = setLum(...setSat(base.r, base.g, base.b, sat(top.r, top.g, top.b)), lum(base.r, base.g, base.b));
      return { r, g, b, a: top.a };
    }
    case 'color': {
      const [r, g, b] = setLum(top.r, top.g, top.b, lum(base.r, base.g, base.b));
      return { r, g, b, a: top.a };
    }
    case 'luminosity': {
      const [r, g, b] = setLum(base.r, base.g, base.b, lum(top.r, top.g, top.b));
      return { r, g, b, a: top.a };
    }
    default:
      // Fallback to normal
      return { ...top };
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// Porter-Duff "Over" Compositing
// https://www.w3.org/TR/compositing-1/#porterduffcompositingoperators_srcover
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Composite source (top) over destination (base) using the Porter-Duff "over" operator.
 * This combines alpha blending with the blend mode result.
 *
 * Formula:
 *   αo = αs + αb·(1 − αs)
 *   Co = (αs·Cs + αb·Cb·(1 − αs)) / αo
 *
 * Where Cs is the *blended* color (blend mode already applied).
 */
export const compositeOver = (base: RGBA, top: RGBA, blendMode = 'normal'): RGBA => {
  const blended = applyBlendMode(base, top, blendMode);

  const αs = blended.a;
  const αb = base.a;
  const αo = αs + αb * (1 - αs);

  if (αo === 0) return { r: 0, g: 0, b: 0, a: 0 };

  return {
    r: (αs * blended.r + αb * base.r * (1 - αs)) / αo,
    g: (αs * blended.g + αb * base.g * (1 - αs)) / αo,
    b: (αs * blended.b + αb * base.b * (1 - αs)) / αo,
    a: αo,
  };
};

// ═══════════════════════════════════════════════════════════════════════════
// High-Level API
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Compute the final rendered color from a stack of `IStyleLayer[]`.
 *
 * Process:
 * 1. Find the highest fully-opaque Normal-mode layer → skip everything below it.
 * 2. Iterate bottom-to-top, compositing each visible color layer.
 * 3. Return the result as an sRGB hex string.
 *
 * @param fills - The layer stack (first element = top-most in Figma UI, rendered last).
 * @param background - Optional background color (default: transparent black).
 * @returns Hex color string (#RRGGBB).
 */
export const getComputedColor = (fills: IStyleLayer[], background = '#000000'): string => {
  if (!fills || fills.length === 0) return background;

  // Layers in the array are stored top-first. Reverse for bottom-to-top processing.
  const ordered = [...fills].reverse();

  // Optimization: find the highest fully-opaque Normal layer → skip below
  let startIndex = 0;
  for (let i = ordered.length - 1; i >= 0; i--) {
    const layer = ordered[i];
    if (
      layer.visible !== false &&
      layer.type === 'color' &&
      (layer.opacity ?? 1) >= 1 &&
      (layer.blendMode || 'normal') === 'normal'
    ) {
      startIndex = i;
      break;
    }
  }

  // Start with background (or the opaque cutoff layer)
  let result: RGBA;
  const cutoffLayer = ordered[startIndex];

  if (
    startIndex > 0 &&
    cutoffLayer.visible !== false &&
    cutoffLayer.type === 'color' &&
    cutoffLayer.color
  ) {
    // Start from the opaque cutoff layer directly
    result = hexToLinearRGBA(cutoffLayer.color, cutoffLayer.opacity ?? 1);
    startIndex++; // Skip the layer we just used as base
  } else {
    result = hexToLinearRGBA(background);
  }

  for (let i = startIndex; i < ordered.length; i++) {
    const layer = ordered[i];
    if (layer.visible === false) continue;
    if (layer.type !== 'color' || !layer.color) continue; // Only solid colors in math engine

    const topColor = hexToLinearRGBA(layer.color, layer.opacity ?? 1);
    // Note: this uses legacy `compositeOver` API which was previously refactored... wait.
    // The previous implementation of `compositeOver` only took 3 arguments. I need to use the CURRENT `compositeOver` taking 3 arguments (base, top, blendMode).
    result = compositeOver(result, topColor, layer.blendMode || 'normal');
  }

  return linearRGBAToHex(result);
};

/**
 * Check if a layer is fully opaque with Normal blend mode.
 * Used for optimization — layers below such a layer are invisible.
 */
export const isOpaqueNormalLayer = (layer: IStyleLayer): boolean => {
  if (layer.visible === false) return false;
  if ((layer.opacity ?? 1) < 1) return false;
  if ((layer.blendMode || 'normal') !== 'normal') return false;
  
  // Images, Gradients, Videos, and Noise can have intrinsic transparency 
  // (like PNG alpha, unrendered blobs, variable color stops).
  if (layer.type !== 'color') return false;
  
  const col = layer.color || '#000000';
  // If it defines an alpha channel in the hex, it must be fully opaque
  if (col.length === 9) {
    const a = parseInt(col.substring(7, 9), 16) / 255;
    if (a < 0.99) return false; // Account for floating point margins
  }

  return true;
};

/**
 * Find the index of the lowest visible layer that matters for rendering.
 * Everything below a fully-opaque Normal layer can be skipped.
 *
 * @param layers - Layer array (any order; function scans from end to start).
 * @returns Index of first layer that matters.
 */
export const findOcclusionCutoff = (layers: IStyleLayer[]): number => {
  for (let i = layers.length - 1; i >= 0; i--) {
    if (isOpaqueNormalLayer(layers[i])) return i;
  }
  return 0;
};

// ═══════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════

const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));
const hex2 = (n: number): string => n.toString(16).padStart(2, '0');
