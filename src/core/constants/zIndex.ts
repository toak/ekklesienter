/**
 * Centralized Z-index constants for the application.
 * Ensures consistent stacking contexts and prevents magic number conflicts.
 */
export const Z_INDEX = {
  // Canvas Elements
  CANVAS_BACKGROUND: 0,
  CANVAS_ITEM: 10,
  CANVAS_ITEM_STROKE: 20,
  CANVAS_EDITOR_OVERLAY: 50,
  CANVAS_GUIDES: 100,

  // Slide Display
  SLIDE_BACKGROUND: 0,
  SLIDE_CONTENT: 10,
  SLIDE_OVERLAYS: 100,

  // Projector Specific
  PROJECTOR_BASE: 0,
  PROJECTOR_CONTENT: 100,
  PROJECTOR_OVERRIDE: 200,

  // UI Components
  LAYOUT_SIDEBAR: 40,
  LAYOUT_HEADER: 45,
  LAYOUT_OVERLAY: 50,

  // Modals and Toasts
  MODAL_BASE: 1000,
  TOAST_BASE: 2000,
} as const;
