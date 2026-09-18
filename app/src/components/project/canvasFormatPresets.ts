/**
 * 260918-ovi (D-preset-set / D-control): the single source of truth for the
 * canvas-format choice at project creation AND the post-creation resolution
 * editor in SettingsView. One shared table so a future edit cannot silently
 * reintroduce a 4K option in one surface while the other stays clamped
 * (T-260918-ovi-03).
 *
 * Preset labels are English with platform annotations (D-preset-set):
 *  - HD 1920x1080 (16:9) — YouTube classic; the default.
 *  - HD Vertical 1080x1920 (9:16) — Story / Reels / Shorts.
 *  - Portrait 1080x1350 (4:5) — Post (Instagram / Facebook).
 *  - Square 1080x1080 (1:1) — Post fallback.
 *  - Custom… — a user-typed W x H, each side clamped to [16, 1920] (D-control).
 */

/** Custom-side bounds (D-control): each side of a Custom… entry lives here. */
export const CUSTOM_CANVAS_FORMAT_MIN_SIDE = 16;
export const CUSTOM_CANVAS_FORMAT_MAX_SIDE = 1920;

/** The four fixed presets, in locked display order (D-preset-set). */
export type CanvasFormatPresetId = 'hd' | 'hd-vertical' | 'portrait' | 'square';

/** The Custom… pseudo-preset id (the pill has a fifth segment; not a preset). */
export const CUSTOM_CANVAS_FORMAT_PRESET_ID = 'custom';
export type CanvasFormatSelectionId = CanvasFormatPresetId | typeof CUSTOM_CANVAS_FORMAT_PRESET_ID;

export interface CanvasFormatPreset {
  id: CanvasFormatPresetId;
  width: number;
  height: number;
  label: string;
}

export const CANVAS_FORMAT_PRESETS: readonly CanvasFormatPreset[] = [
  {
    id: 'hd',
    width: 1920,
    height: 1080,
    label: 'HD — 1920x1080 (16:9) · YouTube classic',
  },
  {
    id: 'hd-vertical',
    width: 1080,
    height: 1920,
    label: 'HD Vertical — 1080x1920 (9:16) · Story / Reels / Shorts (Instagram / Facebook / YouTube / TikTok)',
  },
];

/** The preset selected when the dialog opens (D-preset-set: HD is the default). */
export const DEFAULT_CANVAS_FORMAT_PRESET_ID: CanvasFormatPresetId = 'hd';

/**
 * Round and clamp each side to [CUSTOM_CANVAS_FORMAT_MIN_SIDE, CUSTOM_CANVAS_FORMAT_MAX_SIDE].
 * The NumericStepper's own clampToStep is the primary bound at emission time
 * (T-260918-ovi-01); this is a defensive second pass so the store never sees
 * an out-of-range value even from a non-stepper caller.
 */
export function clampCustomSize(width: number, height: number): { width: number; height: number } {
  const clampSide = (value: number): number => {
    const rounded = Math.round(value);
    return Math.min(CUSTOM_CANVAS_FORMAT_MAX_SIDE, Math.max(CUSTOM_CANVAS_FORMAT_MIN_SIDE, rounded));
  };
  return { width: clampSide(width), height: clampSide(height) };
}
